/**
 * Direct HTTP wrapper for Google's Gemini embedding API.
 *
 * The @langchain/google-genai wrapper doesn't expose outputDimensionality,
 * so we call the REST endpoint directly to get 768-dim vectors that match
 * our pgvector(768) schema.
 */

const MODEL = 'gemini-embedding-001';
const EMBED_DIM = 768;
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type TaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';

function apiKey(): string {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY is not set');
  return key;
}

export async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch(
    `${API_BASE}/models/${MODEL}:embedContent?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIM,
        taskType: 'RETRIEVAL_QUERY' as TaskType,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Embed query failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const res = await fetch(
    `${API_BASE}/models/${MODEL}:batchEmbedContents?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBED_DIM,
          taskType: 'RETRIEVAL_DOCUMENT' as TaskType,
        })),
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Batch embed failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    embeddings: { values: number[] }[];
  };
  return data.embeddings.map((e) => e.values);
}
