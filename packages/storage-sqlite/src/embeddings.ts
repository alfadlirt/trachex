import type { VectorEmbedder } from '@trachex/domain';

/** Anvia owns the model selection; this adapter only asks it for its default. */
export async function loadLocalEmbedder(): Promise<VectorEmbedder> {
  const packageName = '@anvia/transformers';
  const module = (await import(packageName)) as {
    loadTransformersEmbeddingModel?: () => Promise<{
      embedTexts(texts: string[]): Promise<Array<{ vector: number[] }>>;
    }>;
  };
  if (!module.loadTransformersEmbeddingModel) {
    throw new Error('Anvia transformers embedding loader is unavailable');
  }
  return module.loadTransformersEmbeddingModel();
}

export function createLazyLocalEmbedder(): VectorEmbedder {
  let pending: Promise<VectorEmbedder> | undefined;
  const load = () => (pending ??= loadLocalEmbedder());
  return {
    async embedTexts(texts) {
      return (await load()).embedTexts(texts);
    },
  };
}
