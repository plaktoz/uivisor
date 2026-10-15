import type { Page, Locator, FrameLocator } from 'playwright';
import type { Selector } from './types.js';
import { createDeadline, retryUntil, DEFAULT_TIMEOUTS, type Deadline } from './deadline.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Root = Page | Locator;

// ─── Valid pipe-syntax attributes ────────────────────────────────────────────

const PLAIN_VALID_ATTRS = new Set(['id', 'name', 'placeholder', 'text', 'label', 'role', 'xpath']);

function isValidAttr(attr: string): boolean {
  return PLAIN_VALID_ATTRS.has(attr) || /^data-[a-zA-Z0-9-]+$/.test(attr);
}

// ─── CSS attribute selector builder with wildcard support ─────────────────────

/**
 * Build a CSS attribute selector string for `[attr operator "value"]`.
 * Handles wildcard patterns:
 *   prefix* → ^=
 *   *suffix → $=
 *   *contains* → *=
 *   no wildcard → =
 */
function buildAttrCss(attr: string, value: string): string {
  if (!value.includes('*')) {
    return `[${attr}="${value}"]`;
  }
  const startsWithWild = value.startsWith('*');
  const endsWithWild = value.endsWith('*');

  if (startsWithWild && endsWithWild) {
    // Contains match
    const core = value.slice(1, -1);
    return `[${attr}*="${core}"]`;
  } else if (endsWithWild) {
    // Prefix match
    const prefix = value.slice(0, -1);
    return `[${attr}^="${prefix}"]`;
  } else if (startsWithWild) {
    // Suffix match
    const suffix = value.slice(1);
    return `[${attr}$="${suffix}"]`;
  } else {
    // Wildcard(s) in the middle: anchor on the outermost prefix and suffix.
    // e.g. foo*bar → [attr^="foo"][attr$="bar"]
    //      foo*baz*qux → [attr^="foo"][attr$="qux"]
    const first = value.indexOf('*');
    const last = value.lastIndexOf('*');
    const prefix = value.slice(0, first);
    const suffix = value.slice(last + 1);
    return `[${attr}^="${prefix}"][${attr}$="${suffix}"]`;
  }
}

// ─── Text locator builder ─────────────────────────────────────────────────────

/**
 * Build a text locator on `root`. Uses exact match by default.
 * When the value contains `*`, converts to a regex for wildcard matching.
 */
function buildTextLocator(root: Root, value: string): Locator {
  if (!value.includes('*')) {
    return (root as Page).getByText(value, { exact: true });
  }
  // Convert wildcard pattern to anchored regex
  const regexStr = value
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return (root as Page).getByText(new RegExp(`^${regexStr}$`));
}

// ─── Pipe segment resolver ────────────────────────────────────────────────────

/**
 * Parse a pipe string into segments `[{ attr, value }, ...]`.
 * Throws immediately if any attribute is unknown.
 * The input is guaranteed to contain `=`.
 */
interface PipeSegment {
  attr: string;
  value: string;
  raw: string; // original "attr=value" string for error messages
}

function parsePipeString(raw: string): PipeSegment[] {
  const segments = raw.split('|');
  return segments.map((seg) => {
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) {
      throw new Error(
        `Invalid pipe segment '${seg}': missing '='. Use tapOn: { text: '${raw}' } for text containing '='.`
      );
    }
    const attr = seg.slice(0, eqIdx);
    const value = seg.slice(eqIdx + 1);
    // T5: XPath union conflict detection — if attr is 'xpath' and multiple segments exist,
    // the '|' was inside an XPath expression, conflicting with pipe syntax
    if (attr === 'xpath' && segments.length > 1) {
      const xpathExpr = raw.slice(raw.indexOf('=') + 1);
      throw new Error(
        `XPath union '|' conflicts with pipe syntax. Use the object form: { xpath: '${xpathExpr}' }`
      );
    }
    if (!isValidAttr(attr)) {
      throw new Error(
        `Unknown attribute '${attr}' in '${raw}'. Use tapOn: { text: '${raw}' } for text containing '='.`
      );
    }
    return { attr, value, raw: seg };
  });
}

