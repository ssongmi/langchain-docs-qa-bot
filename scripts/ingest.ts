/**
 * raw-docs.json을 읽어 청킹 → 임베딩 → Supabase 저장하는 파이프라인.
 *
 * 사용법: npx ts-node scripts/ingest.ts
 * 필수 환경변수: GOOGLE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { embedDocuments } from "../src/lib/embeddings";

const INPUT_FILE = path.join(process.cwd(), "data", "raw-docs.json");

interface RawDocument {
  path: string;
  content: string;
  url: string;
  title: string;
}

interface DocumentChunk {
  content: string;
  metadata: {
    source: string;
    title: string;
    url: string;
  };
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\n?/, "");
}

async function chunkDocuments(
  rawDocs: RawDocument[]
): Promise<DocumentChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n## ", "\n### ", "\n\n", "\n", " "],
  });

  const chunks: DocumentChunk[] = [];

  for (const doc of rawDocs) {
    const cleanContent = stripFrontmatter(doc.content);
    const texts = await splitter.splitText(cleanContent);

    for (const text of texts) {
      if (text.trim().length < 50) continue;
      chunks.push({
        content: text,
        metadata: {
          source: doc.path,
          title: doc.title,
          url: doc.url,
        },
      });
    }
  }

  return chunks;
}

async function embedAndStore(chunks: DocumentChunk[]): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      realtime: {
        transport: WebSocket as unknown as typeof globalThis.WebSocket,
      },
    }
  );

  const BATCH_SIZE = 50;
  let stored = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    const vectors = await embedDocuments(texts);

    const rows = batch.map((chunk, idx) => ({
      content: chunk.content,
      embedding: vectors[idx],
      metadata: chunk.metadata,
    }));

    const { error } = await supabase.from("documents").insert(rows);

    if (error) {
      throw new Error(`Supabase 저장 실패 (batch ${i}): ${error.message}`);
    }

    stored += batch.length;
    process.stdout.write(`\r저장 완료: ${stored}/${chunks.length}`);

    // Google Embedding API rate limit 방지 (분당 1500 requests)
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n총 ${stored}개 청크 저장 완료`);
}

async function main() {
  console.log("임베딩 파이프라인 시작...");

  const requiredEnvs = [
    "GOOGLE_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  for (const env of requiredEnvs) {
    if (!process.env[env]) {
      throw new Error(`환경변수 누락: ${env}`);
    }
  }

  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(
      `${INPUT_FILE} 파일이 없습니다. 먼저 crawl-docs.ts를 실행하세요.`
    );
  }

  const rawDocs: RawDocument[] = JSON.parse(
    fs.readFileSync(INPUT_FILE, "utf-8")
  );
  console.log(`원본 문서 ${rawDocs.length}개 로드`);

  const chunks = await chunkDocuments(rawDocs);
  console.log(`청킹 완료: ${chunks.length}개 청크`);

  await embedAndStore(chunks);
  console.log("파이프라인 완료");
}

main().catch((err) => {
  console.error("파이프라인 실패:", err);
  process.exit(1);
});
