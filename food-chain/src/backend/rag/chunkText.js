/**
 * chunkText.js — Text chunking utility for RAG ingestion
 *
 * Splits a document into overlapping chunks suitable for embedding.
 * Targets 500–800 tokens per chunk with a ~100-token overlap.
 * Headings (Markdown # / ## / ###) are preserved as the first line
 * of the chunk they introduce.
 *
 * A hard safety limit of SAFE_MAX_CHARS (2 000 chars / ~500 tokens) is
 * enforced on every output chunk. This prevents Ollama context-length
 * errors on dense PDF text that arrives as a single paragraph.
 *
 * Token estimation: ~4 characters per token (GPT-family approximation).
 * No tokenizer dependency required.
 */

// ── Constants ────────────────────────────────────────────────────────────────

const CHARS_PER_TOKEN  = 4;     // rough GPT approximation
const TARGET_MIN_CHARS = 500  * CHARS_PER_TOKEN;  // ~2 000 chars
const TARGET_MAX_CHARS = 800  * CHARS_PER_TOKEN;  // ~3 200 chars
const OVERLAP_CHARS    = 100  * CHARS_PER_TOKEN;  // ~400 chars

// Hard ceiling sent to the embedder — well within nomic-embed-text's limit.
// Any chunk larger than this is split further by splitOversized().
const SAFE_MAX_CHARS   = 2000;  // ~500 tokens

// Matches Markdown headings: # Heading, ## Heading, ### Heading
const HEADING_RE = /^#{1,6}\s+.+$/m;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Estimate token count for a string.
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Hard-split a single oversized string into sub-chunks of at most
 * SAFE_MAX_CHARS characters, breaking on sentence boundaries where
 * possible, otherwise on whitespace, otherwise by character count.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitOversized(text) {
  if (text.length <= SAFE_MAX_CHARS) return [text];

  const results = [];
  // Try to split on sentence endings first (. ! ?) followed by whitespace
  const sentenceRe = /(?<=[.!?])\s+/g;
  const sentences  = text.split(sentenceRe).filter(s => s.trim().length > 0);

  let buffer = '';
  for (const sentence of sentences) {
    // If a single sentence is itself oversized, split it by words
    if (sentence.length > SAFE_MAX_CHARS) {
      if (buffer.trim()) { results.push(buffer.trim()); buffer = ''; }
      const words = sentence.split(/\s+/);
      let wordBuf = '';
      for (const word of words) {
        if ((wordBuf + ' ' + word).trim().length > SAFE_MAX_CHARS) {
          if (wordBuf.trim()) results.push(wordBuf.trim());
          wordBuf = word;
        } else {
          wordBuf = wordBuf ? wordBuf + ' ' + word : word;
        }
      }
      if (wordBuf.trim()) buffer = wordBuf.trim();
      continue;
    }

    const candidate = buffer ? buffer + ' ' + sentence : sentence;
    if (candidate.length > SAFE_MAX_CHARS) {
      if (buffer.trim()) results.push(buffer.trim());
      buffer = sentence;
    } else {
      buffer = candidate;
    }
  }
  if (buffer.trim()) results.push(buffer.trim());

  return results.length > 0 ? results : [text.slice(0, SAFE_MAX_CHARS)];
}

/**
 * Apply splitOversized to every chunk in an array and re-index.
 * @param {{ content: string, chunkIndex: number, tokenCount: number }[]} chunks
 * @returns {{ content: string, chunkIndex: number, tokenCount: number }[]}
 */
function enforceSafeLimit(chunks) {
  const safe = [];
  for (const chunk of chunks) {
    if (chunk.content.length <= SAFE_MAX_CHARS) {
      safe.push(chunk);
    } else {
      const parts = splitOversized(chunk.content);
      for (const part of parts) {
        safe.push({
          content:    part,
          chunkIndex: safe.length,   // re-indexed below
          tokenCount: estimateTokens(part),
        });
      }
    }
  }
  // Re-index sequentially
  return safe.map((c, i) => ({ ...c, chunkIndex: i }));
}

