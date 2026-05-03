/**
 * embeddings.js — Ollama embedding utility (backend only)
 *
 * Creates a vector embedding for a given text string using a locally
 * running Ollama instance. No API key required.
 *
 * Optional environment variables:
 *   OLLAMA_BASE_URL        – defaults to "http://localhost:11434"
 *   OLLAMA_EMBEDDING_MODEL – defaults to "nomic-embed-text" (768 dims)
 *
 * nomic-embed-text produces 768-dimensional vectors.
 * Ensure your rag_chunks.embedding column is vector(768) — run the
 * migration at supabase/update_embeddings_to_768.sql if needed.
 */

/**
 * Create a vector embedding for the given text via Ollama.
 *
 * @param {string} text - The text to embed. Must be a non-empty string.
 * @returns {Promise<number[]>} The embedding vector as an array of floats.
 * @throws {Error} If text is empty, Ollama is unreachable, or the response is invalid.
 */
export async function createEmbedding(text) {
  // ── Validate input ──────────────────────────────────────────────
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error(
      '[embeddings] createEmbedding() requires a non-empty string. ' +
      `Received: ${JSON.stringify(text)}`
    );
  }

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model   = process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text';
  const url     = `${baseUrl}/api/embeddings`;

  // ── Call Ollama Embeddings API ──────────────────────────────────
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text.trim(),
      }),
    });
  } catch (networkError) {
    throw new Error(
      `[embeddings] Could not reach Ollama at ${baseUrl}. ` +
      `Is Ollama running? (ollama serve)\n` +
      `Network error: ${networkError.message}`
    );
  }

  // ── Handle non-2xx responses ────────────────────────────────────
  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.error) errorDetail = body.error;
    } catch {
      // ignore JSON parse failure — use the status text
    }
    throw new Error(`[embeddings] Ollama API error: ${errorDetail}`);
  }

  // ── Parse and return the embedding vector ───────────────────────
  const data = await response.json();
  const embedding = data?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(
      '[embeddings] Unexpected response shape from Ollama API. ' +
      `Expected { embedding: number[] }, got: ${JSON.stringify(data)}`
    );
  }

  return embedding;
}
