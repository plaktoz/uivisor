export interface ParsedArgs {
  target: string;
  headed: boolean;
  slowMo: number;
  reporter: 'html' | 'md' | null;
  tags: string[];
  outputDir?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // strip node + script path

  // args[0] should be 'test', args[1] should be target
  let target: string | undefined;
  let headed = false;
  let slowMo = 0;
  let reporter: 'html' | 'md' | null = null;
  const tags: string[] = [];
  let outputDir: string | undefined;

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
    } else if (arg === '--tag' && i + 1 < args.length) {
      tags.push(args[i + 1] as string);
      i += 2;
    } else if (arg === '--output-dir' && i + 1 < args.length) {
      outputDir = args[i + 1] as string;
      i += 2;
    } else {
      i++;
    }
  }

  if (!target) {
    process.stdout.write('Usage: uivisor test <target> [--headed] [--slow-mo <ms>] [--reporter html|md] [--tag <name>] [--output-dir <path>]\n');
    process.exit(1);
  }

  return { target, headed, slowMo, reporter, tags, outputDir };
}
