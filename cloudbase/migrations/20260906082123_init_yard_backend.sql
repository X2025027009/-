-- 成都猫狗小院 · 正式后台数据结构
-- 仅保存必要的宠物、媒体、申请与管理员数据。

CREATE TABLE IF NOT EXISTS public.yard_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.yard_administrators (
  auth_uid TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pet_type TEXT NOT NULL CHECK (pet_type IN ('猫咪','狗狗')),
  adoption_status TEXT NOT NULL CHECK (adoption_status IN ('待领养','已领养','暂不适合领养')),
  gender TEXT NOT NULL CHECK (gender IN ('公','母')),
  age_text TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  description TEXT NOT NULL,
  health TEXT NOT NULL,
  requirements TEXT NOT NULL,
  pause_reason TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pet_media (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  storage_path TEXT,
  external_url TEXT,
  caption TEXT,
  alt_text TEXT,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pet_media_location CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_cover_media_per_pet
  ON public.pet_media(pet_id) WHERE is_cover = TRUE;
CREATE INDEX IF NOT EXISTS pet_media_listing_idx
  ON public.pet_media(pet_id, is_public DESC, sort_order ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS public.pet_updates (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pet_updates_listing_idx
  ON public.pet_updates(pet_id, update_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.applications (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES public.pets(id),
  application_type TEXT NOT NULL CHECK (application_type IN ('正式领养申请','预约申请')),
  applicant_name TEXT NOT NULL,
  applicant_age INTEGER NOT NULL CHECK (applicant_age BETWEEN 18 AND 100),
  applicant_gender TEXT NOT NULL,
  contact TEXT NOT NULL,
  contact_normalized TEXT NOT NULL,
  has_chengdu_home BOOLEAN NOT NULL,
  experience TEXT NOT NULL,
  family_agreement TEXT NOT NULL,
  other_pets TEXT NOT NULL,
  note TEXT,
  internal_status TEXT NOT NULL DEFAULT '未处理',
  internal_note TEXT,
  source_ip_hash TEXT,
  browser_token_hash TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS applications_inbox_idx
  ON public.applications(internal_status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS applications_duplicate_idx
  ON public.applications(pet_id, contact_normalized, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.application_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_uid TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id TEXT PRIMARY KEY,
  event_kind TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rate_limit_lookup_idx
  ON public.rate_limit_events(event_kind, key_hash, created_at DESC);

-- CloudBase PostgreSQL 媒体桶：照片和短视频会保存在这里，而非静态网站文件夹。
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'yard-media',
  'yard-media',
  TRUE,
  62914560,
  ARRAY['image/jpeg','image/png','image/webp','video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = NOW();

-- 默认公开联系信息，可由后台管理员修改。
INSERT INTO public.yard_settings(key, value)
VALUES
  ('public_contact', '{"phone":"待管理员设置","wechat":"待管理员设置","hours":"建议提前预约","area":"四川省成都市","intro":"成都猫狗小院为流浪猫狗提供暂时的安全角落，也为愿意负责的人留下一条认识它们的路。"}'::jsonb),
  ('application_policy', '{"privacy_notice":"你提交的信息仅用于成都猫狗小院的领养沟通与审核，仅限管理员查看，不会公开展示。","retention_days":180}'::jsonb)
ON CONFLICT (key) DO NOTHING;

