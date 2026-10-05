/**
 * 校验 Vue 版灰度站（/v2/）是否可用，以及正式站是否保持原样。
 *
 * 之所以要单独验证正式站：灰度发布的前提就是"不影响线上"，
 * 这一步就是把这句话验证出来，而不是假设它成立。
 */
const base = 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.tcloudbaseapp.com';

let passed = 0;
let failed = 0;
function check(label, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✅ ${label}`);
  } else {
    failed += 1;
    console.log(`❌ ${label}${detail ? `\n     ${detail}` : ''}`);
  }
}

(async () => {
  console.log('--- 灰度站 /v2/ ---');
  const response = await fetch(`${base}/v2/?t=${Date.now()}`);
  const html = await response.text();
  check('/v2/ 返回 200', response.status === 200, `实际 ${response.status}`);
  check('确实是 Vue 版页面（含 #app 挂载点）', html.includes('id="app"'), html.slice(0, 200));
  check('不再包含原生版配置', !html.includes('YARD_CLOUD_CONFIG'), html.slice(0, 300));

  // 资源必须是 /v2/ 前缀，否则子路径部署会 404
  const assets = [];
  const re = /(?:src|href)="([^"]+)"/g;
  let match;
  while ((match = re.exec(html))) assets.push(match[1]);
  check(
    '引用了构建产物',
    assets.some(a => a.includes('/v2/assets/')),
    assets.join(', ')
  );
  check(
    '所有资源都带 /v2/ 前缀（子路径部署正确）',
    assets.every(a => a.startsWith('/v2/') || a.startsWith('http')),
    assets.join(', ')
  );

  for (const asset of assets) {
    const url = asset.startsWith('http') ? asset : base + asset;
    const result = await fetch(url);
    const size = Number(result.headers.get('content-length') || 0);
    check(`资源可访问 ${asset}`, result.status === 200, `HTTP ${result.status}`);
    if (asset.endsWith('.js') && asset.includes('assets/')) {
      console.log(`     ${asset.split('/').pop()}  ${(size / 1024).toFixed(1)} KB`);
    }
  }

  console.log('\n--- 正式站 / （灰度期间必须保持原样）---');
  const home = await (await fetch(`${base}/?t=${Date.now()}`)).text();
  check('正式站仍是原生 JS 版', home.includes('YARD_CLOUD_CONFIG'), '正式站被改动了！');
  check('正式站仍引用 app.js', home.includes('app.js'), '正式站缺少 app.js 引用');
  const appJs = await fetch(`${base}/app.js?t=${Date.now()}`);
  check('正式站 app.js 可访问', appJs.status === 200, `HTTP ${appJs.status}`);

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  if (failed === 0) {
    console.log(`灰度站地址：${base}/v2/`);
    console.log('正式站未受影响，可以放心让访客继续使用。');
  }
  process.exit(failed ? 1 : 0);
})();
