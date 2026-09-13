const crypto = require('node:crypto');
const { sign } = require('@cloudbase/signature-nodejs');
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.rdb({ database: 'public' });
const allowedStatuses = new Set(['未处理', '沟通中', '已通过', '已登记', '等待宠物开放', '已通知', '已转为正式领养申请', '暂不考虑']);
const allowedPetStatuses = new Set(['待领养', '已领养', '暂不适合领养']);
const allowedPetTypes = new Set(['猫咪', '狗狗']);
const allowedGenders = new Set(['公', '母']);
const allowedApplicantGenders = new Set(['女', '男', '不方便说明']);
const allowedExperience = new Set(['有', '没有', '正在了解']);
const allowedFamilyAgreement = new Set(['全部同意', '部分同意', '尚未沟通']);
const allowedOtherPets = new Set(['没有', '有猫', '有狗', '有其他宠物']);

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
function rows(result, operation = '数据库操作') {
  if (result?.error) {
    const message = result.error.message || result.error.error || String(result.error);
    throw new Error(`${operation}失败：${message}`);
  }
  return Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : [];
}
function contextInfo(context) {
  const info = cloudbase.getCloudbaseContext(context);
  return {
    uid: info.TCB_UUID || info.uid || '',
    ip: info.WX_CLIENTIP || info.TCB_SOURCE_IP || '',
    source: info.TCB_SOURCE || ''
  };
}
function applicationRateKeys({ ip, browserToken, contactNormalized }) {
  const keys = [];
  if (ip) keys.push(`ip:${hash(ip)}`);
  if (browserToken) keys.push(`browser:${hash(browserToken)}`);
  if (contactNormalized) keys.push(`contact:${hash(contactNormalized)}`);
  return [...new Set(keys)];
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
    const result = await db.from('yard_administrators').select('auth_uid').eq('auth_uid', uid).eq('active', true).limit(1);
    if (!rows(result, '管理员身份检查').length) throw new Error('当前账号没有管理员权限。');
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
  const [petResult, mediaResult, updateResult, settingsResult] = await Promise.all([
    db.from('pets').select('*').eq('is_published', true).order('updated_at', { ascending: false }).limit(200),
    db.from('pet_media').select('*').eq('is_public', true).order('sort_order', { ascending: true }).limit(1000),
    db.from('pet_updates').select('*').order('update_date', { ascending: false }).limit(1000),
    db.from('yard_settings').select('key,value').in('key', ['public_contact', 'application_policy']).limit(20)
  ]);
  const pets = rows(petResult, '读取宠物资料');
  const media = rows(mediaResult, '读取宠物影像');
  const updates = rows(updateResult, '读取回访档案');
  const settings = rows(settingsResult, '读取网站设置');
  return {
    pets: pets.map(pet => ({
      ...pet,
      media: media.filter(item => item.pet_id === pet.id).map(item => ({
        id: item.id,
        type: item.media_type,
        storagePath: item.storage_path,
        externalUrl: item.external_url,
        caption: item.caption,
        altText: item.alt_text,
        isCover: item.is_cover,
        sortOrder: item.sort_order
      })),
      updates: updates.filter(item => item.pet_id === pet.id)
    })),
    settings: Object.fromEntries(settings.map(item => [item.key, item.value]))
  };
}
function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function sqlTextArray(values) {
  return `ARRAY[${values.map(sqlLiteral).join(',')}]::TEXT[]`;
}
function tc3Hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}
async function executePgSql(sql) {
  const secretId = process.env.TENCENTCLOUD_SECRETID;
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY;
  const sessionToken = process.env.TENCENTCLOUD_SESSIONTOKEN;
  const envId = process.env.TCB_ENV || process.env.SCF_NAMESPACE;
  if (!secretId || !secretKey || !envId) throw new Error('申请服务暂不可用，请稍后再试。');
  const url = 'https://tcb.tencentcloudapi.com/';
  const timestamp = Math.floor(Date.now() / 1000) - 1;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Host: 'tcb.tencentcloudapi.com',
    'X-TC-Action': 'ExecutePGSql',
    'X-TC-Region': 'ap-shanghai',
    'X-TC-Version': '2018-06-08',
    'X-TC-Timestamp': String(timestamp)
  };
  const params = { EnvId: envId, Sql: sql };
  const authorization = sign({
    secretId,
    secretKey,
    method: 'POST',
    url,
    headers,
    params,
    timestamp,
    withSignedParams: false,
    isCloudApi: true
  }).authorization;
  headers.Authorization = sessionToken
    ? `${authorization}, Timestamp=${timestamp}, Token=${sessionToken}`
    : `${authorization}, Timestamp=${timestamp}`;
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(params) });
  const result = await response.json();
  if (!response.ok || result?.Response?.Error) throw new Error(result?.Response?.Error?.Message || '申请服务暂不可用，请稍后再试。');
  return result.Response;
}function sqlResult(response) {
  if (!Array.isArray(response?.Rows) || !response.Rows.length) throw new Error('申请服务暂不可用，请稍后再试。');
  const row = JSON.parse(response.Rows[0]);
  const value = Array.isArray(row) ? row[0] : row;
  return typeof value === 'string' ? JSON.parse(value) : value;
}
async function submitApplicationRecord(payload) {
  const rateKeys = sqlTextArray(payload.rateKeys);
  const rateValues = payload.rateEventIds.map((eventId, index) => `(${sqlLiteral(eventId)},${sqlLiteral(payload.rateKeys[index])})`).join(',');
  const sql = `WITH locked AS (SELECT pg_advisory_xact_lock(hashtext('yard-api-submit:' || key_hash)) FROM unnest(${rateKeys}) AS key_hash), ready AS (SELECT count(*) FROM locked), pet AS (SELECT id,name,adoption_status FROM public.pets WHERE id=${sqlLiteral(payload.petId)} AND is_published=TRUE), decision AS (SELECT CASE WHEN EXISTS (SELECT 1 FROM public.rate_limit_events WHERE event_kind='application_submit' AND key_hash=ANY(${rateKeys}) AND created_at>=NOW()-INTERVAL '10 minutes') THEN '提交过于频繁，请十分钟后再试。' WHEN EXISTS (SELECT 1 FROM public.rate_limit_events WHERE event_kind='application_submit' AND key_hash=ANY(${rateKeys}) AND created_at>=NOW()-INTERVAL '24 hours' GROUP BY key_hash HAVING count(*)>=3) THEN '今天的提交次数已达到上限，请明天再试。' WHEN EXISTS (SELECT 1 FROM public.applications WHERE pet_id=${sqlLiteral(payload.petId)} AND contact_normalized=${sqlLiteral(payload.contactNormalized)} AND submitted_at>=NOW()-INTERVAL '7 days') THEN '你近期已为这只宠物提交过申请，请等待管理员联系。' WHEN pet.id IS NULL THEN '找不到这只宠物，请刷新页面后重试。' WHEN ${sqlLiteral(payload.applicationType)}='正式领养申请' AND pet.adoption_status<>'待领养' THEN '这只宠物目前不开放正式领养。' WHEN ${sqlLiteral(payload.applicationType)}='预约申请' AND pet.adoption_status<>'暂不适合领养' THEN '这只宠物目前无需预约。' ELSE NULL END AS message,pet.name FROM ready LEFT JOIN pet ON TRUE), new_application AS (INSERT INTO public.applications (id,pet_id,application_type,applicant_name,applicant_age,applicant_gender,contact,contact_normalized,has_chengdu_home,experience,family_agreement,other_pets,note,internal_status,source_ip_hash,browser_token_hash,submitted_at) SELECT ${sqlLiteral(payload.applicationId)},${sqlLiteral(payload.petId)},${sqlLiteral(payload.applicationType)},${sqlLiteral(payload.applicantName)},${Number(payload.applicantAge)},${sqlLiteral(payload.applicantGender)},${sqlLiteral(payload.contact)},${sqlLiteral(payload.contactNormalized)},${payload.hasChengduHome ? 'TRUE' : 'FALSE'},${sqlLiteral(payload.experience)},${sqlLiteral(payload.familyAgreement)},${sqlLiteral(payload.otherPets)},NULLIF(${sqlLiteral(payload.note)},''),CASE WHEN ${sqlLiteral(payload.applicationType)}='预约申请' THEN '已登记' ELSE '未处理' END,NULLIF(${sqlLiteral(payload.sourceIpHash)},''),NULLIF(${sqlLiteral(payload.browserTokenHash)},''),to_timestamp(${Number(payload.submittedAtMs)}/1000.0) FROM decision WHERE message IS NULL RETURNING id), new_rates AS (INSERT INTO public.rate_limit_events (id,event_kind,key_hash) SELECT event_id,'application_submit',key_hash FROM (VALUES ${rateValues}) AS item(event_id,key_hash) CROSS JOIN new_application), new_event AS (INSERT INTO public.application_events (id,application_id,event_type,actor_uid,detail) SELECT ${sqlLiteral(payload.eventId)},${sqlLiteral(payload.applicationId)},'submitted',NULLIF(${sqlLiteral(payload.actorUid)},''),jsonb_build_object('applicationType',${sqlLiteral(payload.applicationType)}) FROM new_application) SELECT CASE WHEN message IS NULL THEN jsonb_build_object('ok',true,'applicationId',${sqlLiteral(payload.applicationId)},'petName',name) ELSE jsonb_build_object('ok',false,'message',message) END AS result FROM decision`;
  return sqlResult(await executePgSql(sql));
}
async function submitApplication(event, context) {
  if (text(event.website, 50)) throw new Error('提交未通过验证。');
  const startedAt = Number(event.formStartedAt || 0);
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || startedAt <= 0 || elapsed < 2500 || elapsed > 24 * 60 * 60 * 1000) throw new Error('请重新填写后再提交。');
  const kind = text(event.applicationType, 30);
  if (!['正式领养申请', '预约申请'].includes(kind)) throw new Error('申请类型无效。');
  const applicantName = text(event.name, 40);
  const age = Number(event.age);
  const gender = text(event.gender, 20);
  const contact = text(event.contact, 120);
  const contactNormalized = normalizeContact(contact);
  const experience = text(event.experience, 100);
  const familyAgreement = text(event.familyAgreement, 100);
  const otherPets = text(event.otherPets, 100);
  if (!applicantName || !contactNormalized || !Number.isInteger(age) || age < 18 || age > 100 || !allowedApplicantGenders.has(gender) || typeof event.hasChengduHome !== 'boolean' || !allowedExperience.has(experience) || !allowedFamilyAgreement.has(familyAgreement) || !allowedOtherPets.has(otherPets)) throw new Error('请完整填写申请资料。');
  const { uid, ip } = contextInfo(context);
  const browserToken = text(event.browserToken, 180);
  const ipHash = ip ? hash(ip) : '';
  const browserHash = browserToken ? hash(browserToken) : '';
  const rateKeys = applicationRateKeys({ ip, browserToken, contactNormalized });
  if (!rateKeys.length) throw new Error('无法验证提交来源，请刷新页面后重试。');
  const petId = text(event.petId, 100);
  const submittedAtMs = Date.now();
  const applicationId = id('application');
  const eventId = id('event');
  const rateEventIds = rateKeys.map(() => id('rate'));
  const result = await submitApplicationRecord({
    applicationId,
    eventId,
    rateEventIds,
    rateKeys,
    petId,
    applicationType: kind,
    applicantName,
    applicantAge: age,
    applicantGender: gender,
    contact,
    contactNormalized,
    hasChengduHome: event.hasChengduHome,
    experience,
    familyAgreement,
    otherPets,
    note: text(event.note, 1000),
    sourceIpHash: ipHash,
    browserTokenHash: browserHash,
    actorUid: uid || '',
    submittedAtMs
  });
  if (!result?.ok) throw new Error(result?.message || '申请提交失败，请稍后再试。');
  const application = {
    id: result.applicationId, pet_id: petId, pet_name: result.petName || '', application_type: kind,
    submitted_at: new Date(submittedAtMs).toISOString()
  };
  let notification = { sent: false };
  try { notification = await notifyWeCom(application); } catch (error) { console.error(error); notification = { sent: false, reason: '提醒未送达，但申请已保存。' }; }
  return { ok: true, applicationId: application.id, notification };
}
async function adminInbox(context) {
  await requireAdmin(context);
  const [applicationResult, petResult] = await Promise.all([
    db.from('applications').select('*').order('submitted_at', { ascending: false }).limit(200),
    db.from('pets').select('id,name').limit(500)
  ]);
  const pets = new Map(rows(petResult, '读取宠物名称').map(pet => [pet.id, pet.name]));
  return rows(applicationResult, '读取申请收件箱').map(application => ({ ...application, pet_name: pets.get(application.pet_id) || '' }));
}
async function updateApplication(event, context) {
  const uid = await requireAdmin(context);
  const status = text(event.status, 50);
  if (!allowedStatuses.has(status)) throw new Error('无效的申请状态。');
  const applicationId = text(event.applicationId, 120);
  const patch = { internal_status: status, internal_note: text(event.note, 2000), updated_at: new Date().toISOString() };
  if (['已通过', '暂不考虑'].includes(status)) patch.resolved_at = new Date().toISOString();
  rows(await db.from('applications').update(patch).eq('id', applicationId), '更新申请状态');
  rows(await db.from('application_events').insert({ id: id('event'), application_id: applicationId, event_type: 'status_updated', actor_uid: uid, detail: { status } }), '记录状态变更');
  return { ok: true };
}
async function adminSavePet(event, context) {
  await requireAdmin(context);
  const pet = event.pet || {};
  const petId = text(pet.id, 100) || id('pet');
  const petType = text(pet.petType, 10);
  const adoptionStatus = text(pet.adoptionStatus, 30);
  const gender = text(pet.gender, 4);
  if (!text(pet.name, 60) || !allowedPetTypes.has(petType) || !allowedPetStatuses.has(adoptionStatus) || !allowedGenders.has(gender)) throw new Error('请完整填写宠物名称、种类、性别和状态。');
  rows(await db.from('pets').upsert({
    id: petId,
    name: text(pet.name, 60),
    pet_type: petType,
    adoption_status: adoptionStatus,
    gender,
    age_text: text(pet.ageText, 60),
    tags: Array.isArray(pet.tags) ? pet.tags.map(item => text(item, 40)).filter(Boolean).slice(0, 20) : [],
    description: text(pet.description, 2000),
    health: text(pet.health, 2000),
    requirements: text(pet.requirements, 2000),
    pause_reason: text(pet.pauseReason, 2000) || null,
    is_published: pet.isPublished !== false,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' }), '保存宠物档案');
  return { ok: true, petId };
}
async function adminSaveSettings(event, context) {
  await requireAdmin(context);
  const key = text(event.key, 80);
  if (!['public_contact', 'application_policy'].includes(key)) throw new Error('不允许修改该设置。');
  rows(await db.from('yard_settings').upsert({ key, value: event.value || {}, updated_at: new Date().toISOString() }, { onConflict: 'key' }), '保存网站设置');
  return { ok: true };
}

exports.main = async (event = {}, context = {}) => {
  const action = text(event.action, 80);
  if (action === 'health') return { ok: true, service: 'yard-api', database: 'postgresql-rdb', time: new Date().toISOString() };
  if (action === 'debug.simple') return rows(await db.from('pets').select('id,name').limit(1), '数据库连通性检查');
  if (action === 'public.bootstrap') return publicBootstrap();
  if (action === 'application.submit') {
    try { return await submitApplication(event, context); }
    catch (error) { return { ok: false, message: text(error.message || '申请提交失败，请稍后重试。', 200) }; }
  }
  if (action === 'admin.inbox') return adminInbox(context);
  if (action === 'admin.application.update') return updateApplication(event, context);
  if (action === 'admin.pet.save') return adminSavePet(event, context);
  if (action === 'admin.settings.save') return adminSaveSettings(event, context);
  throw new Error('未知操作。');
};
