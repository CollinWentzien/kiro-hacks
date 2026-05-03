-- ============================================================
-- RAG Setup for Food Chain using Supabase + pgvector
-- ============================================================

-- 1. Enable the pgvector extension
create extension if not exists vector with schema extensions;

-- ============================================================
-- 2. Create rag_documents table
--    Stores source documents (e.g. articles, guides, datasets)
-- ============================================================
create table if not exists rag_documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source      text,                        -- URL, filename, or identifier
  metadata    jsonb default '{}'::jsonb,   -- arbitrary key/value pairs
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 3. Create rag_chunks table
--    Stores chunked text with 1536-dim embeddings (OpenAI ada-002)
-- ============================================================
create table if not exists rag_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references rag_documents(id) on delete cascade,
  chunk_index integer not null,            -- order of chunk within document
  content     text not null,              -- raw chunk text
  embedding   vector(1536),               -- OpenAI text-embedding-ada-002
  metadata    jsonb default '{}'::jsonb,  -- e.g. page number, section title
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 4. HNSW index for fast approximate cosine similarity search
-- ============================================================
create index if not exists rag_chunks_embedding_hnsw_idx
  on rag_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ============================================================
-- 5. match_rag_chunks function
--    Returns the top-k most similar chunks for a query embedding
--
--    Parameters:
--      query_embedding  vector(1536)  – the embedded query
--      match_threshold  float         – minimum similarity score (0–1)
--      match_count      int           – max number of results to return
--      filter_metadata  jsonb         – optional metadata filter (pass '{}'
--                                       to skip filtering)
-- ============================================================
create or replace function match_rag_chunks(
  query_embedding  vector(1536),
  match_threshold  float    default 0.7,
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
    -- apply optional metadata filter when provided
    (filter_metadata = '{}'::jsonb or c.metadata @> filter_metadata)
    -- only return chunks above the similarity threshold
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding  -- ascending distance = descending similarity
  limit match_count;
end;
$$;
