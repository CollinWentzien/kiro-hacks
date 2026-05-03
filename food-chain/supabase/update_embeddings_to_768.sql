-- ============================================================
-- Migration: Switch embedding column from vector(1536) to vector(768)
--
-- Required when switching from OpenAI text-embedding-3-small / ada-002
-- (1536 dims) to Ollama nomic-embed-text (768 dims).
--
-- ⚠️  Run this manually in the Supabase SQL editor BEFORE ingesting.
-- ⚠️  This will DELETE all existing chunk embeddings (truncation is
--     not possible across dimension changes). Re-run npm run rag:ingest
--     afterwards to repopulate.
-- ============================================================

-- 1. Drop the existing HNSW index (required before altering column type)
drop index if exists rag_chunks_embedding_hnsw_idx;

-- 2. Alter the embedding column to 768 dimensions
alter table rag_chunks
  alter column embedding type vector(768);

-- 3. Recreate the HNSW index for cosine similarity with new dimensions
create index rag_chunks_embedding_hnsw_idx
  on rag_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 4. Update the match_rag_chunks function signature to match new dimensions
create or replace function match_rag_chunks(
  query_embedding  vector(768),
  match_threshold  float    default 0.75,
  match_count      int      default 5,
  filter_metadata  jsonb    default '{}'::jsonb
)
returns table (
  id          uuid,
  document_id uuid,
  chunk_index integer,
  content     text,
  metadata    jsonb,
  similarity  float
)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from rag_chunks c
  where
    (filter_metadata = '{}'::jsonb or c.metadata @> filter_metadata)
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;
