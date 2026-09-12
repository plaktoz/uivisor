/**
 * tests/unit/yaml-fixtures.test.ts
 *
 * Real-file fixture tests: loads YAML files from disk and asserts their
 * structural shape (first command is goto, correct command counts, etc.).
 *
 * These tests use real fs.readFileSync + yaml.load — no mocks.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import * as yaml from 'js-yaml';

// Repo root is three levels up from uivisor-app/tests/unit/
const REPO_ROOT = path.resolve(__dirname, '../../..');

type YamlDoc = {
  appId?: string;
  shared?: boolean;
  commands: Record<string, unknown>[];
};

function loadYaml(relPath: string): YamlDoc {
  const abs = path.join(REPO_ROOT, relPath);
  const content = fs.readFileSync(abs, 'utf8');
  return yaml.load(content) as YamlDoc;
}

// ─── TC-5: recorder-app/sample/w3schools.yaml ────────────────────────────────

describe('TC-5: w3schools.yaml', () => {
  const parsed = loadYaml('recorder-app/sample/w3schools.yaml');

  it('commands[0].goto equals https://www.w3schools.com', () => {
    expect((parsed.commands[0] as { goto: string }).goto).toBe('https://www.w3schools.com');
  });

  it('commands[0].goto equals parsed.appId', () => {
    expect((parsed.commands[0] as { goto: string }).goto).toBe(parsed.appId);
  });

  it('commands.length equals 14 (1 goto + 13 original commands)', () => {
    expect(parsed.commands.length).toBe(14);
  });
});

// ─── TC-6: test-app/flows/submit-task-check-fail.yaml ────────────────────────

describe('TC-6: submit-task-check-fail.yaml', () => {
  const parsed = loadYaml('test-app/flows/submit-task-check-fail.yaml');

  it('commands[0].goto equals http://localhost:5173/login', () => {
    expect((parsed.commands[0] as { goto: string }).goto).toBe('http://localhost:5173/login');
  });

  it('commands[0].goto equals parsed.appId', () => {
    expect((parsed.commands[0] as { goto: string }).goto).toBe(parsed.appId);
  });

  it('commands.length equals 4', () => {
    expect(parsed.commands.length).toBe(4);
  });
});

// ─── TC-7: test-app/flows/submit-task-check-pass.yaml ────────────────────────

describe('TC-7: submit-task-check-pass.yaml', () => {
  const parsed = loadYaml('test-app/flows/submit-task-check-pass.yaml');

  it('commands[0].goto equals http://localhost:5173/login', () => {
    expect((parsed.commands[0] as { goto: string }).goto).toBe('http://localhost:5173/login');
  });

  it('commands.length equals 5', () => {
    expect(parsed.commands.length).toBe(5);
  });
});

// ─── TC-8: test-app/flows/integration/run-flow.yaml ──────────────────────────

describe('TC-8: run-flow.yaml', () => {
  const parsed = loadYaml('test-app/flows/integration/run-flow.yaml');

  it('commands[0].goto equals ${base}/integration', () => {
    expect((parsed.commands[0] as { goto: string }).goto).toBe('${base}/integration');
  });

  it('commands.length equals 6', () => {
    expect(parsed.commands.length).toBe(6);
  });
});

// ─── TC-10: test-app/flows/login-happy.yaml ──────────────────────────────────

describe('TC-10: login-happy.yaml', () => {
  const parsed = loadYaml('test-app/flows/login-happy.yaml');

  it('commands[0].goto equals http://localhost:5173/login', () => {
    expect((parsed.commands[0] as { goto: string }).goto).toBe('http://localhost:5173/login');
  });

  it('commands.length equals 5', () => {
    expect(parsed.commands.length).toBe(5);
  });

  it('exactly 1 goto command', () => {
    const gotoCount = parsed.commands.filter((c) => 'goto' in c).length;
    expect(gotoCount).toBe(1);
  });
});

// ─── TC-11: test-app/flows/shared-login.yaml ─────────────────────────────────

describe('TC-11: shared-login.yaml', () => {
  const parsed = loadYaml('test-app/flows/shared-login.yaml');

  it('commands[0].goto is truthy', () => {
    expect((parsed.commands[0] as { goto: string }).goto).toBeTruthy();
  });

  it('parsed.shared equals true', () => {
    expect(parsed.shared).toBe(true);
  });

  it('commands.length equals 5', () => {
    expect(parsed.commands.length).toBe(5);
  });
});

// ─── TC-12: test-app/flows/integration/shared-int-setup.yaml ─────────────────

describe('TC-12: shared-int-setup.yaml', () => {
  const parsed = loadYaml('test-app/flows/integration/shared-int-setup.yaml');

  it('commands[0].goto is truthy', () => {
    expect((parsed.commands[0] as { goto: string }).goto).toBeTruthy();
  });

  it('exactly 1 goto command', () => {
    const gotoCount = parsed.commands.filter((c) => 'goto' in c).length;
    expect(gotoCount).toBe(1);
  });
});

// ─── TC-14: All 4 modified YAML files — appId matches goto; command counts ────

describe('TC-14: modified YAML files — appId and command counts', () => {
  it('w3schools.yaml: appId matches commands[0].goto and has 14 commands', () => {
    const p = loadYaml('recorder-app/sample/w3schools.yaml');
    expect((p.commands[0] as { goto: string }).goto).toBe(p.appId);
    expect(p.commands.length).toBe(14);
  });

  it('submit-task-check-fail.yaml: appId matches commands[0].goto and has 4 commands', () => {
    const p = loadYaml('test-app/flows/submit-task-check-fail.yaml');
    expect((p.commands[0] as { goto: string }).goto).toBe(p.appId);
    expect(p.commands.length).toBe(4);
  });

  it('submit-task-check-pass.yaml: appId matches commands[0].goto and has 5 commands', () => {
    const p = loadYaml('test-app/flows/submit-task-check-pass.yaml');
    expect((p.commands[0] as { goto: string }).goto).toBe(p.appId);
    expect(p.commands.length).toBe(5);
  });

  it('run-flow.yaml: commands[0].goto equals ${base}/integration and has 6 commands', () => {
    const p = loadYaml('test-app/flows/integration/run-flow.yaml');
    expect((p.commands[0] as { goto: string }).goto).toBe('${base}/integration');
    expect(p.commands.length).toBe(6);
  });
});
