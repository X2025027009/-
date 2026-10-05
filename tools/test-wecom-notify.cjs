/**
 * 企业微信提醒的回归测试。
 *
 * 用假 SDK 加载真实的云函数代码，拦截出网请求，校验：
 *   1. 机器人地址的来源优先级（环境变量 > 数据库设置）
 *   2. 没配置时安静跳过，不影响申请落库
 *   3. 按负责人的明确要求，**完整申请资料**（含姓名、联系方式）会出现在消息里
 *   4. 但内部字段（内部备注、IP 哈希、浏览器指纹、修改令牌）绝不能外泄
 *   5. 企业微信「HTTP 200 但 errcode 非 0」必须被判定为发送失败
 *
 * 用法：node tools/test-wecom-notify.cjs
 */
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');

const source = fs.readFileSync(path.join(__dirname, '..', 'functions', 'yard-api', 'index.js'), 'utf8');
/** 从云函数源码里抽出某个函数，用于直接单元测试（避免测试另写一份实现）。 */
function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`没有找到函数 ${name}`);
  let depth = 0;
  for (let i = text.indexOf('{', start); i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`函数 ${name} 的花括号不匹配`);
}

const ENV_ID = 'env-wecom-test';
const PET_NAME = '小麦';
const WEBHOOK_ENV = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=FROM_ENV';
const WEBHOOK_DB = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=FROM_DB';

process.env.TCB_ENV = ENV_ID;
process.env.SCF_NAMESPACE = ENV_ID;

