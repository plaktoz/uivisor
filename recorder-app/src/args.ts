export interface RecordArgs {
  url: string;
  outputPath: string;
}

const HELP = `
uivisor-record [url] [options]

Arguments:
  url              URL to open in Playwright browser (default: "http://localhost:5173")

Options:
  -o, --output <file>     Output YAML file path (default: "recorded.yaml")
  --base-url <url>        Base URL override (overrides positional url)
  -h, --help              Show help
`.trim();

export function parseArgs(argv: string[]): RecordArgs {
  let url = 'http://localhost:5173';
  let outputPath = 'recorded.yaml';

  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(HELP);
      process.exit(0);
    } else if (arg === '--output' || arg === '-o') {
      if (i + 1 >= args.length) {
        throw new Error(`${arg} requires a value`);
      }
      outputPath = args[++i];
    } else if (arg === '--base-url') {
      if (i + 1 >= args.length) {
        throw new Error('--base-url requires a value');
      }
      url = args[++i];
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      url = arg;
    }
  }

  return { url, outputPath };
}
