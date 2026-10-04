/**
 * 校验 AI 匹配助手的预览站（/v3/），并确认正式站未被改动。
 *
 * 之所以分开验证：这次是"给原版加功能"，必须证明
 * 既有功能一个没动、且新功能确实在页面上。
 */
const base = 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.tcloudbaseapp.com';
const aiHealth = 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.ap-shanghai.app.tcloudbase.com/ai-stream/';

let passed = 0;
let failed = 0;
function check(label, ok, detail = '') {
  if (ok) { passed += 1; console.log(`✅ ${label}`); }
  else { failed += 1; console.log(`❌ ${label}${detail ? `\n     ${detail}` : ''}`); }
}

async function grab(url) {
  const response = await fetch(`${url}?t=${Date.now()}`);
  return { status: response.status, body: await response.text() };
}

(async () => {
  console.log('--- 预览站 /v3/（原版设计 + AI 匹配助手）---');
  const page = await grab(`${base}/v3/`);
  check('/v3/ 返回 200', page.status === 200, `实际 ${page.status}`);
  check('新增 AI 区块存在', page.body.includes('id="match"'), '找不到 #match');
  check('导航里有入口', page.body.includes('href="#match"'), '找不到导航链接');
  check('保留了原版 hero 区块', page.body.includes('class="hero"'), '原版结构被破坏');
  check('保留了原版宠物网格', page.body.includes('id="petGrid"'), '原版结构被破坏');
  check('保留了原版领养流程区块', page.body.includes('id="how"'), '原版结构被破坏');
  check('保留了原版回访档案区块', page.body.includes('id="stories"'), '原版结构被破坏');
  check('保留了原版联系区块', page.body.includes('id="about"'), '原版结构被破坏');

  const css = await grab(`${base}/v3/styles.css`);
  check('样式表可访问', css.status === 200, `HTTP ${css.status}`);
  check('含 AI 面板样式', css.body.includes('.match-panel'), '缺少 .match-panel');
  check('沿用了原版设计变量', css.body.includes('var(--warm-yellow)') && css.body.includes('var(--radius)'), '没有复用原版变量');
  check('原版样式仍在（未被覆盖）', css.body.includes('--cream:') && css.body.includes('.pet-card'), '原版样式丢失');

  const js = await grab(`${base}/v3/app.js`);
  check('脚本可访问', js.status === 200, `HTTP ${js.status}`);
  check('含 AI 端点调用', js.body.includes('/ai-stream/chat'), '缺少端点');
  check('含流式解析', js.body.includes('getReader()'), '缺少 ReadableStream 解析');
  check('含中断控制', js.body.includes('AbortController'), '缺少中断控制');
  check('原版逻辑仍在（未被覆盖）', js.body.includes('submitApplicationThroughFunction') && js.body.includes('loadCloudAdminData'), '原版逻辑丢失');

  console.log('\n--- 正式站 / （2026-10-05 已切换为含 AI 版本）---');
  const home = await grab(`${base}/`);
  check('正式站可访问', home.status === 200, `HTTP ${home.status}`);
  check('正式站含 AI 区块', home.body.includes('id="match"'), '正式站缺少 AI 区块');
  check('正式站保留原版结构', home.body.includes('id="petGrid"') && home.body.includes('id="how"') && home.body.includes('id="stories"'), '原版结构丢失');

  console.log('\n--- AI 后端联通性 ---');
  const health = await (await fetch(aiHealth)).json();
  check('AI 服务在线', health?.ok === true, JSON.stringify(health));
  console.log(`     模式：${health?.mockMode ? 'mock（未配 Key，返回演示内容）' : `真实模型 ${health.model}`}`);

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  if (failed === 0) console.log(`预览地址：${base}/v3/`);
  process.exit(failed ? 1 : 0);
})();
