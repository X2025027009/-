/**
 * 复刻浏览器真实路径：匿名登录 → callFunction。
 *
 * 为什么需要这个脚本：
 *   tools/probe-gateway.cjs 直接用可发布密钥请求网关，
 *   那是旧环境下的可行方式；新环境对函数调用要求先建立匿名会话。
 *   两者的差别，恰好就是「访客到底能不能提交申请」。
 *
 * 全部使用会被服务端拒绝的参数，不写入任何数据。
 * 密钥从 index.html 读取，不写入本文件、也不打印。
 *
 * 用法：node tools/probe-browser-path.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

// SDK 需要浏览器环境，这里补最小可用的 localStorage
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: key => { store.delete(key); },
    clear: () => store.clear(),
    key: index => [...store.keys()][index] ?? null,
    get length() { return store.size; }
  };
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const matched = html.match(/window\.YARD_CLOUD_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/);
if (!matched) { console.error('无法从 index.html 读取 YARD_CLOUD_CONFIG'); process.exit(1); }
const config = new Function(`return (${matched[1]});`)();

let passed = 0;
let failed = 0;
function check(label, ok, detail = '') {
  if (ok) { passed += 1; console.log(`✅ ${label}`); }
  else { failed += 1; console.log(`❌ ${label}${detail ? `\n     ${detail}` : ''}`); }
}

(async () => {
  console.log(`环境：${config.env}\n`);

  const mod = require('@cloudbase/js-sdk');
  const sdk = mod.default || mod;
  const app = sdk.init(config);

  // 1) 匿名登录 —— 这是访客提交申请前的必经步骤
  const auth = app.auth();
  const signIn = await auth.signInAnonymously();
  check('匿名登录成功', !signIn?.error, signIn?.error?.message || JSON.stringify(signIn).slice(0, 200));

  // 2) 调云函数 health
  const health = await app.callFunction({ name: 'yard-api', parse: true, data: { action: 'health' } });
  const healthText = JSON.stringify(health);
  check('callFunction 可达', !health?.error && healthText.includes('"ok":true'), healthText.slice(0, 260));

  // 3) 提交动作可达（宠物不存在 → 业务级报错即说明整条链路通）
  const submit = await app.callFunction({
    name: 'yard-api',
    parse: true,
    data: {
      action: 'application.submit',
      petId: '__probe_nonexistent_pet__',
      applicationType: '正式领养申请',
      name: '探针测试', age: 30, gender: '女',
      contact: `__probe_${Date.now()}__`,
      hasChengduHome: true, experience: '有',
      familyAgreement: '全部同意', otherPets: '没有', note: '',
      website: '', formStartedAt: Date.now() - 60000,
      browserToken: `probe-${Date.now()}`
    }
  });
  const submitText = JSON.stringify(submit);
  check('提交链路可达（返回业务级提示即为通）',
    submitText.includes('找不到这只宠物') || submitText.includes('提交过于频繁') || submitText.includes('上限'),
    submitText.slice(0, 300));

  // 4) 客户端直接读公开数据（宠物列表）—— 首页渲染所依赖的路径
  const db = app.rdb();
  const pets = await db.from('pets').select('id,name').eq('is_published', true).limit(3);
  const petRows = Array.isArray(pets?.data) ? pets.data : [];
  check('匿名可读公开宠物档案', petRows.length > 0, JSON.stringify(pets).slice(0, 260));
  if (petRows.length) console.log(`     读到 ${petRows.length} 条：${petRows.map(p => p.name).join('、')}`);

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  if (failed === 0) console.log('浏览器通路完整：访客可以正常浏览并提交申请。');
  process.exit(failed ? 1 : 0);
})().catch(error => {
  console.error('探针异常：', error?.message || error);
  process.exit(1);
});
