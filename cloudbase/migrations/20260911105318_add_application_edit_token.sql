-- 申请人「限时修改令牌」：让申请人可以自己在短时间内纠正填错的资料。
--
-- 背景：不能只凭手机号 / 姓名 / 微信号找回修改权限，所以成功提交后由服务端生成一个
-- 不可预测的随机令牌，只显示给提交申请的浏览器。数据库只保存令牌的哈希。
--
-- 安全要点：
--   * 只保存 SHA-256 哈希，绝不保存明文令牌；
--   * 令牌 24 小时后自动失效；
--   * 管理员删除申请后整行消失，令牌立即失效（无需额外清理）；
--   * 匿名访客对 applications 没有任何权限，无法读取或枚举令牌哈希；
--   * 不允许修改意向宠物、申请类型、内部状态和管理员备注（由云函数白名单控制）。

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS edit_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS edit_token_expires_at TIMESTAMPTZ;

-- 按令牌哈希查找时走索引；只索引有令牌的记录。
CREATE INDEX IF NOT EXISTS applications_edit_token_idx
  ON public.applications(edit_token_hash)
  WHERE edit_token_hash IS NOT NULL;

COMMENT ON COLUMN public.applications.edit_token_hash IS '申请人修改令牌的 SHA-256 哈希；明文只在提交时返回一次';
COMMENT ON COLUMN public.applications.edit_token_expires_at IS '修改令牌过期时间，默认提交后 24 小时';
