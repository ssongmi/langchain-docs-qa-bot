# 🤖 LangChain Docs Q&A Bot

LangChain.js 공식 문서를 기반으로 자연어 질문에 답해주는 RAG(Retrieval-Augmented Generation) 챗봇입니다. 문서 검색이 번거로운 개발자를 위해 만들었습니다.

## ✨ 주요 기능

- 💬 **자연어 Q&A** — LangChain 관련 질문을 한국어로 입력하면 공식 문서를 근거로 답변
- 🔍 **출처 추적** — 답변 하단에 참고한 문서 링크와 유사도 점수 표시
- ⚡ **스트리밍 응답** — Server-Sent Events로 ChatGPT처럼 타이핑 효과 제공
- 📝 **마크다운 렌더링** — 코드 블록, 리스트, 헤더 등 풍부한 포맷 지원
- 💭 **대화 컨텍스트** — 이전 질문을 참고한 후속 질문 가능

## 🏗 시스템 아키텍처

```
[사용자] ──▶ [Next.js 프론트엔드]
                  │
                  ▼
            [/api/chat (SSE)]
                  │
        ┌─────────┴──────────┐
        │   RAG 파이프라인      │
        │ ① 질문 임베딩         │ ◀── Google text-embedding-004
        │ ② 유사 문서 검색      │ ◀── Supabase pgvector
        │ ③ 컨텍스트 조합       │
        │ ④ LLM 답변 생성       │ ◀── Google Gemini 1.5 Flash
        └─────────┬──────────┘
                  ▼
          [실시간 스트리밍 응답]
```

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js Route Handlers, LangChain.js |
| LLM | Google Gemini 1.5 Flash |
| Embedding | Google text-embedding-004 (768-dim) |
| Vector DB | Supabase pgvector |
| 배포 (예정) | Vercel |

## 📁 프로젝트 구조

```
app/
├── src/
│   ├── app/
│   │   ├── api/chat/route.ts     # SSE 스트리밍 RAG API
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ChatInterface.tsx      # 메인 채팅 UI
│   │   ├── MessageBubble.tsx      # 메시지 + 마크다운 렌더링
│   │   └── SourcesAccordion.tsx   # 출처 접기/펼치기
│   ├── hooks/
│   │   └── useRagChat.ts          # SSE 스트림 파싱 커스텀 훅
│   ├── lib/
│   │   ├── rag.ts                 # 벡터 검색 + 프롬프트 빌더
│   │   └── supabase.ts            # Supabase 클라이언트
│   └── types/chat.ts
├── scripts/
│   ├── crawl-docs.ts              # GitHub에서 문서 수집
│   └── ingest.ts                  # 청킹 + 임베딩 + DB 적재
├── supabase/
│   └── schema.sql                 # pgvector 테이블 + RPC 함수
└── data/                          # 크롤링 결과 (gitignored)
```

## 🚀 시작하기

### 1. 사전 준비

- [Node.js](https://nodejs.org) **18.17 이상** (권장: 20.x LTS)
- [Supabase](https://supabase.com) 계정 (무료 티어로 충분)
- [Google AI Studio](https://aistudio.google.com/apikey) API 키 (무료)

### 2. 클론 및 의존성 설치

```bash
git clone https://github.com/ssongmi/langchain-docs-qa-bot.git
cd langchain-docs-qa-bot
npm install --legacy-peer-deps
```

### 3. Supabase 셋업

1. [Supabase 대시보드](https://supabase.com/dashboard)에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 내용을 실행 (RLS 활성화 권장)
3. Project Settings → API에서 다음 3개 값 복사
   - Project URL
   - Publishable key (anon)
   - Secret key (service_role)

### 4. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local`을 편집하여 실제 값 입력:

```env
GOOGLE_API_KEY=your_google_api_key
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxx
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회하므로 클라이언트에 절대 노출되면 안 됩니다.

### 5. 문서 크롤링 + 벡터 DB 적재

```bash
npm run crawl    # LangChain.js 공식 문서 수집 (~10분)
npm run ingest   # 청킹 + 임베딩 + Supabase 저장 (~5-10분)
```

> 💡 GitHub API rate limit이 부담되면 `GITHUB_TOKEN` 환경변수 설정으로 가속 가능

### 6. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속

## 📋 사용 가능한 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run crawl` | LangChain.js 공식 문서 크롤링 |
| `npm run ingest` | 청킹 + 임베딩 + Supabase 저장 |

## 🧠 RAG 파이프라인 상세

### 청킹 전략

`RecursiveCharacterTextSplitter`를 사용하여 의미 단위 보존:

- **chunk size**: 1,000자
- **overlap**: 200자
- **separators**: `\n## ` → `\n### ` → `\n\n` → `\n` → ` ` (마크다운 구조 우선 분할)

### 임베딩 & 검색

- 모델: `text-embedding-004` (768차원)
- 인덱스: `IVFFlat` with cosine similarity (lists=100)
- 기본 top-k: 5, similarity threshold: 0.5

### 프롬프트 구조

검색된 문서를 `<context>` 태그로 감싸 시스템 프롬프트에 주입하여 hallucination을 줄입니다.

## 🗺 로드맵

- [x] **Week 1** — 프로젝트 셋업 · 문서 크롤링 · 벡터 DB 스키마
- [x] **Week 2** — RAG API · 스트리밍 채팅 UI · 출처 표시
- [ ] **Week 3** — 피드백 시스템 · 대화 이력 · 반응형 폴리싱 · Vercel 배포

## 📊 목표 KPI

| 지표 | 목표 |
|------|------|
| 응답 정확도 (👍 비율) | 80% 이상 |
| 평균 응답 시간 | 3초 이내 |
| 검색 관련도 (similarity) | 0.7 이상 |

## 📝 라이센스

MIT
