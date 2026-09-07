import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeProvider, resolveProviderConfig } from './provider.ts';

test('defaults to openai with sensible model and base url', () => {
  const cfg = resolveProviderConfig({});
  assert.equal(cfg.provider, 'openai');
  assert.equal(cfg.modelId, 'gpt-4o-mini');
  assert.equal(cfg.baseUrl, 'https://api.openai.com/v1');
  assert.equal(cfg.apiKey, null);
});

test('env override wins for base url and key', () => {
  const cfg = resolveProviderConfig({
    OPENAI_BASE_URL: 'https://proxy.example/v1',
    OPENAI_API_KEY: 'sk-test',
  });
  assert.equal(cfg.baseUrl, 'https://proxy.example/v1');
  assert.equal(cfg.apiKey, 'sk-test');
});

test('provider and model overrides apply', () => {
  const cfg = resolveProviderConfig({
    TRACHEX_PROVIDER: 'ollama',
    TRACHEX_MODEL: 'llama3.2',
  });
  assert.equal(cfg.provider, 'ollama');
  assert.equal(cfg.modelId, 'llama3.2');
  assert.equal(cfg.baseUrl, 'http://localhost:11434/v1');
});

test('global config fills gaps when env is absent', () => {
  const cfg = resolveProviderConfig(
    {},
    {
      provider: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      modelId: 'llama3.2',
    },
  );
  assert.equal(cfg.provider, 'ollama');
  assert.equal(cfg.modelId, 'llama3.2');
  assert.equal(cfg.baseUrl, 'http://localhost:11434/v1');
});

test('env override wins over global config', () => {
  const cfg = resolveProviderConfig({ TRACHEX_MODEL: 'env-model' }, { modelId: 'config-model' });
  assert.equal(cfg.modelId, 'env-model');
});

test('normalizeProvider falls back to openai for unknown values', () => {
  assert.equal(normalizeProvider('anthropic'), 'anthropic');
  assert.equal(normalizeProvider('gemini'), 'gemini');
  assert.equal(normalizeProvider('bogus'), 'openai');
  assert.equal(normalizeProvider(undefined), 'openai');
});
