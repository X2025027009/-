/**
 * 打印 SDK 实际发出的网关请求路径（带超时保护）。
 *
 * 用途：OPA 鉴权策略按 `input.cloudbase.resource_type` 判断资源类型，
 * 而这个字段的**确切取值**必须从真实请求路径反推——猜错会导致
 * 策略放行错误的资源，而 OPA 是「拒绝优先 + 不可回退」的。
 *
 * 每一步都有超时，避免 SDK 在 403 之后长时间重试导致脚本挂住。
 *
 * 用法：node tools/probe-gateway-paths.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

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

const seen = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : (input?.url || String(input));
  if (String(url).includes('tcloudbasegateway')) {
    try {
      const parsed = new URL(String(url));
      seen.push(`${(init?.method || 'GET').toUpperCase()}  ${parsed.pathname}`);
    } catch { /* 忽略无法解析的 URL */ }
  }
  return originalFetch(input, init);
};

/** 给每步加超时，超时不算失败，只是继续。 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(`${label} 超时（${ms}ms），跳过`), ms))
  ]).catch(error => `${label} 异常：${error?.message || error}`);
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const config = new Function(`return (${html.match(/window\.YARD_CLOUD_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/)[1]});`)();

(async () => {
  const mod = require('@cloudbase/js-sdk');
  const sdk = mod.default || mod;
  const app = sdk.init(config);

  console.log('按顺序执行三类操作，记录各自的网关路径：\n');

  console.log('【1】匿名登录 →', await withTimeout(app.auth().signInAnonymously(), 20000, '匿名登录'));
  console.log('【2】调用云函数 →', await withTimeout(app.callFunction({ name: 'yard-api', parse: true, data: { action: 'health' } }), 20000, '调用云函数'));
  console.log('【3】读取数据库 →', await withTimeout(app.rdb().from('pets').select('id,name').eq('is_published', true).limit(1), 20000, '读取数据库'));

  console.log('\n════════ 命中网关的请求路径 ════════');
  const resourceTypes = new Set();
  for (const line of seen) {
    console.log(`  ${line}`);
    const segments = line.split(/\s+/).pop().split('/').filter(Boolean);
    if (segments[1]) resourceTypes.add(segments[1]);
  }

  console.log('\n════════ 推断出的 resource_type 候选值 ════════');
  for (const type of resourceTypes) console.log(`  "${type}"`);
  console.log('\n（OPA 策略中写作 input.cloudbase.resource_type == "<上面的值>"）');

  // 强制退出：SDK 可能仍有挂起的定时器
  process.exit(0);
})();
