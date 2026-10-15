import * as fs from 'fs';
import * as path from 'path';
import type { Page } from 'playwright';

/**
 * Upper bound on how long a failure screenshot may take. Without this,
 * Playwright's own default (30s) applies, which can make a failure's
 * screenshot attempt (non-fatal, but awaited) dominate the step's wall time
 * when the page is stuck mid-navigation.
 */
export const SCREENSHOT_TIMEOUT_MS = 5000;

export async function captureScreenshot(page: Page, flowStem: string, counter: number, runDir: string): Promise<string> {
  const dir = path.join(runDir, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const padded = String(counter).padStart(3, '0');
  const filename = `${flowStem}-fail-${padded}.png`;
  const screenshotPath = path.join(dir, filename);
  await page.screenshot({ path: screenshotPath, timeout: SCREENSHOT_TIMEOUT_MS });
  return screenshotPath;
}
