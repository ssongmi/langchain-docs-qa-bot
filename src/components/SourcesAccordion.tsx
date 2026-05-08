'use client';

import { useState } from 'react';
import { Source } from '@/types/chat';

interface SourcesAccordionProps {
  sources: Source[];
}

export function SourcesAccordion({ sources }: SourcesAccordionProps) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-gray-600 font-medium">
          참고 문서 ({sources.length}개)
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul className="divide-y divide-gray-100">
          {sources.map((source, i) => (
            <li key={i} className="px-3 py-2 flex items-start gap-2 bg-white">
              <span className="mt-0.5 text-xs font-mono text-gray-400 shrink-0">
                {(source.similarity * 100).toFixed(0)}%
              </span>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
                title={source.url}
              >
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
