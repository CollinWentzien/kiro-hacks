/**
 * ragService.js — Main RAG service (backend only)
 *
 * Orchestrates document ingestion and semantic retrieval using:
 *   - Supabase (rag_documents + rag_chunks tables)
 *   - Ollama embeddings (nomic-embed-text, 768 dims)
 *   - chunkText for splitting
 *
 * Environment variables (optional overrides):
 *   RAG_TOP_K                – number of chunks to retrieve   (default: 8)
 *   RAG_SIMILARITY_THRESHOLD – minimum cosine similarity score (default: 0.65)
 */

import { supabase } from '../lib/supabaseClient.js';
import { createEmbedding } from './embeddings.js';
import { chunkText } from './chunkText.js';

// ── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_TOP_K      = 8;
const DEFAULT_THRESHOLD  = 0.65;

const RAG_TOP_K     = parseInt(process.env.RAG_TOP_K ?? DEFAULT_TOP_K, 10);
const RAG_THRESHOLD = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD ?? DEFAULT_THRESHOLD);

// ── 1. ingestDocument ────────────────────────────────────────────────────────

/**
 * Ingest a document into Supabase for RAG retrieval.
 *
 * Steps:
 *   1. Insert a record into rag_documents
 *   2. Chunk the content
 *   3. Embed each chunk via OpenAI
 *   4. Batch-insert chunks into rag_chunks
 *
 * @param {{
 *   title:    string,
 *   source?:  string,
 *   content:  string,
 *   metadata?: Record<string, unknown>
 * }} params
 *
 * @returns {Promise<{
 *   documentId: string,
 *   chunksInserted: number
 * }>}
 *
 * @throws {Error} On validation failure, embedding error, or DB error.
 */
export async function ingestDocument({ title, source, content, metadata = {} }) {
  // ── Validate ────────────────────────────────────────────────────
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('[ragService.ingestDocument] "title" must be a non-empty string.');
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('[ragService.ingestDocument] "content" must be a non-empty string.');
  }

  // ── Insert document record ──────────────────────────────────────
  const { data: docData, error: docError } = await supabase
    .from('rag_documents')
    .insert({
      title:    title.trim(),
      source:   source ?? null,
      metadata: metadata ?? {},
    })
    .select('id')
    .single();

  if (docError) {
    throw new Error(
      `[ragService.ingestDocument] Failed to insert document "${title}": ${docError.message}`
    );
  }

  const documentId = docData.id;

  // ── Chunk the content ───────────────────────────────────────────
  const chunks = chunkText(content);
  console.log(`      Total chunks:    ${chunks.length}`);

  // ── Embed each chunk and build insert rows ──────────────────────
  const chunkRows = [];

  for (const chunk of chunks) {
    let embedding;
    try {
      embedding = await createEmbedding(chunk.content);
    } catch (embErr) {
      throw new Error(
        `[ragService.ingestDocument] Embedding failed for chunk ${chunk.chunkIndex} ` +
        `of document "${title}": ${embErr.message}`
      );
    }

    // Log chunk length and embedding dimensions for debugging
    console.log(
      `      Chunk ${chunk.chunkIndex}: ${chunk.content.length} chars` +
      ` (~${chunk.tokenCount} tokens) | Embedding length: ${embedding.length}`
    );

    chunkRows.push({
      document_id: documentId,
      chunk_index: chunk.chunkIndex,
      content:     chunk.content,
      embedding,
      metadata: {
        // ── Source provenance ──────────────────────────────────
        source:      source ?? null,       // original filename
        title:       title.trim(),         // human-readable document title
        fileType:    metadata?.fileType ?? null,  // 'md' | 'txt' | 'pdf'
        // ── Chunk position ─────────────────────────────────────
        chunkIndex:  chunk.chunkIndex,
        totalChunks: chunks.length,
        // ── Size info ──────────────────────────────────────────
        tokenCount:  chunk.tokenCount,
        charCount:   chunk.content.length,
        // ── Ingestion timestamp ────────────────────────────────
        ingestedAt:  metadata?.ingestedAt ?? new Date().toISOString(),
      },
    });
  }

  // ── Batch-insert chunks ─────────────────────────────────────────
  const { error: chunkError } = await supabase
    .from('rag_chunks')
    .insert(chunkRows);

  if (chunkError) {
    throw new Error(
      `[ragService.ingestDocument] Failed to insert chunks for document "${title}": ` +
      chunkError.message
    );
  }

  return {
    documentId,
    chunksInserted: chunkRows.length,
  };
}

