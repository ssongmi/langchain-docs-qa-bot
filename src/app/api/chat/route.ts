import { NextRequest } from 'next/server';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { retrieveDocuments, buildSystemPrompt } from '@/lib/rag';
import { Message, Source } from '@/types/chat';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: Message[] } = await req.json();
    const lastMessage = messages.at(-1);

    if (!lastMessage?.content) {
      return Response.json({ error: 'No message content' }, { status: 400 });
    }

    const rawSources = await retrieveDocuments(lastMessage.content);
    const systemPrompt = buildSystemPrompt(rawSources);
    const sources: Source[] = rawSources.map(({ title, url, similarity }) => ({
      title,
      url,
      similarity,
    }));

    const history = messages.slice(0, -1).map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    const llm = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY!,
      model: 'gemini-1.5-flash',
      streaming: true,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

        send({ type: 'sources', sources });

        try {
          const llmStream = await llm.stream([
            new SystemMessage(systemPrompt),
            ...history,
            new HumanMessage(lastMessage.content),
          ]);

          for await (const chunk of llmStream) {
            const text = typeof chunk.content === 'string' ? chunk.content : '';
            if (text) send({ type: 'text', text });
          }
        } catch (err) {
          console.error('LLM stream error:', err);
          send({ type: 'error', error: 'Generation failed. Please try again.' });
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
