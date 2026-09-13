/**
 * 浏览器通路探针。
 *
 * 用 index.html 里的匿名 Publishable Key 直接请求 CloudBase 网关，
 * 也就是浏览器 SDK 走的同一条路，验证公开页面会调用的三个动作是否可达：
 *   health / application.submit / application.lookup / application.edit
 *
 * 全部使用会被服务端拒绝的参数，不会写入任何数据。
 * 密钥从 index.html 读取，不写入本文件，也不打印。
 *
 * 用法：node tools/probe-gateway.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const match = html.match(/window\.YARD_CLOUD_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/);
const config = new Function(`return (${match[1]});`)();
const endpoint = `https://${config.env}.api.tcloudbasegateway.com/v1/functions/yard-api`;

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.accessKey}` };

async function call(label, data, expectation) {
  try {
    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(data) });
    const text = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* 保持原样输出 */ }
    const ok = response.status === 200 && (!expectation || expectation(parsed));
    console.log(`${ok ? '✅' : '❌'} ${label}`);
    console.log(`     HTTP ${response.status} ${text.slice(0, 220)}`);
    return ok;
  } catch (error) {
    console.log(`❌ ${label}\n     请求异常：${error.message}`);
    return false;
  }
}

(async () => {
  console.log(`环境：${config.env}`);
  console.log(`入口：${endpoint}\n`);

  let passed = 0;
  const results = [];

  results.push(await call('health 可访问', { action: 'health' }, r => r?.ok === true));
  results.push(await call('application.submit 可达（不存在的宠物，不写入）', {
    action: 'application.submit',
    petId: '__probe_nonexistent_pet__',
    applicationType: '正式领养申请',
    name: '探针测试',
    age: 30,
    gender: '女',
    contact: '__probe_contact__',
    hasChengduHome: true,
    experience: '有',
    familyAgreement: '全部同意',
    otherPets: '没有',
    note: '',
    website: '',
    formStartedAt: Date.now() - 60000,
    browserToken: `probe-${Date.now()}`
  // 只要返回业务级提示就说明「网关 → 云函数 → 数据库」整条链路是通的。
  // 被限频同样是通了的证据（说明限频 SQL 真的在跑），所以一并接受。
  }, r => r?.ok === false && (
    r?.message === '找不到这只宠物，请刷新页面后重试。'
    || String(r?.message || '').includes('提交过于频繁')
    || String(r?.message || '').includes('提交次数已达到上限')
  )));

  results.push(await call('application.lookup 可达（无效令牌，不写入）', {
    action: 'application.lookup',
    token: '__probe_bogus_token__'
  }, r => r?.ok === false && r?.message?.includes('修改令牌无效或已过期')));

  results.push(await call('application.edit 可达（无效令牌，不写入）', {
    action: 'application.edit',
    token: '__probe_bogus_token__',
    name: '探针测试',
    age: 30,
    gender: '女',
    contact: '__probe_contact__',
    hasChengduHome: true,
    experience: '有',
    familyAgreement: '全部同意',
    otherPets: '没有',
    note: ''
  }, r => r?.ok === false && r?.message?.includes('修改令牌无效或已过期')));

  passed = results.filter(Boolean).length;
  const failed = results.length - passed;
  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  process.exit(failed ? 1 : 0);
})();