// ── 2. retrieveRelevantChunks ────────────────────────────────────────────────

/**
 * Retrieve the most semantically similar chunks for a query string.
 *
 * Embeds the query, then calls the match_rag_chunks Supabase RPC function
 * which performs HNSW cosine similarity search.
 *
 * @param {string} query - The user's question or search text.
 * @param {{
 *   topK?:      number,
 *   threshold?: number,
 *   metadata?:  Record<string, unknown>
 * }} [options]
 *
 * @returns {Promise<Array<{
 *   id:          string,
 *   documentId:  string,
 *   chunkIndex:  number,
 *   content:     string,
 *   metadata:    Record<string, unknown>,
 *   similarity:  number
 * }>>}
 *
 * @throws {Error} On empty query, embedding error, or DB error.
 */
export async function retrieveRelevantChunks(query, options = {}) {
  // ── Validate ────────────────────────────────────────────────────
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('[ragService.retrieveRelevantChunks] "query" must be a non-empty string.');
  }

  const topK      = options.topK      ?? RAG_TOP_K;
  const threshold = options.threshold ?? RAG_THRESHOLD;
  const filter    = options.metadata  ?? {};

  // ── Embed the query ─────────────────────────────────────────────
  let queryEmbedding;
  try {
    queryEmbedding = await createEmbedding(query.trim());
  } catch (embErr) {
    throw new Error(
      `[ragService.retrieveRelevantChunks] Failed to embed query: ${embErr.message}`
    );
  }

  // ── Call match_rag_chunks RPC ───────────────────────────────────
  const { data, error } = await supabase.rpc('match_rag_chunks', {
    query_embedding:  queryEmbedding,
    match_threshold:  threshold,
    match_count:      topK,
    filter_metadata:  filter,
  });

  if (error) {
    throw new Error(
      `[ragService.retrieveRelevantChunks] Supabase RPC error: ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    return [];
  }

  // ── Normalise column names to camelCase ─────────────────────────
  return data.map(row => ({
    id:         row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    content:    row.content,
    metadata:   row.metadata ?? {},
    similarity: row.similarity,
  }));
}

// ── 3. buildRagContext ───────────────────────────────────────────────────────

// Threshold below which we consider a chunk "low confidence"
const LOW_SIMILARITY_THRESHOLD = 0.70;

/**
 * Format retrieved chunks into a context string for LLM prompts.
 *
 * Header format per chunk:
 *   [Source: <title> | File: <filename> | Chunk: <n>/<total> | Similarity: <pct>%]
 *
 * Also returns a confidence signal so the orchestrator / LLM coach can
 * decide how to frame the answer.
 *
 * @param {Array<{
 *   content:    string,
 *   chunkIndex: number,
 *   metadata:   Record<string, unknown>,
 *   similarity: number
 * }>} chunks - Output from retrieveRelevantChunks()
 *
 * @returns {string} Formatted context block ready to inject into a prompt.
 */
export function buildRagContext(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return 'NO_CHUNKS_RETRIEVED';
  }

  const allLow = chunks.every(c => c.similarity < LOW_SIMILARITY_THRESHOLD);

  const body = chunks
    .map(chunk => {
      const title      = chunk.metadata?.title      ?? 'Unknown Document';
      const source     = chunk.metadata?.source     ?? null;
      const chunkIdx   = chunk.metadata?.chunkIndex ?? chunk.chunkIndex ?? '?';
      const total      = chunk.metadata?.totalChunks ?? '?';
      const simPct     = typeof chunk.similarity === 'number'
        ? `${(chunk.similarity * 100).toFixed(0)}%`
        : 'n/a';

      // Compact single-line header — easy for the LLM to parse
      const filePart   = source ? ` | File: ${source}` : '';
      const header     = `[Source: ${title}${filePart} | Chunk: ${chunkIdx}/${total} | Similarity: ${simPct}]`;

      return `${header}\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  // Prepend a confidence notice when all results are below the low threshold
  if (allLow) {
    return `NOTE: The knowledge base has limited relevant information for this query (all similarities below ${(LOW_SIMILARITY_THRESHOLD * 100).toFixed(0)}%). Use with caution.\n\n${body}`;
  }

  return body;
}