const fakeSdk = {
  SYMBOL_CURRENT_ENV: Symbol('current-env'),
  init: () => ({
    rdb: () => ({
      from: () => {
        throw new Error('不该访问 rdb');
      }
    })
  }),
  getCloudbaseContext: () => ({
    TENCENTCLOUD_SECRETID: 'AKIDEXAMPLEFAKE000000000000000000',
    TENCENTCLOUD_SECRETKEY: 'FAKESECRETKEY000000000000000000',
    TENCENTCLOUD_SESSIONTOKEN: 'FAKESESSIONTOKEN',
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
let pgRequests = [];
let webhookPosts = [];
let dbWebhook = WEBHOOK_DB;
let webhookReply = { errcode: 0, errmsg: 'ok' };

const pgResponse = value => ({
  ok: true,
  status: 200,
  json: async () => ({ Response: { RequestId: 'test', Rows: [JSON.stringify([JSON.stringify(value)])] } })
});

globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  if (target.includes('qyapi.weixin.qq.com')) {
    webhookPosts.push({ url: target, body: JSON.parse(init.body || '{}') });
    return { ok: true, status: 200, json: async () => ({ ...webhookReply }) };
  }
  const body = JSON.parse(init.body || '{}');
  pgRequests.push(body);
  const sql = String(body.Sql);
  if (sql.includes('count(*) FROM public.applications')) return pgResponse({ n: 3 });
  if (sql.includes('wecom_webhook')) return pgResponse({ url: dbWebhook });
  return pgResponse({ ok: true, applicationId: 'application_test', petName: PET_NAME });
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

const APPLICANT = {
  name: '张私隐',
  contact: '13800008888',
  age: '37',
  note: '住在某某小区'
};

function submitEvent() {
  return {
    action: 'application.submit',
    petId: 'pet-test',
    applicationType: '正式领养申请',
    name: APPLICANT.name,
    age: Number(APPLICANT.age),
    gender: '女',
    contact: APPLICANT.contact,
    hasChengduHome: true,
    experience: '有',
    familyAgreement: '全部同意',
    otherPets: '没有',
    note: APPLICANT.note,
    website: '',
    formStartedAt: Date.now() - 60000,
    browserToken: 'wecom-token'
  };
}

async function run(event) {
  pgRequests = [];
  webhookPosts = [];
  return await yardApi.main(event, {});
}

(async () => {
  console.log('--- 1. 环境变量优先 ---');
  process.env.WECOM_WEBHOOK = WEBHOOK_ENV;
  webhookReply = { errcode: 0, errmsg: 'ok' };
  let result = await run(submitEvent());
  check('申请提交成功', result?.ok === true, JSON.stringify(result));
  check('提醒已发送', result?.notification?.sent === true, JSON.stringify(result?.notification));
  check('只推送了一条群消息', webhookPosts.length === 1, `实际 ${webhookPosts.length} 条`);
  check('推送到环境变量里的地址', webhookPosts[0]?.url === WEBHOOK_ENV, webhookPosts[0]?.url);
  const settingsRead = pgRequests.find(r => String(r.Sql).trim().startsWith('SELECT') && String(r.Sql).includes('wecom_webhook'));
  check('环境变量存在时不再读数据库设置', !settingsRead, '多余的数据库读取');
  const successWrite = pgRequests.find(r => String(r.Sql).includes('INSERT INTO public.yard_settings'));
  check('发送成功后记录了结果供后台显示', Boolean(successWrite), '没有记录发送结果');

  const content = webhookPosts[0]?.body?.text?.content || '';
  console.log(
    `\n     消息内容：\n${content
      .split('\n')
      .map(l => '     ' + l)
      .join('\n')}\n`
  );
  // 纯文本类型是硬要求：实测微信插件不渲染 markdown，会显示「暂不支持此消息类型」。
  check('使用纯文本消息类型（微信插件能显示）', webhookPosts[0]?.body?.msgtype === 'text', webhookPosts[0]?.body?.msgtype);
  check('没有发送 markdown 字段', webhookPosts[0]?.body?.markdown === undefined, JSON.stringify(Object.keys(webhookPosts[0]?.body || {})));
  check('内容里不含 markdown 加粗标记', !content.includes('**'), content);
  check('内容里不以引用块开头（无 markdown 语法）', !/^>/m.test(content), content);
  const contentBytes = Buffer.byteLength(content, 'utf8');
  check('内容不超过企业微信纯文本 2048 字节上限', contentBytes <= 1800, `实际 ${contentBytes} 字节`);

  console.log('--- 2. 完整申请资料必须出现（负责人明确要求） ---');
  check('包含宠物名', content.includes(`宠物：${PET_NAME}`), content);
  check('包含申请类型', content.includes('类型：正式领养申请'), content);
  check('包含北京时间（形如 2026-09-11 20:15）', /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(content), content);
  check('包含申请编号', content.includes('申请编号：application_test'), content);
  check('包含申请人姓名', content.includes(`姓名：${APPLICANT.name}`), content);
  check('包含年龄与性别', content.includes(`年龄 / 性别：${APPLICANT.age} 岁 / 女`), content);
  check('包含联系方式', content.includes(`联系方式：${APPLICANT.contact}`), content);
  check('包含成都住所情况', content.includes('成都及周边有住所：是'), content);
  check('包含养宠经验', content.includes('养宠经验：有'), content);
  check('包含家庭成员意见', content.includes('家庭成员意见：全部同意'), content);
  check('包含现有宠物', content.includes('现有宠物：没有'), content);
  check('包含补充说明', content.includes(`补充说明：${APPLICANT.note}`), content);
  check('包含该宠物第几份申请', content.includes('第 3 份申请'), content);
  check('包含后台链接', content.includes(`打开管理员后台：${'https://'}`) || /打开管理员后台：https:\/\//.test(content), content);

  console.log('--- 3. 内部字段绝不能外泄 ---');
  for (const [label, needle] of [
    ['管理员内部备注字段名', 'internal_note'],
    ['来源 IP 哈希', 'source_ip_hash'],
    ['浏览器指纹哈希', 'browser_token_hash'],
    ['修改令牌哈希', 'edit_token_hash'],
    ['明文修改令牌', 'editToken'],
    ['数据表名', 'public.applications'],
    ['SQL 片段', 'jsonb_build_object'],
    ['环境变量名', 'WECOM_WEBHOOK']
  ]) {
    check(`消息不含${label}`, !content.includes(needle), content);
  }
  check('消息不含本次的明文修改令牌', Boolean(result?.editToken) && !content.includes(result.editToken), `token=${String(result?.editToken).slice(0, 8)}...`);
  // 去掉网址后再做通用检查（网站域名本身恰好是一串 base64url 合法字符，会误报）。
  const withoutUrls = content.replace(/https?:\/\/\S+/g, '');
  check('去掉网址后不含任何 43 位 base64url 令牌', !/[A-Za-z0-9_-]{43}/.test(withoutUrls), withoutUrls);

  console.log('--- 3b. 超长补充说明不会撑爆消息 ---');
  const longEvent = submitEvent();
  longEvent.note = '很长的补充说明内容。'.repeat(200);
  await run(longEvent);
  const longContent = webhookPosts[0]?.body?.text?.content || '';
  const longBytes = Buffer.byteLength(longContent, 'utf8');
  check('超长备注时仍不超上限', longBytes <= 1800, `实际 ${longBytes} 字节`);
  check('超长备注被截短，不会整段发出', !longContent.includes('很长的补充说明内容。'.repeat(21)), '备注未按每字段 200 字上限截短');

  console.log('--- 3c. 字节截断函数（超出上限时的兜底） ---');
  const truncateUtf8 = new Function(`${extractFunction(source, 'truncateUtf8')}; return truncateUtf8;`)();
  check('短内容原样返回', truncateUtf8('短内容', 100) === '短内容', truncateUtf8('短内容', 100));
  const huge = '汉'.repeat(2000); // 6000 字节
  const cut = truncateUtf8(huge, 1800);
  check('超长内容被裁到上限内', Buffer.byteLength(cut, 'utf8') <= 1800 + 200, `实际 ${Buffer.byteLength(cut, 'utf8')} 字节`);
  check('截断后末尾是纯汉字，不会出现半个字', !cut.includes('\uFFFD'), cut.slice(-30));
  check('截断后带有提示语', cut.includes('内容过长已截断'), cut.slice(-60));

  console.log('--- 4. 环境变量为空时回落到数据库设置 ---');
  delete process.env.WECOM_WEBHOOK;
  result = await run(submitEvent());
  check('提醒仍然发送成功', result?.notification?.sent === true, JSON.stringify(result?.notification));
  check(
    '读取了数据库里的机器人地址',
    pgRequests.some(r => String(r.Sql).trim().startsWith('SELECT') && String(r.Sql).includes('wecom_webhook')),
    '没有读取设置'
  );
  check('推送到数据库里配置的地址', webhookPosts[0]?.url === WEBHOOK_DB, webhookPosts[0]?.url);

  console.log('--- 5. 两处都没配置时安静跳过 ---');
  dbWebhook = '';
  result = await run(submitEvent());
  check('申请仍然提交成功（提醒不影响落库）', result?.ok === true, JSON.stringify(result));
  check('提醒标记为未发送', result?.notification?.sent === false, JSON.stringify(result?.notification));
  check('给出未配置的原因', String(result?.notification?.reason || '').includes('尚未配置'), JSON.stringify(result?.notification));
  check('没有向企业微信发请求', webhookPosts.length === 0, `实际 ${webhookPosts.length} 条`);
  check('未配置时不写入发送结果（避免后台一直显示失败）', !pgRequests.some(r => String(r.Sql).includes('INSERT INTO public.yard_settings')), '不该记录发送结果');

  console.log('--- 6. 关键回归：企业微信 HTTP 200 但 errcode 非 0 必须算失败 ---');
  process.env.WECOM_WEBHOOK = WEBHOOK_ENV;
  webhookReply = { errcode: 93000, errmsg: 'invalid webhook url' };
  result = await run(submitEvent());
  check('申请本身仍然成功', result?.ok === true, JSON.stringify(result));
  check('提醒被判定为发送失败', result?.notification?.sent === false, JSON.stringify(result?.notification));
  check('返回给访客的提示保持通用（不暴露内部细节）', result?.notification?.reason === '提醒未送达，但申请已保存。', JSON.stringify(result?.notification));
  const outcomeWrite = pgRequests.find(r => String(r.Sql).includes('INSERT INTO public.yard_settings'));
  check('把失败结果写进数据库供管理员查看', Boolean(outcomeWrite), '没有记录发送结果');
  check('记录里带上了企业微信的真实报错', String(outcomeWrite?.Sql || '').includes('invalid webhook url'), String(outcomeWrite?.Sql || '').slice(0, 200));
  check('失败时也带上了 lastOk=false', String(outcomeWrite?.Sql || '').includes('false'), String(outcomeWrite?.Sql || '').slice(0, 200));

  console.log('--- 7. 统计同宠物申请数失败不应影响发送 ---');
  webhookReply = { errcode: 0, errmsg: 'ok' };
  const originalFetchInTest = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    if (String(body.Sql || '').includes('count(*) FROM public.applications')) {
      return {
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('模拟统计失败');
        }
      };
    }
    return originalFetchInTest(url, init);
  };
  result = await run(submitEvent());
  globalThis.fetch = originalFetchInTest;
  check('统计失败时提醒仍然发送成功', result?.notification?.sent === true, JSON.stringify(result?.notification));

  globalThis.fetch = originalFetch;
  delete process.env.WECOM_WEBHOOK;
  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  process.exit(failed ? 1 : 0);
})();
