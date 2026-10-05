/**
 * 判断「前端直接写数据库」这条路在新环境下是否可用。
 *
 * 方法：用匿名身份尝试写入一个它**本就不该有权写**的表，
 * 然后看**报错的来源**——这一步能区分两种完全不同的故障：
 *
 *   A. 报数据库层的错误（permission denied / row-level security）
 *      → 说明请求**已经到达数据库**，写入通路是好的，
 *        管理员删不了申请是表级/策略级问题
 *
 *   B. 报网关层的错误（EXCEED_AUTHORITY / 401 / 403）
 *      → 说明请求**在网关就被拦下了**，写入通路本身不通，
 *        那么「保存网站设置」「保存 AI Key」也会一起失败
 *
 * 预期会写入失败（匿名本来就不该写得进去），这是设计如此，不是缺陷。
 *
 * 用法：node tools/probe-write-path.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: key => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: index => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    }
  };
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const config = new Function(`return (${html.match(/window\.YARD_CLOUD_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/)[1]});`)();

/** 把返回值里的错误信息挖出来，保留原始文本便于判断来源。 */
function describe(result) {
  if (!result) return '(无返回)';
  if (result.error) {
    const parts = [result.error.message, result.error.code, result.error.details, result.error.hint].filter(Boolean).map(String);
    return parts.join(' | ');
  }
  return JSON.stringify(result).slice(0, 300);
}

/**
 * 给每次调用加超时。
 *
 * SDK 在请求被拒时可能长时间重试，会把脚本挂住；
 * 超时不等于"通过"，只代表这一步没能在限时内给出结论。
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise.then(value => ({ ok: true, value })).catch(error => ({ ok: false, value: { error: { message: error?.message || String(error) } } })),
    new Promise(resolve => setTimeout(() => resolve({ ok: false, value: { error: { message: `${label} 超时（${ms}ms，SDK 可能在重试）` } } }), ms))
  ]);
}

(async () => {
  const mod = require('@cloudbase/js-sdk');
  const sdk = mod.default || mod;
  const app = sdk.init(config);

  console.log(`环境：${config.env}\n`);

  try {
    await withTimeout(app.auth().signInAnonymously(), 20000, '匿名登录');
  } catch {
    /* 忽略 */
  }
  const db = app.rdb();

  console.log('【1】匿名读取（对照组，应当成功）');
  const read = await withTimeout(db.from('pets').select('id,name').limit(1), 20000, '读取');
  console.log('  →', describe(read.value));

  console.log('\n【2】匿名 INSERT 到 yard_settings（预期被拒，重点看拒绝来自哪一层）');
  const insert = await withTimeout(
    db.from('yard_settings').upsert(
      {
        key: '__write_path_probe__',
        value: { probe: true },
        updated_at: new Date().toISOString()
      },
      { onConflict: 'key' }
    ),
    25000,
    'INSERT'
  );
  console.log('  →', describe(insert.value));

  console.log('\n【3】匿名 UPDATE 公开表（预期被拒）');
  const update = await withTimeout(db.from('pets').update({ name: '探针不该改成功' }).eq('id', '__probe_nonexistent__'), 25000, 'UPDATE');
  console.log('  →', describe(update.value));

  console.log('\n════════ 判定 ════════');
  const text = `${describe(insert.value)} ${describe(update.value)}`;
  const gatewayLevel = /EXCEED_AUTHORITY|exceeds granted authority|Unauthorized|401|403/i.test(text);
  const databaseLevel = /permission denied|row-level security|violates|policy|42501/i.test(text);
  if (gatewayLevel && !databaseLevel) {
    console.log('  ⚠️ 结论 B：写入在**网关层**就被拦下 → 前端直接写数据库整体不可用，');
    console.log('     「保存网站设置」和「保存 AI Key」会一起失败。');
  } else if (databaseLevel) {
    console.log('  ✅ 结论 A：请求**已到达数据库**（数据库层拒绝，且匿名本就无权写）');
    console.log('     → 写入通路是好的，删除失败的原因在表级/策略级，需另查。');
  } else {
    console.log('  ❓ 无法判定，请人工查看上面的原始错误文本。');
  }
  process.exit(0);
})();
