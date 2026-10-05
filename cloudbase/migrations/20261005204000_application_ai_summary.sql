-- AI 审核摘要的持久化
--
-- 背景：初版把摘要算完就丢，每次打开申请都要重新生成。
-- 代价不只是多花钱调模型——重新生成要十几秒，管理员来回切几次页面
-- 就要重复等几次，而且摘要本身是有价值的判断记录，丢了可惜。
--
-- 三个字段的分工：
--   ai_summary                   完整的摘要结果（含结论、核对项、追问建议、审核过程）
--   ai_summary_at                生成时间
--   ai_summary_source_updated_at 生成时这条申请的 updated_at
--
-- 第三个字段是"新鲜度"的判据：申请资料被改过（含管理员代申请人更正）之后，
-- 原摘要的依据就变了，界面应当提示重新生成，而不是继续显示旧结论。

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ai_summary JSONB,
  ADD COLUMN IF NOT EXISTS ai_summary_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_summary_source_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.applications.ai_summary IS 'AI 审核摘要（管理员侧生成，含审核过程）';
COMMENT ON COLUMN public.applications.ai_summary_at IS '摘要生成时间';
COMMENT ON COLUMN public.applications.ai_summary_source_updated_at IS '生成摘要时该申请的 updated_at，用于判断摘要是否已过期';
