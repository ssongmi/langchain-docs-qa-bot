/**
 * LangChain 공식 GitHub 레포에서 Markdown 문서를 가져와
 * JSON 파일로 저장하는 크롤링 스크립트.
 *
 * 사용법: npx ts-node scripts/crawl-docs.ts
 *
 * GitHub API rate limit: 인증 없이 60req/h, 토큰 있으면 5000req/h
 * GITHUB_TOKEN 환경변수를 설정하면 훨씬 빠르게 동작합니다.
 */

import * as fs from "fs";
import * as path from "path";

const GITHUB_API_BASE = "https://api.github.com";
const REPO_OWNER = "langchain-ai";
const REPO_NAME = "docs";
const DOCS_PATHS = [
  "src/oss/concepts",
  "src/oss/langchain",
  "src/oss/langgraph",
  "src/oss/javascript",
];
const OUTPUT_FILE = path.join(process.cwd(), "data", "raw-docs.json");

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
  html_url: string;
}

interface RawDocument {
  path: string;
  content: string;
  url: string;
  title: string;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "langchain-docs-bot",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchDirectoryContents(dirPath: string): Promise<GitHubFile[]> {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${dirPath}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error(`GitHub API 오류 ${res.status}: ${url}`);
  }

  return res.json() as Promise<GitHubFile[]>;
}

async function fetchFileContent(downloadUrl: string): Promise<string> {
  const res = await fetch(downloadUrl, { headers: getHeaders() });
  if (!res.ok) throw new Error(`파일 다운로드 실패: ${downloadUrl}`);
  return res.text();
}

function extractTitle(content: string, filePath: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  const frontmatterTitle = content.match(/^---[\s\S]*?title:\s*["']?(.+?)["']?\s*$/m);
  if (frontmatterTitle) return frontmatterTitle[1].trim();

  return path.basename(filePath, path.extname(filePath));
}

function filePathToUrl(filePath: string): string {
  const relative = filePath.replace(/^src\//, "").replace(/\.mdx?$/, "");
  return `https://docs.langchain.com/${relative}`;
}

async function crawlDirectory(
  dirPath: string,
  documents: RawDocument[],
  depth = 0
): Promise<void> {
  if (depth > 5) return;

  const files = await fetchDirectoryContents(dirPath);
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const file of files) {
    if (file.type === "dir") {
      await crawlDirectory(file.path, documents, depth + 1);
      continue;
    }

    if (!/\.mdx?$/.test(file.name)) continue;
    if (!file.download_url) continue;

    try {
      const content = await fetchFileContent(file.download_url);
      documents.push({
        path: file.path,
        content,
        url: filePathToUrl(file.path),
        title: extractTitle(content, file.path),
      });
      process.stdout.write(`\r수집된 문서: ${documents.length}`);
      await delay(100); // rate limit 방지
    } catch (err) {
      console.error(`\n파일 수집 실패: ${file.path}`, err);
    }
  }
}

async function main() {
  console.log("LangChain.js 문서 크롤링 시작...");

  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      "⚠️  GITHUB_TOKEN이 없습니다. rate limit으로 느릴 수 있습니다."
    );
  }

  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const documents: RawDocument[] = [];

  for (const docsPath of DOCS_PATHS) {
    await crawlDirectory(docsPath, documents);
  }

  console.log(`\n총 ${documents.length}개 문서 수집 완료`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(documents, null, 2), "utf-8");
  console.log(`저장 완료: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("크롤링 실패:", err);
  process.exit(1);
});
