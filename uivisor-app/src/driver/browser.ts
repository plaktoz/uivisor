import { chromium, type Browser, type Page } from 'playwright';
import type { RunOptions } from '../types.js';

export async function launchBrowser(options: RunOptions): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({ headless: !options.headed, slowMo: options.slowMo });
  const page = await browser.newPage();
  return { browser, page };
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}
