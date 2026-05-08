import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RawSource } from '@/types/chat';
import { createSupabaseAdminClient } from './supabase';

export async function retrieveDocuments(query: string, k = 5): Promise<RawSource[]> {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY!,
    modelName: 'text-embedding-004',
  });

  const queryVector = await embeddings.embedQuery(query);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryVector,
    match_count: k,
    match_threshold: 0.5,
  });

  if (error) throw new Error(`Vector search failed: ${error.message}`);

  return (data ?? []).map((row: {
    metadata: { title?: string; url?: string };
    content: string;
    similarity: number;
  }) => ({
    title: row.metadata?.title ?? 'Unknown',
    url: row.metadata?.url ?? '',
    content: row.content,
    similarity: row.similarity,
  }));
}

export function buildSystemPrompt(sources: RawSource[]): string {
  const context = sources
    .map((s, i) => `[Document ${i + 1}: ${s.title}]\n${s.content}`)
    .join('\n\n---\n\n');

  return `You are a helpful LangChain.js documentation assistant. Answer questions concisely and accurately based on the provided documentation context.

If the answer cannot be found in the provided context, say so clearly.
Always format code examples in markdown code blocks with the appropriate language tag.

<context>
${context}
</context>`;
}
