import type { RunOptions } from '../types.js';

export interface ParsedArgs {
  target: string;
  headed: boolean;
  slowMo: number;
  reporter: 'html' | 'md' | null;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // strip node + script path

  // args[0] should be 'test', args[1] should be target
  let target: string | undefined;
  let headed = false;
  let slowMo = 0;
  let reporter: 'html' | 'md' | null = null;

  let i = 0;
  // skip 'test' subcommand
  if (args[i] === 'test') i++;

  // next positional is the target
  if (args[i] && !args[i].startsWith('--')) {
    target = args[i];
    i++;
  }

  while (i < args.length) {
    const arg = args[i];
    if (arg === '--headed') {
      headed = true;
      i++;
    } else if (arg === '--slow-mo' && i + 1 < args.length) {
      slowMo = parseInt(args[i + 1] as string, 10);
      i += 2;
    } else if (arg === '--reporter' && i + 1 < args.length) {
      const val = args[i + 1];
      if (val === 'html' || val === 'md') reporter = val;
      i += 2;
    } else {
      i++;
    }
  }

  if (!target) {
    process.stdout.write('Usage: webt test <target> [--headed] [--slow-mo <ms>] [--reporter html|md]\n');
    process.exit(1);
  }

  return { target, headed, slowMo, reporter };
}
