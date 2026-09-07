import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkText } from './chunk.ts';
import { sha256 } from './hash.ts';

test('sha256 is deterministic and hex', () => {
  const a = sha256('hello');
  assert.equal(a, sha256('hello'));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, sha256('hello!'));
});

test('chunkText splits long content into stable chunks with locations', () => {
  const lines: string[] = [];
  for (let i = 1; i <= 60; i++) {
    lines.push(`line ${i}: some content for the loyalty program discount cap`);
  }
  const text = lines.join('\n');
  const chunks = chunkText(text, 'docs/fsd.md', { maxChars: 400, overlap: 40 });
  assert.ok(chunks.length > 1, 'expected multiple chunks');
  const again = chunkText(text, 'docs/fsd.md', { maxChars: 400, overlap: 40 });
  assert.deepEqual(
    chunks.map((c) => c.id),
    again.map((c) => c.id),
  );
  assert.ok(chunks[0]?.location?.startsWith('docs/fsd.md:'));
});

test('chunkText handles short content as a single chunk', () => {
  const chunks = chunkText('short note', 'note.txt');
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.location, 'note.txt:1');
});

test('chunkText normalizes CRLF', () => {
  const chunks = chunkText('a\r\nb\r\nc', 'x.txt');
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.content, 'a\nb\nc');
});
