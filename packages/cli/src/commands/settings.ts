import type { AppContext } from '../app.ts';
import { readGlobalConfig, type ThemeMode, writeGlobalConfig } from '../context.ts';
import { CliError } from '../errors.ts';
import { print, printJson } from '../io.ts';

const THEME_MODES: ThemeMode[] = ['auto', 'dark', 'light', 'no-color'];

export async function settingsShow(ctx: AppContext, args: { json: boolean }) {
  const config = readGlobalConfig(ctx.appDir);
  if (args.json) {
    printJson({ theme: config.theme ?? { mode: 'auto' } });
    return;
  }
  print(`theme: ${JSON.stringify(config.theme ?? { mode: 'auto' })}`);
}

export async function settingsSet(
  ctx: AppContext,
  args: { key: string; value: string; json: boolean },
) {
  const config = readGlobalConfig(ctx.appDir);
  if (args.key === 'theme') {
    if (!THEME_MODES.includes(args.value as ThemeMode)) {
      throw new CliError(`theme must be one of: ${THEME_MODES.join(', ')}`, 2, 'USAGE');
    }
    config.theme = { ...config.theme, mode: args.value as ThemeMode };
  } else if (args.key === 'accent') {
    config.theme = { ...config.theme, mode: config.theme?.mode ?? 'auto', accent: args.value };
  } else {
    throw new CliError(`unknown setting: ${args.key}`, 2, 'USAGE');
  }
  writeGlobalConfig(config, ctx.appDir);
  if (args.json) {
    printJson({ theme: config.theme });
    return;
  }
  print(`set ${args.key} = ${args.value}`);
}
