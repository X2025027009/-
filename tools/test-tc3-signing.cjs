/**
 * yard-api 回归测试。
 *
 * 用假 SDK 加载真实的云函数代码，拦截它发给腾讯云 OpenAPI 的请求，
 * 校验 TC3 签名、申请提交 SQL、以及「限时修改令牌」的查询/修改逻辑。
 *
 * 重点锁定的历史回归：早期实现的临时凭证 Token 放在了 Authorization 里、
 * 且签名包含了额外请求头，服务端因此报 “The SecretId is not found”，
 * 导致所有申请提交失败。
 *
 * 用法：node tools/test-tc3-signing.cjs
 */
const Module = require('node:module');
const path = require('node:path');
const crypto = require('node:crypto');

const SECRET_ID = 'AKIDEXAMPLEFAKE000000000000000000';
const SECRET_KEY = 'FAKESECRETKEY000000000000000000';
const SESSION_TOKEN = 'FAKESESSIONTOKEN';
const ENV_ID = 'env-signing-test';

process.env.TCB_ENV = ENV_ID;
process.env.SCF_NAMESPACE = ENV_ID;
delete process.env.WECOM_WEBHOOK;

const fakeSdk = {
  SYMBOL_CURRENT_ENV: Symbol('current-env'),
  init: () => ({
    rdb: () => ({
      from: () => {
        throw new Error('这些动作不应访问 rdb');
      }
    })
  }),
  getCloudbaseContext: () => ({
    TENCENTCLOUD_SECRETID: SECRET_ID,
    TENCENTCLOUD_SECRETKEY: SECRET_KEY,
    TENCENTCLOUD_SESSIONTOKEN: SESSION_TOKEN,
    TCB_ENV: ENV_ID,
    SCF_NAMESPACE: ENV_ID,
    TCB_SOURCE_IP: '203.0.113.7'
  })
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@cloudbase/node-sdk') return fakeSdk;
  return originalLoad.call(this, request, ...rest);
};

const originalFetch = globalThis.fetch;
const captured = [];
globalThis.fetch = async (url, init) => {
  captured.push({ url, init });
  return {
    ok: true,
    status: 200,
    json: async () => ({ Response: { RequestId: 'test', Rows: [JSON.stringify([JSON.stringify({ ok: true, applicationId: 'application_test', petName: '测试宠物' })])] } })
  };
};

