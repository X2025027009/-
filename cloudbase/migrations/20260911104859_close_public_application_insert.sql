-- 关闭「访客绕过网页直接写数据库」的入口。
--
-- 背景：为了让访客申请能够提交，早期迁移放开过 anon 对 applications /
-- rate_limit_events 的直接 INSERT。前端现在已改为通过 yard-api 云函数提交，
-- 并已在云端完成真实验证，因此可以收回这个入口。
--
-- 重要：云函数走的是 ExecutePGSql 通道（以数据库属主身份执行），
--       不受这里 RLS 策略变更的影响。本迁移只影响「浏览器直连数据库」的访客。
--
-- 注意：applications_public_insert 原本同时授权给 anon 和 authenticated，
--       这意味着任何「已登录但不是管理员」的账号也能插入申请，是一个额外漏洞。
--       删除该策略后，管理员仍由 applications_admin_all 策略授权，权限不变。

DROP POLICY IF EXISTS applications_public_insert ON public.applications;
DROP POLICY IF EXISTS rate_limit_events_public_insert ON public.rate_limit_events;

REVOKE INSERT ON public.applications FROM anon;
REVOKE INSERT ON public.rate_limit_events FROM anon;

-- 公开只读能力（pets / pet_media / pet_updates / yard_settings）保持不变，此处不做改动。
