export interface RecordArgs {
  url: string;
  outputPath: string;
  runFlowPaths: string[];
}

const HELP = `
uivisor-record [url] [options]

Arguments:
  url              URL to open in Playwright browser (default: "http://localhost:5173")

Options:
  -o, --output <file>     Output YAML file path (default: "recorded.yaml")
  --base-url <url>        Base URL override (overrides positional url)
  --run-flow <paths>         Comma-delimited list of flow YAML files to replay before recording.
                             The output file will reference these flows via runFlow: entries.
  -h, --help              Show help
`.trim();

export function parseArgs(argv: string[]): RecordArgs {
  let url = 'http://localhost:5173';
  let outputPath = 'recorded.yaml';
  let runFlowPaths: string[] = [];

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
    } else if (arg === '--run-flow') {
      if (i + 1 >= args.length) {
        throw new Error('--run-flow requires a value');
      }
      const paths = args[++i].split(',');
      for (const p of paths) {
        if (!p.endsWith('.yaml') && !p.endsWith('.yml')) {
          throw new Error(`--run-flow: file must be a YAML flow file: ${p}`);
        }
      }
      runFlowPaths = paths;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      url = arg;
    }
  }

  return { url, outputPath, runFlowPaths };
}
