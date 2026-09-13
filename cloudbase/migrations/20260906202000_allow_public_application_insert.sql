-- 访客只能新增申请和限频记录，不能读取、修改或删除申请资料。
DROP POLICY IF EXISTS applications_public_insert ON public.applications;
CREATE POLICY applications_public_insert ON public.applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (internal_status IN ('未处理', '已登记'));

DROP POLICY IF EXISTS rate_limit_events_public_insert ON public.rate_limit_events;
CREATE POLICY rate_limit_events_public_insert ON public.rate_limit_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (event_kind = 'application_submit');

GRANT INSERT ON public.applications, public.rate_limit_events TO anon;
