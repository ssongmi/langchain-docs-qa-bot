'use client';

import { useState, useCallback } from 'react';
import { Message, Source } from '@/types/chat';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useRagChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: Message = { id: generateId(), role: 'user', content };
      const assistantId = generateId();
      const assistantMessage: Message = { id: assistantId, role: 'assistant', content: '' };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage].map(({ role, content }) => ({ role, content })),
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error('Request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6);
            if (raw === '[DONE]') break;

            try {
              const parsed: { type: string; text?: string; sources?: Source[]; error?: string } =
                JSON.parse(raw);

              if (parsed.type === 'sources' && parsed.sources) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, sources: parsed.sources } : m))
                );
              } else if (parsed.type === 'text' && parsed.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + parsed.text } : m
                  )
                );
              } else if (parsed.type === 'error') {
                setError(parsed.error ?? 'Unknown error');
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
