import type { Page, Locator } from 'playwright';
import type { Selector } from '@uivisor/core';
import { matchesPattern } from '../utils/patterns.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Root = Page | Locator;

// ─── Valid pipe-syntax attributes ────────────────────────────────────────────

const PLAIN_VALID_ATTRS = new Set(['id', 'name', 'placeholder', 'text', 'label', 'role']);

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
    // Wildcard in the middle — use *=  with the segment between first/last *
    const first = value.indexOf('*');
    const last = value.lastIndexOf('*');
    const mid = value.slice(first + 1, last);
    return `[${attr}*="${mid}"]`;
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

// ─── Cascade step builder ─────────────────────────────────────────────────────

interface CascadeStep {
  attr: string;
  locator: Locator;
}

function buildCascadeStep(root: Root, attr: string, value: string): Locator {
  switch (attr) {
    case 'text':
      return buildTextLocator(root, value);
    default:
      // data-*, id, name, placeholder
      return (root as Page).locator(buildAttrCss(attr, value));
  }
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
    default:
      // data-*, id, name, placeholder
      return (root as Page).locator(buildAttrCss(attr, value));
  }
}

// ─── Container locator resolution (lenient: accepts count ≥ 1) ───────────────

/**
 * Resolve a bare or pipe-syntax selector string to a Playwright `Locator`
 * that may match MULTIPLE elements (used for `within` container resolution).
 *
 * Unlike `resolveSelector`, this function accepts count≥1 (not strictly =1)
 * so that `within: nth: N` can select among multiple matching containers.
 *
 * Cascade / pipe parsing rules are identical to `resolveSelector`; the only
 * difference is the acceptance threshold.
 *
 * Throws `within: No container found for selector '...'` when all steps yield 0.
 */
export async function resolveContainerLocator(
  page: Page,
  selector: string,
): Promise<Locator> {
  if (selector.includes('=')) {
    // Pipe mode
    const segments = parsePipeString(selector); // throws on unknown attr
    const tried: string[] = [];
    for (const seg of segments) {
      const loc = buildLocatorForAttr(page as Root, seg.attr, seg.value);
      const n = await loc.count();
      if (n >= 1) return loc;
      tried.push(`${seg.raw}: 0 matches`);
    }
    throw new Error(
      `within: No container found for selector '${selector}'`
    );
  }

  // Cascade mode
  const CASCADE_ATTRS = ['data-testid', 'text', 'name', 'id', 'placeholder'] as const;
  for (const attr of CASCADE_ATTRS) {
    const loc = buildCascadeStep(page as Root, attr, selector);
    const n = await loc.count();
    if (n >= 1) return loc;
  }
  throw new Error(`within: No container found for selector '${selector}'`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a `Selector` to a Playwright `Locator`.
 *
 * - Object selector forms (`{ text }`, `{ testId }`, etc.): direct Playwright dispatch (unchanged).
 * - Bare string WITHOUT `=`: heuristic cascade (`data-testid` → `text` → `name` → `id` → `placeholder`).
 * - Bare string WITH `=`: pipe syntax (`attr=value|attr=value`); tries left-to-right.
 *
 * The optional `scope` parameter restricts all locator queries to descendants of that Locator.
 */
export async function resolveSelector(
  page: Page,
  selector: Selector,
  scope?: Locator,
): Promise<Locator> {
  const root: Root = scope ?? page;

  // ── Object selector forms (unchanged behaviour) ───────────────────────────
  if (typeof selector !== 'string') {
    if ('css' in selector) {
      return (root as Page).locator(selector.css);
    }
    if ('testId' in selector) {
      return (root as Page).getByTestId(selector.testId);
    }
    if ('text' in selector) {
      return (root as Page).getByText(selector.text);
    }
    if ('role' in selector) {
      return (root as Page).getByRole(
        selector.role as Parameters<Page['getByRole']>[0],
        { name: selector.name },
      );
    }
    if ('label' in selector) {
      return (root as Page).getByLabel(selector.label);
    }
    if ('placeholder' in selector) {
      return (root as Page).getByPlaceholder(selector.placeholder);
    }
    const key = Object.keys(selector as object)[0] ?? 'unknown';
    throw new Error(`Unrecognized selector type: ${key}`);
  }

  // ── String selectors ──────────────────────────────────────────────────────

  // Pipe mode: string contains `=`
  if (selector.includes('=')) {
    const segments = parsePipeString(selector); // throws on unknown attr
    const tried: string[] = [];
    for (const seg of segments) {
      const loc = buildLocatorForAttr(root, seg.attr, seg.value);
      const n = await loc.count();
      tried.push(`${seg.raw}: ${n} matches`);
      if (n === 1) return loc;
    }
    throw new Error(
      `No element found for pipe selector '${selector}'.\n` +
        tried.map((t) => `  ${t}`).join('\n')
    );
  }

  // Cascade mode: no `=`
  const CASCADE_ATTRS = ['data-testid', 'text', 'name', 'id', 'placeholder'] as const;
  const counts: Array<{ attr: string; count: number }> = [];

  for (const attr of CASCADE_ATTRS) {
    const loc = buildCascadeStep(root, attr, selector);
    const n = await loc.count();
    counts.push({ attr, count: n });
    if (n === 1) return loc;
  }

  // All steps exhausted
  const lines = counts.map((c) => `  ${c.attr}=${selector}: ${c.count} matches`).join('\n');
  throw new Error(
    `No unique element found for bare selector '${selector}'.\n` +
      lines +
      `\nUse pipe syntax (e.g. tapOn: text=${selector}) to target a specific attribute.`
  );
}
