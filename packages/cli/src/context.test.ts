import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readGlobalConfig, resolveProjectSlug, writeGlobalConfig } from './context.ts';
import { CliError } from './errors.ts';

function tempAppDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-ctx-'));
}

test('resolveProjectSlug prefers explicit --project over active', () => {
  const appDir = tempAppDir();
  try {
    writeGlobalConfig({ activeProject: 'active' }, appDir);
    assert.equal(resolveProjectSlug({ explicit: 'explicit', appDir }), 'explicit');
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('resolveProjectSlug falls back to activeProject', () => {
  const appDir = tempAppDir();
  try {
    writeGlobalConfig({ activeProject: 'loyalty' }, appDir);
    assert.equal(resolveProjectSlug({ appDir }), 'loyalty');
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('resolveProjectSlug throws when no project selected', () => {
  const appDir = tempAppDir();
  try {
    assert.throws(
      () => resolveProjectSlug({ appDir }),
      (e: unknown) => e instanceof CliError && e.code === 'NO_PROJECT',
    );
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('readGlobalConfig tolerates a missing or corrupt config file', () => {
  const appDir = tempAppDir();
  try {
    assert.deepEqual(readGlobalConfig(appDir), {});
    writeFileSync(join(appDir, 'config.json'), '{not json');
    assert.deepEqual(readGlobalConfig(appDir), {});
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});
