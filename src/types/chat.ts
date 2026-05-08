export interface Source {
  title: string;
  url: string;
  similarity: number;
}

export interface RawSource extends Source {
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}
