-- 成都猫狗小院 · 云端公开数据与媒体权限基础
-- 公开访客只能读取已发布的宠物资料和公开媒体；所有管理写操作仍要求管理员身份。

CREATE OR REPLACE FUNCTION public.is_yard_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.yard_administrators
    WHERE auth_uid = auth.uid()::text
      AND active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_yard_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_yard_admin() TO authenticated, service_role;

ALTER TABLE public.yard_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yard_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS yard_settings_public_read ON public.yard_settings;
CREATE POLICY yard_settings_public_read ON public.yard_settings
  FOR SELECT TO anon, authenticated
  USING (key IN ('public_contact', 'application_policy'));

DROP POLICY IF EXISTS pets_public_read ON public.pets;
CREATE POLICY pets_public_read ON public.pets
  FOR SELECT TO anon, authenticated
  USING (is_published = TRUE);

DROP POLICY IF EXISTS pet_media_public_read ON public.pet_media;
CREATE POLICY pet_media_public_read ON public.pet_media
  FOR SELECT TO anon, authenticated
  USING (
    is_public = TRUE
    AND EXISTS (
      SELECT 1 FROM public.pets
      WHERE pets.id = pet_media.pet_id
        AND pets.is_published = TRUE
    )
  );

DROP POLICY IF EXISTS pet_updates_public_read ON public.pet_updates;
CREATE POLICY pet_updates_public_read ON public.pet_updates
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pets
      WHERE pets.id = pet_updates.pet_id
        AND pets.is_published = TRUE
    )
  );

DROP POLICY IF EXISTS yard_administrators_admin_all ON public.yard_administrators;
CREATE POLICY yard_administrators_admin_all ON public.yard_administrators
  FOR ALL TO authenticated
  USING (public.is_yard_admin())
  WITH CHECK (public.is_yard_admin());

DROP POLICY IF EXISTS yard_settings_admin_all ON public.yard_settings;
CREATE POLICY yard_settings_admin_all ON public.yard_settings
  FOR ALL TO authenticated
  USING (public.is_yard_admin())
  WITH CHECK (public.is_yard_admin());

DROP POLICY IF EXISTS pets_admin_all ON public.pets;
CREATE POLICY pets_admin_all ON public.pets
  FOR ALL TO authenticated
  USING (public.is_yard_admin())
  WITH CHECK (public.is_yard_admin());

DROP POLICY IF EXISTS pet_media_admin_all ON public.pet_media;
CREATE POLICY pet_media_admin_all ON public.pet_media
  FOR ALL TO authenticated
  USING (public.is_yard_admin())
  WITH CHECK (public.is_yard_admin());

DROP POLICY IF EXISTS pet_updates_admin_all ON public.pet_updates;
CREATE POLICY pet_updates_admin_all ON public.pet_updates
  FOR ALL TO authenticated
  USING (public.is_yard_admin())
  WITH CHECK (public.is_yard_admin());

DROP POLICY IF EXISTS applications_admin_all ON public.applications;
CREATE POLICY applications_admin_all ON public.applications
  FOR ALL TO authenticated
  USING (public.is_yard_admin())
  WITH CHECK (public.is_yard_admin());

DROP POLICY IF EXISTS application_events_admin_all ON public.application_events;
CREATE POLICY application_events_admin_all ON public.application_events
  FOR ALL TO authenticated
  USING (public.is_yard_admin())
  WITH CHECK (public.is_yard_admin());

DROP POLICY IF EXISTS rate_limit_events_admin_all ON public.rate_limit_events;
CREATE POLICY rate_limit_events_admin_all ON public.rate_limit_events
  FOR ALL TO authenticated
  USING (public.is_yard_admin())
  WITH CHECK (public.is_yard_admin());

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.yard_settings, public.pets, public.pet_media, public.pet_updates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yard_administrators, public.yard_settings, public.pets, public.pet_media, public.pet_updates, public.applications, public.application_events, public.rate_limit_events TO authenticated;
REVOKE ALL ON public.yard_administrators, public.applications, public.application_events, public.rate_limit_events FROM anon;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS yard_media_public_read ON storage.objects;
CREATE POLICY yard_media_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'yard-media');

DROP POLICY IF EXISTS yard_media_admin_insert ON storage.objects;
CREATE POLICY yard_media_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'yard-media' AND public.is_yard_admin());

DROP POLICY IF EXISTS yard_media_admin_update ON storage.objects;
CREATE POLICY yard_media_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'yard-media' AND public.is_yard_admin())
  WITH CHECK (bucket_id = 'yard-media' AND public.is_yard_admin());

DROP POLICY IF EXISTS yard_media_admin_delete ON storage.objects;
CREATE POLICY yard_media_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'yard-media' AND public.is_yard_admin());

GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT SELECT ON storage.objects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

INSERT INTO public.pets (
  id, name, pet_type, adoption_status, gender, age_text, tags,
  description, health, requirements, pause_reason, is_published
)
VALUES
  ('xiaomai', '小麦', '猫咪', '待领养', '母', '约 2 岁', ARRAY['慢热','亲人后黏人','喜欢晒太阳'], '刚到陌生环境时会安静观察，熟悉之后喜欢靠在人身边打盹。', '已完成基础驱虫，精神和食欲稳定；绝育安排请以管理员更新为准。', '默认领养要求：稳定住所、家庭成员同意、做好封窗和安全防护、接受后续回访。小麦希望有一个相对安静的居住环境。', NULL, TRUE),
  ('afu', '阿福', '狗狗', '待领养', '公', '约 3 岁', ARRAY['爱散步','友好','精力充沛'], '看到牵引绳就会开心地原地转圈，是一只很喜欢和人一起出门的狗狗。', '已完成基础驱虫；其余健康、疫苗和绝育信息可由管理员在后台更新。', '默认领养要求：稳定住所、家庭成员同意、出门使用牵引、接受后续回访。阿福需要每天稳定的散步时间。', NULL, TRUE),
  ('huajuan', '花卷', '猫咪', '待领养', '公', '约 1 岁', ARRAY['好奇','会玩','适应力不错'], '对逗猫棒和纸箱没有抵抗力，习惯之后很愿意主动来找人玩。', '已完成基础体外驱虫，更多医疗信息将在档案中持续补充。', '默认领养要求：稳定住所、家庭成员同意、做好封窗和安全防护、接受后续回访。', NULL, TRUE),
  ('yuanbao', '元宝', '猫咪', '已领养', '母', '约 4 岁', ARRAY['已找到家','爱窗台','回访中'], '元宝已经在新家安顿下来。她最喜欢的新习惯，是每天午后守在窗边看楼下的树影。', '已完成领养，后续生活状态将由回访档案持续补充。', '元宝已经找到温暖的家，感谢每一位曾经关注她的人。', NULL, TRUE),
  ('heitang', '黑糖', '狗狗', '暂不适合领养', '母', '约 5 岁', ARRAY['需要恢复','安静陪伴','可预约关注'], '黑糖正在慢慢适应新的环境。她喜欢安静待在人旁边，但目前还需要更多恢复和观察时间。', '当前处于恢复与观察阶段，开放领养时间请以小院后续更新为准。', '如未来开放领养，将优先沟通能够提供稳定、耐心照顾环境的预约人。', '当前仍在恢复与观察中，暂不开放正式领养；可以提前预约关注。', TRUE),
  ('dongzhi', '冬至', '狗狗', '暂不适合领养', '公', '约 2 岁', ARRAY['需要训练','爱吃零食','可预约关注'], '冬至很聪明，也很有自己的主意。目前正在学习更平稳地和陌生人相处。', '身体状态稳定，正在进行日常适应与行为训练。', '如未来开放领养，希望领养人愿意了解并配合持续训练。', '仍在进行行为适应训练，暂不开放正式领养；可以预约关注。', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pet_media (id, pet_id, media_type, external_url, caption, alt_text, is_cover, is_public, sort_order)
VALUES
  ('media_xiaomai_cover', 'xiaomai', 'image', 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1100&q=90', '封面照片', '小麦，猫咪照片', TRUE, TRUE, 0),
  ('media_afu_cover', 'afu', 'image', 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1100&q=90', '封面照片', '阿福，狗狗照片', TRUE, TRUE, 0),
  ('media_huajuan_cover', 'huajuan', 'image', 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=1100&q=90', '封面照片', '花卷，猫咪照片', TRUE, TRUE, 0),
  ('media_yuanbao_cover', 'yuanbao', 'image', 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?auto=format&fit=crop&w=1100&q=90', '封面照片', '元宝，猫咪照片', TRUE, TRUE, 0),
  ('media_heitang_cover', 'heitang', 'image', 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1100&q=90', '封面照片', '黑糖，狗狗照片', TRUE, TRUE, 0),
  ('media_dongzhi_cover', 'dongzhi', 'image', 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1100&q=90', '封面照片', '冬至，狗狗照片', TRUE, TRUE, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pet_updates (id, pet_id, update_date, title, body)
VALUES
  ('update_yuanbao_1', 'yuanbao', CURRENT_DATE - 30, '第一次回访', '新家庭分享了元宝在窗台上打盹的照片。'),
  ('update_yuanbao_2', 'yuanbao', CURRENT_DATE, '一个月后', '开始主动陪家人看电视，也愿意接受梳毛。')
ON CONFLICT (id) DO NOTHING;
