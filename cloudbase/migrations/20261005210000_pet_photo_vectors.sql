-- 宠物照片向量表：以图搜宠的基础
--
-- 用途：访客上传一张喜欢的猫狗照片，找出站内最像的宠物。
--
-- 维度与类型的选择：
--   kinfra-vl-embedding-2b 固定输出 2048 维。
--   但 pgvector 的 ANN 索引（HNSW/IVFFlat）只支持 **2000 维以内**的 vector 类型，
--   2048 维直接建 vector(2048) 索引会失败。
--   解决办法是用 halfvec（半精度，索引上限 4000 维），代价是极小的精度损失，
--   换来的是能真正走索引检索，而不是每次全表扫描。
--
-- 与文本向量表的关系：
--   多模态模型把文本和图片映射到**同一个向量空间**，
--   但本次只把**照片**放进这张表（照片找照片相似度最可靠）。
--   文本检索仍走 knowledge_chunks，两张表互不干扰。

CREATE TABLE IF NOT EXISTS public.pet_photo_vectors (
  -- 以照片地址为主键：同一张照片重复索引时覆盖，不会堆积
  photo_url    TEXT PRIMARY KEY,
  pet_id       TEXT NOT NULL,
  -- 半精度向量，与 2048 维的模型输出对应
  embedding    halfvec(2048),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW + 余弦距离（halfvec 同样支持 <=> 操作符）
CREATE INDEX IF NOT EXISTS pet_photo_vectors_embedding_idx
  ON public.pet_photo_vectors USING hnsw (embedding halfvec_cosine_ops);

CREATE INDEX IF NOT EXISTS pet_photo_vectors_pet_idx
  ON public.pet_photo_vectors (pet_id);

-- 内部检索结构，不对外开放（客户端没有任何地方需要它）
ALTER TABLE public.pet_photo_vectors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pet_photo_vectors FROM anon, authenticated;