const yardApi = require(path.join(__dirname, '..', 'functions', 'yard-api', 'index.js'));

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${label}`);
  } else {
    failed += 1;
    console.log(`❌ ${label}${detail ? `\n     ${detail}` : ''}`);
  }
}

const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');

async function run(event) {
  captured.length = 0;
  const result = await yardApi.main(event, {});
  const request = captured[0];
  const sql = request ? JSON.parse(request.init.body).Sql : '';
  return { result, request, sql, callCount: captured.length };
}

const applicantPayload = {
  name: '署名测试',
  age: 31,
  gender: '女',
  contact: 'wx-edit-test',
  hasChengduHome: true,
  experience: '有',
  familyAgreement: '全部同意',
  otherPets: '没有',
  note: '补充说明内容'
};

(async () => {
  console.log('--- 1. 申请提交与 TC3 签名 ---');
  const submit = await run({
    action: 'application.submit',
    petId: 'pet-test',
    applicationType: '正式领养申请',
    ...applicantPayload,
    website: '',
    formStartedAt: Date.now() - 60000,
    browserToken: 'signing-token'
  });

  check('提交返回成功', submit.result?.ok === true, JSON.stringify(submit.result));
  // 两次出网：一次执行提交 SQL；一次读取企业微信机器人设置（本测试未配置 WECOM_WEBHOOK）。
  check('出网请求数量符合预期', submit.callCount === 2, `实际 ${submit.callCount} 个`);
  check('第二次是读取机器人设置，不是向企业微信发消息', submit.callCount < 2 || !captured[1].url.includes('qyapi.weixin.qq.com'), captured[1]?.url);

  const headers = submit.request?.init.headers || {};
  const body = submit.request ? JSON.parse(submit.request.init.body) : {};
  check('请求地址正确', submit.request?.url === 'https://tcb.tencentcloudapi.com/', submit.request?.url);
  check('Action 正确', headers['X-TC-Action'] === 'ExecutePGSql', headers['X-TC-Action']);
  check('EnvId 正确', body.EnvId === ENV_ID, body.EnvId);
  check('临时凭证 Token 放在 X-TC-Token 头', headers['X-TC-Token'] === SESSION_TOKEN, `实际：${headers['X-TC-Token'] === undefined ? '缺失' : headers['X-TC-Token']}`);
  check('Authorization 里不再拼接 Token=', !String(headers.Authorization).includes('Token='), String(headers.Authorization));
  check('Authorization 里不再拼接 Timestamp=', !String(headers.Authorization).includes('Timestamp='), String(headers.Authorization));
  check('SignedHeaders 只包含 content-type;host', String(headers.Authorization).includes('SignedHeaders=content-type;host'), String(headers.Authorization));

  const { sign } = require(path.join(__dirname, '..', 'node_modules', '@cloudbase', 'signature-nodejs'));
  const timestamp = Number(headers['X-TC-Timestamp']);
  const reference = sign({
    secretId: SECRET_ID,
    secretKey: SECRET_KEY,
    method: 'POST',
    url: 'https://tcb.tencentcloudapi.com/',
    headers: { 'Content-Type': 'application/json', Host: 'tcb.tencentcloudapi.com' },
    params: body,
    timestamp,
    withSignedParams: false,
    isCloudApi: true
  }).authorization;
  const extractSignature = value => (String(value).match(/Signature=([0-9a-f]+)/) || [])[1];
  check('签名与签名库重算结果一致', Boolean(extractSignature(headers.Authorization)) && extractSignature(headers.Authorization) === extractSignature(reference));
  check('SQL 已正确转义联系方式', submit.sql.includes("'wx-edit-test'"), '未找到转义后的联系方式');

  console.log('\n--- 1b. 限频键策略（IP 不参与 10 分钟快速限频） ---');
  const arrayBefore = window => {
    const pattern = new RegExp(`key_hash=ANY\\((ARRAY\\[[^\\]]*\\]::TEXT\\[\\])\\) AND created_at>=NOW\\(\\)-INTERVAL '${window}'`);
    return (submit.sql.match(pattern) || [])[1] || '';
  };
  const recentArray = arrayBefore('10 minutes');
  const dailyArray = arrayBefore('24 hours');
  check('10 分钟限频不使用 IP 键', recentArray !== '' && !recentArray.includes("'ip:"), recentArray.slice(0, 140));
  check('10 分钟限频使用浏览器键与联系键', recentArray.includes("'browser:") && recentArray.includes("'contact:"), recentArray.slice(0, 140));
  check('24 小时上限仍包含 IP 键', dailyArray.includes("'ip:"), dailyArray.slice(0, 140));
  const valuesBlock = (submit.sql.match(/FROM \(VALUES (.*?)\) AS item\(event_id,key_hash\)/s) || [])[1] || '';
  check(
    '限频记录仍写入全部三个键（含 IP）',
    ['ip:', 'browser:', 'contact:'].every(prefix => valuesBlock.includes(`'${prefix}`)),
    valuesBlock.slice(0, 220)
  );

  console.log('\n--- 2. 提交时发放修改令牌 ---');
  const editToken = submit.result?.editToken;
  check('返回了修改令牌', typeof editToken === 'string' && editToken.length >= 40, `token=${String(editToken).slice(0, 12)}...`);
  check('返回了令牌过期时间', typeof submit.result?.editTokenExpiresAt === 'string' && !Number.isNaN(Date.parse(submit.result.editTokenExpiresAt)), String(submit.result?.editTokenExpiresAt));
  const expiryHours = (Date.parse(submit.result?.editTokenExpiresAt) - Date.now()) / 3600000;
  check('令牌有效期为 24 小时左右', expiryHours > 23.9 && expiryHours < 24.1, `实际 ${expiryHours.toFixed(3)} 小时`);
  check('SQL 里写入了令牌哈希', submit.sql.includes(sha256(editToken)), '未找到令牌哈希');
  check('明文令牌绝不进入 SQL', !submit.sql.includes(editToken), 'SQL 中出现了明文令牌！');
  check('SQL 里写入了过期时间字段', submit.sql.includes('edit_token_expires_at'), '未写入过期时间');
  check('令牌是 32 字节随机值的 base64url 编码', /^[A-Za-z0-9_-]{43}$/.test(String(editToken)), `length=${String(editToken).length}`);

  console.log('\n--- 3. 申请修改（application.edit） ---');
  const token = 'test-edit-token-value';
  const edit = await run({ action: 'application.edit', token, ...applicantPayload, name: '改名后的申请人', contact: 'wx-edited-999' });

  check('修改返回成功', edit.result?.ok === true, JSON.stringify(edit.result));
  check('只发出一个出网请求', edit.callCount === 1, `实际 ${edit.callCount} 个`);
  check('按令牌哈希定位记录', edit.sql.includes(`edit_token_hash = '${sha256(token)}'`), '未按令牌哈希定位');
  check('令牌必须未过期', edit.sql.includes('edit_token_expires_at > NOW()'), '未校验过期时间');
  check('使用 UPDATE 就地修改，不新增记录', edit.sql.includes('UPDATE public.applications SET') && !edit.sql.includes('INSERT INTO public.applications'), 'SQL 形态不对');
  check('写入了修改后的姓名', edit.sql.includes("'改名后的申请人'"), '未写入新姓名');
  check('写入了修改后的联系方式', edit.sql.includes("'wx-edited-999'"), '未写入新联系方式');
  check('联系方式已重新规范化', edit.sql.includes("contact_normalized='wxedited999'"), '未重新规范化联系方式');

  // 不允许修改的字段绝不能出现在 SET 子句中
  const setClause = edit.sql.split('UPDATE public.applications SET')[1]?.split('WHERE')[0] || '';
  for (const forbidden of ['pet_id', 'application_type', 'internal_status', 'internal_note', 'edit_token_hash', 'source_ip_hash', 'browser_token_hash']) {
    check(`SET 子句不包含禁止字段 ${forbidden}`, !setClause.includes(`${forbidden}=`), setClause.slice(0, 160));
  }

  check('记录了 applicant_updated 事件', edit.sql.includes("'applicant_updated'"), '未记录修改事件');
  const detailPart = edit.sql.split("jsonb_build_object('fields'")[1] || '';
  check('事件只记录字段名，不记录字段值', !detailPart.includes('改名后的申请人') && !detailPart.includes('wxedited999'), detailPart.slice(0, 160));
  check('事件里列出了可修改字段名', detailPart.includes('applicant_name') && detailPart.includes('contact_normalized'), detailPart.slice(0, 160));

  console.log('\n--- 4. 令牌查询（application.lookup） ---');
  const lookup = await run({ action: 'application.lookup', token });

  check('查询返回结果', lookup.result !== undefined, '无返回');
  check('只发出一个出网请求', lookup.callCount === 1, `实际 ${lookup.callCount} 个`);
  check('按令牌哈希查询', lookup.sql.includes(`edit_token_hash = '${sha256(token)}'`), '未按令牌哈希查询');
  check('令牌必须未过期', lookup.sql.includes('edit_token_expires_at > NOW()'), '未校验过期时间');
  check('查不到时给出明确提示而不是报错', lookup.sql.includes('修改令牌无效或已过期，请联系管理员。'), '缺少友好提示');
  check('查询使用只读 SELECT', lookup.sql.trim().startsWith('SELECT') && !lookup.sql.includes('UPDATE ') && !lookup.sql.includes('INSERT '), lookup.sql.slice(0, 80));

  console.log('\n--- 5. 无效令牌与非法输入 ---');
  const noToken = await run({ action: 'application.edit', ...applicantPayload });
  check('缺少令牌时给出提示', noToken.result?.ok === false && noToken.result.message === '请填写修改令牌。', JSON.stringify(noToken.result));
  check('缺少令牌时不发出数据库请求', noToken.callCount === 0, `实际 ${noToken.callCount} 个`);

  const badAge = await run({ action: 'application.edit', token, ...applicantPayload, age: 12 });
  check('修改时年龄不合法会被拒绝', badAge.result?.ok === false && badAge.result.message === '请完整填写申请资料。', JSON.stringify(badAge.result));
  check('非法输入不发出数据库请求', badAge.callCount === 0, `实际 ${badAge.callCount} 个`);

  globalThis.fetch = originalFetch;
  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  process.exit(failed ? 1 : 0);
})();
