import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', '..', '..', 'apps', 'dashboard', 'dist');
const dest = join(here, '..', 'dist', 'dashboard');

if (!existsSync(join(source, 'index.html'))) {
  console.error('dashboard dist not found — build apps/dashboard first');
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(source, dest, { recursive: true });
console.log(`bundled dashboard assets -> ${dest}`);
