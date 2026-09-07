import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectDir, sourcesDir, trachexAppDir } from './paths.ts';

test('TRACHEX_HOME overrides platform resolution', () => {
  assert.equal(trachexAppDir({ TRACHEX_HOME: '/tmp/tx' }), '/tmp/tx');
});

test('darwin app dir', () => {
  const dir = trachexAppDir({ HOME: '/Users/me', platform: 'darwin' });
  assert.equal(dir, '/Users/me/Library/Application Support/trachex');
});

test('linux app dir uses XDG_DATA_HOME', () => {
  const dir = trachexAppDir({ XDG_DATA_HOME: '/xdg', platform: 'linux' });
  assert.equal(dir, '/xdg/trachex');
});

test('linux app dir falls back to ~/.local/share', () => {
  const dir = trachexAppDir({ HOME: '/home/u', platform: 'linux' });
  assert.equal(dir, '/home/u/.local/share/trachex');
});

test('win32 app dir uses APPDATA', () => {
  const dir = trachexAppDir({ APPDATA: 'C:\\AppData', platform: 'win32' });
  assert.ok(dir.startsWith('C:\\AppData'));
  assert.ok(dir.endsWith('trachex'));
});

test('project dir nests under projects/<id>', () => {
  assert.equal(projectDir('/app', 'p1'), '/app/projects/p1');
  assert.equal(sourcesDir('/app', 'p1'), '/app/projects/p1/sources');
});
