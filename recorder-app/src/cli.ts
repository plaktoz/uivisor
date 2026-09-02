import { chromium } from 'playwright';
import type { Command } from '@uivisor/core';
import { CAPTURE_SCRIPT } from '@uivisor/core';
import { OVERLAY_SCRIPT } from './overlay.js';
import { startSession, appendCommand } from './yamlWriter.js';
import { parseArgs } from './args.js';

async function main(): Promise<void> {
  const { url, outputPath } = parseArgs(process.argv);

  startSession(outputPath, url);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.exposeFunction('__uivisorCapture', (cmd: unknown) => {
    appendCommand(outputPath, cmd as Command);
    console.log('[rec]', JSON.stringify(cmd));
  });

  await page.exposeFunction('__uivisorOverlay', (cmd: unknown) => {
    appendCommand(outputPath, cmd as Command);
    console.log('[rec]', JSON.stringify(cmd));
  });

  await page.addInitScript(CAPTURE_SCRIPT);
  await page.addInitScript(OVERLAY_SCRIPT);

  await page.goto(url);

  page.on('close', async () => {
    await browser.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await browser.close();
    process.exit(0);
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
