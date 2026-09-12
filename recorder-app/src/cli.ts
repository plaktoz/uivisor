import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import { chromium } from 'playwright';
import type { Command } from '@uivisor/core';
import { CAPTURE_SCRIPT } from '@uivisor/core';
import { OVERLAY_SCRIPT } from './overlay.js';
import { startSession, appendCommand } from './yamlWriter.js';
import { parseArgs, type RecordArgs } from './args.js';
import { replayFlows } from './flowReplayer.js';

const DEFAULT_URL = 'http://localhost:5173';

function validateRunFlowPaths(args: RecordArgs): void {
  const { runFlowPaths, outputPath } = args;
  const absOutput = path.resolve(outputPath);
  for (const flowPath of runFlowPaths) {
    if (!fs.existsSync(path.resolve(flowPath))) {
      console.error(`--run-flow: file not found: ${flowPath}`);
      process.exit(1);
    }
    if (path.resolve(flowPath) === absOutput) {
      console.error(
        `--run-flow: output file "${outputPath}" would overwrite input flow "${flowPath}" — use a different --output path`,
      );
      process.exit(1);
    }
  }
}

function readFirstFlowAppId(flowPath: string): string {
  const absPath = path.resolve(flowPath);
  let raw: unknown = undefined;
  try {
    raw = yaml.load(fs.readFileSync(absPath, 'utf8'));
  } catch {
    console.error(`--run-flow: cannot read appId from first flow file: ${flowPath}`);
    process.exit(1);
  }
  const doc = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const appId = String(doc.appId || doc.url || '');
  if (!appId) {
    console.error(`--run-flow: cannot read appId from first flow file: ${flowPath}`);
    process.exit(1);
  }
  return appId;
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  let { url } = args;
  const { outputPath, runFlowPaths } = args;

  if (runFlowPaths.length > 0) {
    validateRunFlowPaths(args);

    // Derive url from first flow file if user didn't explicitly set one
    if (url === DEFAULT_URL) {
      url = readFirstFlowAppId(runFlowPaths[0]);
    }
  }

  startSession(outputPath, url);

  // Write runFlow: references for each input flow path
  if (runFlowPaths.length > 0) {
    const outputDir = path.dirname(path.resolve(outputPath));
    for (const inputPath of runFlowPaths) {
      const relPath = path.relative(outputDir, path.resolve(inputPath));
      appendCommand(outputPath, { type: 'runFlow', path: relPath });
    }
  }

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Replay flows before exposing capture/overlay functions
  if (runFlowPaths.length > 0) {
    try {
      await replayFlows(runFlowPaths, page, outputPath);
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : String(err));
      await browser.close();
      process.exit(1);
    }
  }

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

  // Only navigate to starting URL when not using --run-flow;
  // replay already navigated the browser to the end state of the last flow.
  if (runFlowPaths.length === 0) {
    await page.goto(url);
  }

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