// ─── Locator builder for a single pipe/cascade attribute ─────────────────────

function buildLocatorForAttr(root: Root, attr: string, value: string): Locator {
  switch (attr) {
    case 'text':
      return buildTextLocator(root, value);
    case 'label':
      return (root as Page).getByLabel(value);
    case 'role':
      return (root as Page).getByRole(value as Parameters<Page['getByRole']>[0]);
    case 'xpath':
      return (root as Page).locator('xpath=' + value);
    default:
      // data-*, id, name, placeholder
      return (root as Page).locator(buildAttrCss(attr, value));
  }
}


// ─── Resolution steps ─────────────────────────────────────────────────────────

const CASCADE_ATTRS = ['data-testid', 'text', 'name', 'id', 'placeholder'] as const;

export interface ResolutionStep {
  label: string;
  locator: Locator;
  count(): Promise<number>;
}

export interface StepCount {
  label: string;
  count: number;
}

export type Resolution =
  | { found: true; locator: Locator; step: number }
  | { found: false; counts: StepCount[] };

/** The selector as the user wrote it: strings verbatim, object forms as JSON. */
export function selectorLabel(selector: Selector): string {
  return typeof selector === 'string' ? selector : JSON.stringify(selector);
}

/** The locator is built on first use, so steps after the winner are never queried. */
function plainStep(label: string, build: () => Locator): ResolutionStep {
  let built: Locator | undefined;
  const get = (): Locator => (built ??= build());
  return {
    label,
    get locator() { return get(); },
    count: () => get().count(),
  };
}

function xpathStep(root: Root, label: string, expr: string): ResolutionStep {
  const wrap = (err: unknown): Error => {
    const detail = err instanceof Error ? err.message : String(err);
    return new Error(`Invalid XPath expression: ${expr} — ${detail}`);
  };
  let locator: Locator;
  try {
    locator = (root as Page).locator('xpath=' + expr);
  } catch (err: unknown) {
    throw wrap(err);
  }
  return {
    label,
    locator,
    async count() {
      try {
        return await locator.count();
      } catch (err: unknown) {
        throw wrap(err);
      }
    },
  };
}

/**
 * Turn a selector into its ordered resolution steps. Malformed selectors throw
 * here, synchronously, before any page query.
 */
export function buildSteps(root: Root, selector: Selector): ResolutionStep[] {
  if (typeof selector !== 'string') {
    const label = JSON.stringify(selector);
    const r = root as Page;
    if ('css' in selector) return [plainStep(label, () => r.locator(selector.css))];
    if ('testId' in selector) return [plainStep(label, () => r.getByTestId(selector.testId))];
    if ('text' in selector) return [plainStep(label, () => r.getByText(selector.text))];
    if ('role' in selector) {
      return [plainStep(label, () => r.getByRole(
        selector.role as Parameters<Page['getByRole']>[0],
        { name: selector.name },
      ))];
    }
    if ('label' in selector) return [plainStep(label, () => r.getByLabel(selector.label))];
    if ('placeholder' in selector) return [plainStep(label, () => r.getByPlaceholder(selector.placeholder))];
    if ('xpath' in selector) {
      const expr = (selector as { xpath: string }).xpath;
      if (!expr || !expr.trim()) {
        throw new Error(`Invalid xpath selector: expression must not be empty`);
      }
      return [xpathStep(root, label, expr)];
    }
    const key = Object.keys(selector as object)[0] ?? 'unknown';
    throw new Error(`Unrecognized selector type: ${key}`);
  }

  if (selector.includes('=')) {
    return parsePipeString(selector).map((seg) =>
      seg.attr === 'xpath'
        ? xpathStep(root, seg.raw, seg.value)
        : plainStep(seg.raw, () => buildLocatorForAttr(root, seg.attr, seg.value)),
    );
  }

  return CASCADE_ATTRS.map((attr) =>
    plainStep(`${attr}=${selector}`, () => buildLocatorForAttr(root, attr, selector)),
  );
}

/**
 * Poll the steps until one is accepted and stable. Step 1 wins at once; a
 * lower step wins only when it also won the previous attempt (~100 ms
 * earlier). At the deadline, an unconfirmed winner is not accepted.
 */
