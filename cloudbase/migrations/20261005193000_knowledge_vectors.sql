-- 知识向量表：RAG 检索的基础
--
-- 背景：改造前 AI 只能"按条件精确匹配"（种类/性别/关键词），
-- 访客说「想找一只安静的猫」这种描述性需求，关键词匹配不到就返回空。
-- 这里把宠物档案、领养政策、回访记录都转成向量，改成语义检索。
--
-- 维度说明：TokenHub 的 kinfra-text-embedding-0.6b 固定输出 1024 维。
-- 选它而不是 4b（2560 维）的原因：pgvector 的 ANN 索引只支持 2000 维以内，
-- 2560 维建不了 HNSW 索引，只能全表精确扫描——规模一大反而更慢。
-- 1024 维既够用又能建索引。

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  -- 稳定主键：同一来源重新索引时覆盖而不是追加，避免重复堆积
  id           TEXT PRIMARY KEY,
  -- pet | policy | follow_up
  source_type  TEXT NOT NULL,
  -- 宠物 id / 设置 key / 回访记录 id，用于回溯
  source_id    TEXT,
  -- 展示给管理员和访客看的来源标签，例如「喜豆的档案」
  source_label TEXT NOT NULL,
  -- 原始文本，检索命中后交给模型的就是它
  content      TEXT NOT NULL,
  -- 向量；重建索引前可以为空
  embedding    vector(1024),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW + 余弦距离：查询用的是 <=> 操作符
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS knowledge_chunks_source_idx
  ON public.knowledge_chunks (source_type, source_id);

-- ── 访问控制 ────────────────────────────────────────────────
-- 向量表**不对外开放**：里面虽然有公开档案，但它是内部检索结构，
-- 没有理由让客户端直接读到（也没有任何前端代码需要它）。
--
-- 开启 RLS 且**不建任何策略** = 谁都读不到；云函数走 ExecutePGSql
-- 特权通道，以表属主身份执行，不受 RLS 限制。
-- 再显式回收授权，防止将来有人误加 GRANT 把它暴露出去。
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.knowledge_chunks FROM anon, authenticated;
