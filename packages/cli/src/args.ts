import { type ParseArgsConfig, parseArgs } from 'node:util';

export interface ParsedArgs {
  positionals: string[];
  values: Record<string, string | boolean | undefined>;
}

export function parseCommandArgs(
  argv: string[],
  options: Record<string, { type: 'string' | 'boolean'; short?: string }>,
): ParsedArgs {
  const config: ParseArgsConfig = {
    args: argv,
    allowPositionals: true,
    options: Object.fromEntries(
      Object.entries(options).map(([name, def]) => [
        name,
        { type: def.type, ...(def.short ? { short: def.short } : {}) },
      ]),
    ),
  };
  const { values, positionals } = parseArgs(config);
  return {
    positionals,
    values: values as Record<string, string | boolean | undefined>,
  };
}
