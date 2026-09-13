import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

const readme = readFileSync(join(__dirname, '../../README.md'), 'utf8');

describe('README waitForPageLoad', () => {
  it('contains waitForPageLoad', () => expect(readme).toContain('waitForPageLoad'));
  it('does not contain waitForLoad key', () => expect(readme).not.toMatch(/\bwaitForLoad:/));
});