/**
 * Split text into paragraphs, keeping headings as standalone units
 * so they can be attached to the chunk that follows them.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoParagraphs(text) {
  // Split on one or more blank lines
  const rawParagraphs = text.split(/\n{2,}/);
  const paragraphs = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // If a paragraph contains a heading mid-way, split it out
    const lines = trimmed.split('\n');
    let buffer = [];

    for (const line of lines) {
      if (HEADING_RE.test(line) && buffer.length > 0) {
        // Flush buffered lines before the heading
        paragraphs.push(buffer.join('\n'));
        buffer = [line];
      } else {
        buffer.push(line);
      }
    }

    if (buffer.length > 0) {
      paragraphs.push(buffer.join('\n'));
    }
  }

  return paragraphs;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Split document content into overlapping chunks for RAG embedding.
 *
 * @param {string} content - Raw document text (plain text or Markdown).
 * @returns {{ content: string, chunkIndex: number, tokenCount: number }[]}
 * @throws {Error} If content is empty or not a string.
 */
export function chunkText(content) {
  // ── Validate input ────────────────────────────────────────────────
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error(
      '[chunkText] content must be a non-empty string. ' +
      `Received: ${JSON.stringify(content)}`
    );
  }

  const paragraphs = splitIntoParagraphs(content.trim());

  // Edge case: single paragraph — may still be oversized (e.g. dense PDF text),
  // so run it through the safety splitter rather than returning as-is.
  if (paragraphs.length === 1) {
    const text = paragraphs[0];
    const raw  = [{ content: text, chunkIndex: 0, tokenCount: estimateTokens(text) }];
    return enforceSafeLimit(raw);
  }

  const chunks = [];
  let currentChars = 0;
  let currentParagraphs = [];
  // Track the last heading seen so it can be prepended to the next chunk
  let pendingHeading = null;

  /**
   * Flush the current paragraph buffer into a chunk.
   */
  function flushChunk() {
    if (currentParagraphs.length === 0) return;

    const text = currentParagraphs.join('\n\n').trim();
    if (!text) return;

    chunks.push({
      content: text,
      chunkIndex: chunks.length,
      tokenCount: estimateTokens(text),
    });
  }

  /**
   * Build the overlap prefix from the tail of the current buffer.
   * Walks backwards through paragraphs until we have ~OVERLAP_CHARS.
   * @returns {string[]}
   */
  function buildOverlapParagraphs() {
    const overlap = [];
    let overlapChars = 0;

    for (let i = currentParagraphs.length - 1; i >= 0; i--) {
      const p = currentParagraphs[i];
      if (overlapChars + p.length > OVERLAP_CHARS && overlap.length > 0) break;
      overlap.unshift(p);
      overlapChars += p.length;
      if (overlapChars >= OVERLAP_CHARS) break;
    }

    return overlap;
  }

  for (const para of paragraphs) {
    const isHeading = HEADING_RE.test(para);

    // If this paragraph is a heading, save it and continue — it will be
    // prepended to the next chunk so context is preserved.
    if (isHeading) {
      pendingHeading = para;
      // Still add it to the current buffer so it appears in the current chunk
      currentParagraphs.push(para);
      currentChars += para.length;
      continue;
    }

    const paraChars = para.length;

    // If adding this paragraph would exceed the max, flush first
    if (currentChars + paraChars > TARGET_MAX_CHARS && currentChars >= TARGET_MIN_CHARS) {
      flushChunk();

      // Start next chunk with overlap + pending heading (if any)
      const overlapParas = buildOverlapParagraphs();
      currentParagraphs = [];
      currentChars = 0;

      // Re-attach the last heading so the new chunk has context
      if (pendingHeading && !overlapParas.includes(pendingHeading)) {
        currentParagraphs.push(pendingHeading);
        currentChars += pendingHeading.length;
      }

      for (const op of overlapParas) {
        currentParagraphs.push(op);
        currentChars += op.length;
      }
    }

    currentParagraphs.push(para);
    currentChars += paraChars;

    // Update pending heading only when we encounter a new one
    if (!isHeading) {
      // Non-heading paragraph — clear pending heading after it's been used
      pendingHeading = null;
    }
  }

  // Flush any remaining paragraphs
  flushChunk();

  // Apply hard safety limit, then re-index
  return enforceSafeLimit(chunks);
}
