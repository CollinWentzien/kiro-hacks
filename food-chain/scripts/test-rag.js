/**
 * test-rag.js — RAG retrieval test script
 *
 * Embeds a test query via Ollama and retrieves the most similar chunks
 * from Supabase using the match_rag_chunks RPC function.
 *
 * Usage:
 *   npm run rag:test
 *
 * Prerequisites:
 *   - Ollama running locally (ollama serve)
 *   - nomic-embed-text model pulled (ollama pull nomic-embed-text)
 *   - SQL migration applied (supabase/update_embeddings_to_768.sql)
 *   - At least one document ingested (npm run rag:ingest)
 */

import 'dotenv/config';
import { retrieveRelevantChunks } from '../src/backend/rag/ragService.js';

const TEST_QUERY = 'What native plants are good for dry California gardens?';

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  RAG Retrieval Test');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Query: "${TEST_QUERY}"`);
  console.log('──────────────────────────────────────────────────\n');

  let chunks;
  try {
    chunks = await retrieveRelevantChunks(TEST_QUERY);
  } catch (err) {
    console.error('[test-rag] Retrieval failed:', err.message);
    process.exit(1);
  }

  if (chunks.length === 0) {
    console.warn('[test-rag] No chunks returned above the similarity threshold.');
    console.warn('  • Make sure you have run: npm run rag:ingest');
    console.warn('  • Try lowering RAG_SIMILARITY_THRESHOLD in .env (current default: 0.75)');
    process.exit(0);
  }

  console.log(`  ${chunks.length} chunk(s) retrieved\n`);

  chunks.forEach((chunk, i) => {
    const similarity = typeof chunk.similarity === 'number'
      ? `${(chunk.similarity * 100).toFixed(2)}%`
      : 'n/a';

    console.log(`┌─ Result ${i + 1} ${'─'.repeat(44 - String(i + 1).length)}`);
    console.log(`│  Document ID : ${chunk.documentId}`);
    console.log(`│  Chunk Index : ${chunk.chunkIndex}`);
    console.log(`│  Similarity  : ${similarity}`);
    console.log(`│  Content     :`);
    // Indent each line of the content for readability
    chunk.content
      .split('\n')
      .forEach(line => console.log(`│    ${line}`));
    console.log(`└${'─'.repeat(50)}\n`);
  });

  console.log('══════════════════════════════════════════════════');
  console.log(`  Done. ${chunks.length} result(s) found.`);
  console.log('══════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n[test-rag] Unexpected error:', err);
  process.exit(1);
});
