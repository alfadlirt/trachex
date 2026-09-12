#!/usr/bin/env node
import { runCli } from '@trachex/cli';

const code = await runCli({ argv: process.argv.slice(2), env: process.env });
process.exit(code);
