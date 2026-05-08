-- pgvector 확장 활성화
create extension if not exists vector;

-- 문서 청크 테이블
create table documents (
  id bigserial primary key,
  content text not null,
  embedding vector(768),  -- text-embedding-004 는 768차원
  metadata jsonb,         -- { source, title, url, section }
  created_at timestamptz default now()
);

-- 유사도 검색을 위한 IVFFlat 인덱스
create index on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 피드백 테이블
create table feedback (
  id bigserial primary key,
  session_id text not null,
  message_id text not null,
  vote smallint not null check (vote in (1, -1)),
  query text,
  answer text,
  sources jsonb,
  created_at timestamptz default now()
);

-- 유사도 검색 함수
create or replace function match_documents (
  query_embedding vector(768),
  match_count int default 5,
  match_threshold float default 0.5
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by (documents.embedding <=> query_embedding) asc
  limit match_count;
$$;