export async function pollSteps(
  steps: ResolutionStep[],
  accept: (n: number) => boolean,
  deadline: Deadline,
): Promise<Resolution> {
  let previousWinner: number | undefined;
  const result = await retryUntil<{ locator: Locator; step: number }, StepCount[]>(deadline, async () => {
    const counts: StepCount[] = [];
    let winner: number | undefined;
    for (let i = 0; i < steps.length; i++) {
      const n = await steps[i].count();
      counts.push({ label: steps[i].label, count: n });
      if (accept(n)) {
        winner = i;
        break;
      }
    }
    const confirmed = winner === 0 || (winner !== undefined && winner === previousWinner);
    previousWinner = winner;
    if (confirmed) return { done: true, value: { locator: steps[winner!].locator, step: winner! } };
    return { done: false, last: counts };
  });
  return result.done ? { found: true, ...result.value } : { found: false, counts: result.last };
}

function countLines(counts: StepCount[]): string {
  return counts.map((c) => `\n  ${c.label}: ${c.count} matches`).join('');
}

function defaultDeadline(): Deadline {
  return createDeadline(DEFAULT_TIMEOUTS.defaultTimeout);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a `Selector` to a Playwright `Locator` matching exactly one element,
 * waiting up to `deadline` (default: the built-in element budget).
 *
 * - Object selector forms (`{ text }`, `{ testId }`, etc.): one step.
 * - Bare string WITHOUT `=`: cascade (`data-testid` → `text` → `name` → `id` → `placeholder`).
 * - Bare string WITH `=`: pipe syntax (`attr=value|attr=value`); tried left-to-right.
 *
 * The optional `scope` parameter restricts all locator queries to descendants of that Locator.
 */
export async function resolveLocator(
  page: Page,
  selector: Selector,
  scope?: Locator,
  deadline: Deadline = defaultDeadline(),
): Promise<Locator> {
  const steps = buildSteps(scope ?? page, selector);
  const r = await pollSteps(steps, (n) => n === 1, deadline);
  if (r.found) return r.locator;
  throw new Error(
    `Element not found after ${deadline.timeoutMs}ms: ${selectorLabel(selector)}` + countLines(r.counts),
  );
}

/**
 * Resolve a bare or pipe-syntax selector string to a Playwright `Locator`
 * that may match MULTIPLE elements (used for `within` container resolution).
 * Accepts once the count reaches `nth + 1` (or 1 when `nth` is omitted); the
 * caller applies `.nth()`.
 */
export async function resolveContainerLocator(
  page: Page,
  selector: string,
  opts: { nth?: number; deadline?: Deadline } = {},
): Promise<Locator> {
  const { nth } = opts;
  const deadline = opts.deadline ?? defaultDeadline();
  const steps = buildSteps(page, selector);
  const r = await pollSteps(steps, (n) => n >= (nth ?? 0) + 1, deadline);
  if (r.found) return r.locator;
  if (nth !== undefined && r.counts.some((c) => c.count >= 1 && c.count <= nth)) {
    const n = r.counts.find((c) => c.count > 0)!.count;
    throw new Error(`within: nth=${nth} requested but only ${n} containers matched selector '${selector}'`);
  }
  throw new Error(
    `within: No container found after ${deadline.timeoutMs}ms for selector '${selector}'` + countLines(r.counts),
  );
}

/**
 * Not-visible mode. The deciding step is the first step with ≥ 1 match;
 * resolves `true` once every match of that step is hidden (or every step has
 * 0 matches), `false` if the deadline passes with a visible match.
 */
export async function resolveNotVisible(
  page: Page,
  selector: Selector,
  deadline: Deadline = defaultDeadline(),
): Promise<boolean> {
  const steps = buildSteps(page, selector);
  const r = await retryUntil<true, null>(deadline, async () => {
    for (const step of steps) {
      const n = await step.count();
      if (n < 1) continue;
      for (let i = 0; i < n; i++) {
        if (await step.locator.nth(i).isVisible()) return { done: false, last: null };
      }
      return { done: true, value: true };
    }
    return { done: true, value: true };
  });
  return r.done;
}
