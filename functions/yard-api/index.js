const crypto = require('node:crypto');
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const allowedStatuses = new Set(['未处理', '沟通中', '已通过', '已登记', '等待宠物开放', '已通知', '已转为正式领养申请', '暂不考虑']);
const allowedPetStatuses = new Set(['待领养', '已领养', '暂不适合领养']);
const mediaTypes = new Set(['image', 'video']);

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
function text(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}
function normalizeContact(value) {
  return text(value, 120).replace(/[\s-]/g, '').toLowerCase();
}
function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}
function parseRows(result) {
  const data = result?.data ?? result ?? {};
  const rows = data.Rows || data.rows || data.records || [];
  return rows.map(row => {
    if (typeof row === 'string') {
      try { return JSON.parse(row); } catch { return { value: row }; }
    }
    return row;
  });
}
async function sql(statement, params = {}) {
  const normalizedStatement = String(statement).trim().replace(/;$/, '');
  const response = await app.models.$runSQL(normalizedStatement, params);
  return { response, rows: parseRows(response) };
}
function contextInfo(context) {
  const info = cloudbase.getCloudbaseContext(context);
  return {
    uid: info.TCB_UUID || info.uid || '',
    ip: info.WX_CLIENTIP || info.TCB_SOURCE_IP || '',
    source: info.TCB_SOURCE || ''
  };
}
function configuredAdmins() {
  return new Set(text(process.env.ADMIN_UIDS, 1000).split(',').map(item => item.trim()).filter(Boolean));
}
async function requireAdmin(context) {
  const { uid } = contextInfo(context);
  if (!uid) throw new Error('请先使用管理员账号登录。');
  const configured = configuredAdmins();
  if (configured.size && !configured.has(uid)) throw new Error('当前账号没有管理员权限。');
  if (!configured.size) {
    const { rows } = await sql('SELECT auth_uid FROM public.yard_administrators WHERE auth_uid = :uid AND active = TRUE', { uid });
    if (!rows.length) throw new Error('当前账号没有管理员权限。');
  }
  return uid;
}
async function notifyWeCom(application) {
  const webhook = text(process.env.WECOM_WEBHOOK, 500);
  if (!webhook) return { sent: false, reason: 'WECOM_WEBHOOK 尚未配置' };
  const payload = {
    msgtype: 'markdown',
    markdown: {
      content: `**成都猫狗小院 · 新申请提醒**\n> 宠物：${application.pet_name}\n> 类型：${application.application_type}\n> 提交时间：${application.submitted_at}\n> 请登录管理员后台查看完整资料。`
    }
  };
  const response = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error('企业微信提醒发送失败。');
  return { sent: true };
}
async function publicBootstrap() {
  const { rows: pets } = await sql(`
    SELECT p.*, COALESCE(
      json_agg(json_build_object(
        'id', m.id, 'type', m.media_type, 'storagePath', m.storage_path,
        'externalUrl', m.external_url, 'caption', m.caption, 'altText', m.alt_text,
        'isCover', m.is_cover, 'sortOrder', m.sort_order
      ) ORDER BY m.is_cover DESC, m.sort_order ASC, m.created_at ASC)
      FILTER (WHERE m.id IS NOT NULL AND m.is_public = TRUE), '[]'::json
    ) AS media
    FROM public.pets p
    LEFT JOIN public.pet_media m ON m.pet_id = p.id
    WHERE p.is_published = TRUE
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `);
  const { rows: settings } = await sql(`SELECT key, value FROM public.yard_settings WHERE key IN ('public_contact','application_policy')`);
  return { pets, settings: Object.fromEntries(settings.map(item => [item.key, item.value])) };
}
async function submitApplication(event, context) {
  if (text(event.website, 50)) throw new Error('提交未通过验证。');
  const startedAt = Number(event.formStartedAt || 0);
  if (startedAt && Date.now() - startedAt < 2500) throw new Error('请稍后再提交。');
  const kind = text(event.applicationType, 30);
  if (!['正式领养申请', '预约申请'].includes(kind)) throw new Error('申请类型无效。');
  const applicantName = text(event.name, 40);
  const age = Number(event.age);
  const gender = text(event.gender, 20);
  const contact = text(event.contact, 120);
  const contactNormalized = normalizeContact(contact);
  if (!applicantName || !contactNormalized || !Number.isInteger(age) || age < 18 || age > 100) throw new Error('请完整填写姓名、年龄和联系方式。');
  const { uid, ip } = contextInfo(context);
  const ipHash = ip ? hash(ip) : '';
  const browserHash = event.browserToken ? hash(text(event.browserToken, 180)) : '';
  const recentKey = ipHash || browserHash || contactNormalized;
  const { rows: recent } = await sql(`
    SELECT COUNT(*)::int AS total FROM public.rate_limit_events
    WHERE event_kind = 'application_submit' AND key_hash = :keyHash
      AND created_at > NOW() - INTERVAL '10 minutes'
  `, { keyHash: recentKey });
  if (Number(recent[0]?.total || 0) >= 1) throw new Error('提交过于频繁，请十分钟后再试。');
  const { rows: daily } = await sql(`
    SELECT COUNT(*)::int AS total FROM public.rate_limit_events
    WHERE event_kind = 'application_submit' AND key_hash = :keyHash
      AND created_at > NOW() - INTERVAL '24 hours'
  `, { keyHash: recentKey });
  if (Number(daily[0]?.total || 0) >= 3) throw new Error('今天的提交次数已达到上限，请明天再试。');
  const { rows: duplicated } = await sql(`
    SELECT id FROM public.applications
    WHERE pet_id = :petId AND contact_normalized = :contact
      AND submitted_at > NOW() - INTERVAL '7 days'
    LIMIT 1
  `, { petId: text(event.petId, 100), contact: contactNormalized });
  if (duplicated.length) throw new Error('你近期已为这只宠物提交过申请，请等待管理员联系。');
  const { rows: petRows } = await sql('SELECT id, name, adoption_status FROM public.pets WHERE id = :id AND is_published = TRUE LIMIT 1', { id: text(event.petId, 100) });
  const pet = petRows[0];
  if (!pet) throw new Error('找不到这只宠物，请刷新页面后重试。');
  if (kind === '正式领养申请' && pet.adoption_status !== '待领养') throw new Error('这只宠物目前不开放正式领养。');
  if (kind === '预约申请' && pet.adoption_status !== '暂不适合领养') throw new Error('这只宠物目前无需预约。');
  const application = {
    id: id('application'), pet_id: pet.id, pet_name: pet.name, application_type: kind,
    applicant_name: applicantName, applicant_age: age, applicant_gender: gender,
    contact, contact_normalized: contactNormalized,
    has_chengdu_home: Boolean(event.hasChengduHome), experience: text(event.experience, 100),
    family_agreement: text(event.familyAgreement, 100), other_pets: text(event.otherPets, 100),
    note: text(event.note, 1000), internal_status: kind === '预约申请' ? '已登记' : '未处理',
    source_ip_hash: ipHash, browser_token_hash: browserHash, submitted_at: new Date().toISOString(), submitter_uid: uid
  };
  await sql(`
    INSERT INTO public.applications (
      id, pet_id, application_type, applicant_name, applicant_age, applicant_gender,
      contact, contact_normalized, has_chengdu_home, experience, family_agreement,
      other_pets, note, internal_status, source_ip_hash, browser_token_hash, submitted_at
    ) VALUES (
      :id, :pet_id, :application_type, :applicant_name, :applicant_age, :applicant_gender,
      :contact, :contact_normalized, :has_chengdu_home, :experience, :family_agreement,
      :other_pets, :note, :internal_status, :source_ip_hash, :browser_token_hash, :submitted_at
    )
  `, application);
  await sql('INSERT INTO public.rate_limit_events(id, event_kind, key_hash) VALUES (:id, :kind, :keyHash)', { id: id('rate'), kind: 'application_submit', keyHash: recentKey });
  await sql('INSERT INTO public.application_events(id, application_id, event_type, actor_uid, detail) VALUES (:id, :applicationId, :eventType, :actorUid, :detail)', {
    id: id('event'), applicationId: application.id, eventType: 'submitted', actorUid: uid || null, detail: JSON.stringify({ applicationType: kind })
  });
  let notification = { sent: false };
  try { notification = await notifyWeCom(application); } catch (error) { console.error(error); notification = { sent: false, reason: '提醒未送达，但申请已保存。' }; }
  return { ok: true, applicationId: application.id, notification };
}
async function adminInbox(context) {
  await requireAdmin(context);
  const { rows } = await sql(`
    SELECT a.*, p.name AS pet_name
    FROM public.applications a JOIN public.pets p ON p.id = a.pet_id
    ORDER BY a.submitted_at DESC LIMIT 200
  `);
  return rows;
}
async function updateApplication(event, context) {
  const uid = await requireAdmin(context);
  const status = text(event.status, 50);
  if (!allowedStatuses.has(status)) throw new Error('无效的申请状态。');
  const applicationId = text(event.applicationId, 120);
  await sql(`UPDATE public.applications SET internal_status = :status, internal_note = :note, updated_at = NOW(), resolved_at = CASE WHEN :status IN ('已通过','暂不考虑') THEN NOW() ELSE resolved_at END WHERE id = :id`, { id: applicationId, status, note: text(event.note, 2000) });
  await sql('INSERT INTO public.application_events(id, application_id, event_type, actor_uid, detail) VALUES (:id, :applicationId, :eventType, :actorUid, :detail)', { id: id('event'), applicationId, eventType: 'status_updated', actorUid: uid, detail: JSON.stringify({ status }) });
  return { ok: true };
}
async function adminSavePet(event, context) {
  await requireAdmin(context);
  const pet = event.pet || {};
  const petId = text(pet.id, 100) || id('pet');
  if (!text(pet.name, 60) || !allowedPetStatuses.has(text(pet.adoptionStatus, 30))) throw new Error('请完整填写宠物名称和状态。');
  await sql(`
    INSERT INTO public.pets(id, name, pet_type, adoption_status, gender, age_text, tags, description, health, requirements, pause_reason, is_published)
    VALUES (:id, :name, :petType, :adoptionStatus, :gender, :ageText, :tags, :description, :health, :requirements, :pauseReason, :isPublished)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, pet_type = EXCLUDED.pet_type, adoption_status = EXCLUDED.adoption_status,
      gender = EXCLUDED.gender, age_text = EXCLUDED.age_text, tags = EXCLUDED.tags, description = EXCLUDED.description,
      health = EXCLUDED.health, requirements = EXCLUDED.requirements, pause_reason = EXCLUDED.pause_reason,
      is_published = EXCLUDED.is_published, updated_at = NOW()
  `, {
    id: petId, name: text(pet.name, 60), petType: text(pet.petType, 10), adoptionStatus: text(pet.adoptionStatus, 30),
    gender: text(pet.gender, 4), ageText: text(pet.ageText, 60), tags: pet.tags || [], description: text(pet.description, 2000),
    health: text(pet.health, 2000), requirements: text(pet.requirements, 2000), pauseReason: text(pet.pauseReason, 2000) || null,
    isPublished: pet.isPublished !== false
  });
  return { ok: true, petId };
}
async function adminSaveSettings(event, context) {
  await requireAdmin(context);
  await sql(`INSERT INTO public.yard_settings(key, value, updated_at) VALUES (:key, :value, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, { key: text(event.key, 80), value: JSON.stringify(event.value || {}) });
  return { ok: true };
}

exports.main = async (event = {}, context = {}) => {
  const action = text(event.action, 80);
  if (action === 'health') return { ok: true, service: 'yard-api', time: new Date().toISOString() };
  if (action === 'debug.simple') return sql('SELECT id, name FROM public.pets LIMIT 1');
  if (action === 'public.bootstrap') return publicBootstrap();
  if (action === 'application.submit') return submitApplication(event, context);
  if (action === 'admin.inbox') return adminInbox(context);
  if (action === 'admin.application.update') return updateApplication(event, context);
  if (action === 'admin.pet.save') return adminSavePet(event, context);
  if (action === 'admin.settings.save') return adminSaveSettings(event, context);
  throw new Error('未知操作。');
};



