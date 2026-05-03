/**
 * ingest-rag.js — RAG ingestion script
 *
 * Reads all .md, .txt, and .pdf files from the knowledge-base/ folder,
 * chunks and embeds each one, then stores them in Supabase via ragService.
 *
 * Usage:
 *   npm run rag:ingest
 *
 * The script loads .env automatically so Vite does not need to be running.
 */

import 'dotenv/config';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// pdf-parse is a CommonJS module — use createRequire for ESM compatibility
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { ingestDocument } from '../src/backend/rag/ragService.js';

// ── Resolve paths ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// knowledge-base/ lives at the project root (sibling of scripts/)
const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, '..', 'knowledge-base');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Return all .md, .txt, and .pdf files in a directory (non-recursive).
 * @param {string} dir
 * @returns {string[]} absolute file paths
 */
function getKnowledgeFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`\n[ingest-rag] knowledge-base/ folder not found at:\n  ${dir}`);
    console.error('Create the folder and add .md, .txt, or .pdf files to it, then re-run.\n');
    process.exit(1);
  }

  return fs
    .readdirSync(dir)
    .filter(name => /\.(md|txt|pdf)$/i.test(name))
    .map(name => path.join(dir, name));
}

/**
 * Derive a human-readable title from a filename.
 * e.g. "companion-planting-basics.md" → "Companion Planting Basics"
 * @param {string} filePath
 * @returns {string}
 */
function titleFromFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Clean raw text extracted from a PDF.
 * - Collapses runs of 3+ newlines into two (paragraph break)
 * - Collapses runs of spaces/tabs into a single space per line
 * - Removes lines that are only whitespace or page-number artifacts
 * @param {string} raw
 * @returns {string}
 */
function cleanPdfText(raw) {
  return raw
    // Normalise Windows line endings
    .replace(/\r\n/g, '\n')
    // Collapse 3+ consecutive newlines → double newline (paragraph break)
    .replace(/\n{3,}/g, '\n\n')
    // Collapse multiple spaces/tabs within a line → single space
    .replace(/[ \t]{2,}/g, ' ')
    // Remove lines that are purely whitespace
    .split('\n')
    .filter(line => line.trim().length > 0)
    .join('\n')
    .trim();
}

/**
 * Read a plain-text file (.md or .txt) and return its content.
 * @param {string} filePath
 * @returns {string}
 */
function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Read a PDF file and return extracted, cleaned text.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readPdfFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data   = await pdfParse(buffer);
  return cleanPdfText(data.text);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const files = getKnowledgeFiles(KNOWLEDGE_BASE_DIR);

  if (files.length === 0) {
    console.warn('[ingest-rag] No .md, .txt, or .pdf files found in knowledge-base/. Nothing to ingest.');
    process.exit(0);
  }

  console.log(`\n[ingest-rag] Found ${files.length} file(s) in knowledge-base/\n`);

  let successCount = 0;
  let skipCount    = 0;
  let errorCount   = 0;

  for (const filePath of files) {
    const filename  = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const title     = titleFromFilename(filePath);
    const isPdf     = extension === '.pdf';

    // ── Extract content ─────────────────────────────────────────────
    let content;
    try {
      if (isPdf) {
        content = await readPdfFile(filePath);
        console.log(`  📄 [${filename}] PDF extracted — text length: ${content.length} chars`);
      } else {
        content = readTextFile(filePath);
      }
    } catch (readErr) {
      console.error(`  ✗ [${filename}] ${isPdf ? 'PDF extraction' : 'Read'} failed: ${readErr.message}`);
      errorCount++;
      continue;
    }

    // ── Skip empty files ────────────────────────────────────────────
    if (!content || content.trim().length === 0) {
      console.warn(`  ⚠ [${filename}] Skipped — ${isPdf ? 'extracted text is' : 'file is'} empty.`);
      skipCount++;
      continue;
    }

    // ── Ingest ──────────────────────────────────────────────────────
    try {
      const result = await ingestDocument({
        title,
        source:   filename,
        content,
        metadata: {
          filename,
          fileType:   extension.replace('.', ''),
          ingestedAt: new Date().toISOString(),
        },
      });

      console.log(
        `  ✓ [${filename}]\n` +
        `      Title:           ${title}\n` +
        `      Document ID:     ${result.documentId}\n` +
        `      Chunks created:  ${result.chunksInserted}\n` +
        `      Embedding model: ${process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text'}`
      );
      successCount++;
    } catch (ingestErr) {
      console.error(`  ✗ [${filename}] Ingestion failed: ${ingestErr.message}`);
      errorCount++;
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log('[ingest-rag] Done.');
  console.log(`  Ingested: ${successCount}`);
  if (skipCount  > 0) console.log(`  Skipped:  ${skipCount}`);
  if (errorCount > 0) console.log(`  Errors:   ${errorCount}`);
  console.log('─────────────────────────────────────────\n');

  if (errorCount > 0) process.exit(1);
}

main().catch(err => {
  console.error('\n[ingest-rag] Unexpected error:', err);
  process.exit(1);
});
