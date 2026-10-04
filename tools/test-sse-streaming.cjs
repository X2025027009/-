/**
 * SSE 流式验证客户端。
 *
 * 判定标准：记录「首个字节到达时间」与「全部结束时间」。
 *   - 真流式：首字节 ≈ 400ms（第一条事件），全部结束 ≈ 2400ms（6 条 × 400ms）
 *   - 被缓冲：所有数据几乎同时到达，首字节 ≈ 总时长 ≈ 2400ms
 *
 * 用法：
 *   node tools/test-sse-streaming.cjs
 *   SSE_BASE=https://xxx.service.tcloudbase.com/ai-stream node tools/test-sse-streaming.cjs
 */
/**
 * 注意：可用地址是 `app.tcloudbase.com` 这个（触发类型为 Cloud hosting）。
 * `.service.tcloudbase.com` 那个会返回 400 FUNCTIONS_PARAM_INVALID，别用。
 */
const BASE = process.env.SSE_BASE || 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.ap-shanghai.app.tcloudbase.com/ai-stream';

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) { passed += 1; console.log(`✅ ${label}`); }
  else { failed += 1; console.log(`❌ ${label}${detail ? `\n     ${detail}` : ''}`); }
}

async function probe(context, url) {
  console.log(`\n--- ${context} ---`);
  console.log(`URL: ${url}`);
  const startedAt = Date.now();
  const response = await fetch(url, { headers: { Accept: 'text/event-stream' } });
  if (!response.ok) {
    console.log(`HTTP ${response.status}，无法继续`);
    return null;
  }
  const contentType = response.headers.get('content-type') || '';
  if (!response.body) { console.log('无响应体'); return null; }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const arrivals = [];
  let text = '';
  let firstByteMs = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const at = Date.now() - startedAt;
    if (firstByteMs === null) firstByteMs = at;
    arrivals.push({ at, bytes: value ? value.length : 0 });
    text += decoder.decode(value, { stream: true });
  }
  const totalMs = Date.now() - startedAt;

  console.log(`HTTP ${response.status}  content-type: ${contentType}`);
  console.log(`首字节: ${firstByteMs} ms    全部结束: ${totalMs} ms    数据块数: ${arrivals.length}`);
  console.log(`到达时刻(ms): ${arrivals.map(a => a.at).join(', ')}`);
  const events = text.split('\n\n').filter(Boolean);
  console.log(`收到事件数: ${events.length}`);
  console.log(`正文前 200 字: ${text.slice(0, 200).replace(/\n/g, '\\n')}`);

  return { firstByteMs, totalMs, arrivals, events, text, contentType };
}

(async () => {
  console.log(`目标：${BASE}\n`);

  // 1) 先确认函数可达、看它看到的路径
  const info = await probe('可达性 + 路径回显', `${BASE}/`);
  if (info) {
    let parsed = null;
    try { parsed = JSON.parse(info.text); } catch { /* 非 JSON */ }
    check('函数可达并返回 JSON', Boolean(parsed?.ok), info.text.slice(0, 200));
    if (parsed) console.log(`     函数看到的路径: ${parsed.seenUrl}`);
  }

  // 2) 核心：SSE 是否真的边生成边推
  const stream = await probe('SSE 流式验证', `${BASE}/sse?cb=${Date.now()}`);
  if (!stream) {
    console.log('\n无法验证流式：SSE 端点不可用');
    console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
    process.exit(1);
  }

  check('返回 text/event-stream 内容类型', stream.contentType.includes('text/event-stream'), stream.contentType);
  check('收到 6 条事件', stream.events.length === 6, `实际 ${stream.events.length} 条`);
  check('数据不是一次性返回（分多次到达）', stream.arrivals.length >= 4, `数据块数 ${stream.arrivals.length}`);
  check('首个字节明显早于结束（真流式）', stream.firstByteMs !== null && stream.firstByteMs < stream.totalMs * 0.5, `首字节 ${stream.firstByteMs}ms / 总 ${stream.totalMs}ms`);
  check('总时长符合预期（约 2.4 秒）', stream.totalMs > 2000 && stream.totalMs < 6000, `实际 ${stream.totalMs}ms`);
  check('首字节约 400ms 左右（第一条事件）', stream.firstByteMs !== null && stream.firstByteMs < 1500, `实际 ${stream.firstByteMs}ms`);

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  if (failed === 0) console.log('结论：CloudBase HTTP 云函数**支持真正的 SSE 流式推送**。');
  else console.log('结论：未能确认流式，需要进一步排查（可能是中间层缓冲）。');
  process.exit(failed ? 1 : 0);
})();
