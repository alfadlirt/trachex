export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface ProviderConfig {
  provider: ProviderName;
  baseUrl: string;
  apiKey: string | null;
  modelId: string;
}

export interface ProviderEnv {
  TRACHEX_PROVIDER?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  TRACHEX_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-1.5-flash',
  ollama: 'llama3.1',
};

const DEFAULT_BASE_URLS: Record<ProviderName, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  ollama: 'http://localhost:11434/v1',
};

export function normalizeProvider(value: string | undefined): ProviderName {
  const v = (value ?? 'openai').trim().toLowerCase();
  switch (v) {
    case 'anthropic':
    case 'gemini':
    case 'ollama':
      return v;
    default:
      return 'openai';
  }
}

export interface GlobalConfig {
  provider?: ProviderName;
  baseUrl?: string;
  modelId?: string;
}

export function resolveProviderConfig(
  env: ProviderEnv = process.env,
  globalConfig: GlobalConfig = {},
): ProviderConfig {
  const provider = normalizeProvider(env.TRACHEX_PROVIDER ?? globalConfig.provider);
  const baseUrl =
    env.OPENAI_BASE_URL?.trim() || globalConfig.baseUrl || DEFAULT_BASE_URLS[provider];
  const apiKey =
    env.OPENAI_API_KEY?.trim() ||
    (provider === 'anthropic' ? env.ANTHROPIC_API_KEY?.trim() : undefined) ||
    (provider === 'gemini' ? env.GEMINI_API_KEY?.trim() : undefined) ||
    null;
  const modelId = env.TRACHEX_MODEL?.trim() || globalConfig.modelId || DEFAULT_MODELS[provider];
  return { provider, baseUrl, apiKey, modelId };
}

export interface KeychainProfile {
  name: string;
  provider: ProviderName;
  apiKey: string;
}

export async function loadKeychainProfile(_name: string): Promise<KeychainProfile | null> {
  return null;
}
