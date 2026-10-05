/**
 * Function Calling / Agent 循环的端到端测试。
 *
 * 验证的核心问题：**模型是真的去查了数据，还是凭上下文猜的？**
 * 光看回答像不像样是看不出来的——必须看到 tool 事件真的发生。
 *
 * 测试策略：故意问只有查数据库才能回答的问题。
 *   「领养要收费吗、怎么回访」→ 不查政策就只能编
 *   「在册有哪些狗狗」        → 不查档案就只能编
 * 若模型没有调用工具却答得很自信，说明工具层没接上（或提示词没起作用）。
 *
 * 用法：node tools/test-ai-tools.cjs
 */
const ENDPOINT = 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.ap-shanghai.app.tcloudbase.com/ai-stream/chat';

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) { passed += 1; console.log(`  ✅ ${label}`); }
  else { failed += 1; console.log(`  ❌ ${label}${detail ? ` —— ${detail}` : ''}`); }
}

/** 发一次对话，收集全部 SSE 事件。 */
async function ask(question, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events = [];
  let text = '';
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: question }] }),
      signal: controller.signal
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        try {
          const payload = JSON.parse(trimmed.slice(5).trim());
          events.push(payload);
          if (payload.type === 'delta') text += payload.text;
        } catch { /* 忽略不完整行 */ }
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return { events, text, httpStatus: 'ok' };
}

function toolSummary(events) {
  const tools = events.filter(e => e.type === 'tool');
  return {
    names: [...new Set(tools.map(t => t.name))],
    started: tools.filter(t => t.status === 'running').length,
    finished: tools.filter(t => t.status === 'done').length,
    summaries: tools.filter(t => t.status === 'done').map(t => `${t.name}:${t.summary}`)
  };
}

(async () => {
  console.log('Function Calling / Agent 循环测试\n');

  // ── 健康检查：先确认工具层已加载 ──────────────────────────
  console.log('【0】服务与工具清单');
  const health = await (await fetch(ENDPOINT.replace('/chat', '/'))).json();
  check('服务可达', health.ok === true);
  check('已加载工具（≥5）', (health.tools?.count || 0) >= 5, `实际 ${health.tools?.count}`);
  check('工具名符合预期', ['search_pets', 'get_pet_profile', 'get_adoption_policy'].every(n => health.tools?.names?.includes(n)), (health.tools?.names || []).join(','));

  // ── 用例一：只有查政策才能答 ─────────────────────────────
  console.log('\n【1】问政策类问题（不查数据库只能编）');
  const policy = await ask('请问在你们这里领养要收费吗？后续会回访吗？');
  const policyTools = toolSummary(policy.events);
  console.log('     实际调用的工具:', policyTools.names.join(', ') || '（无）');
  console.log('     工具结果摘要:', policyTools.summaries.join(' | ') || '（无）');
  console.log('     回答前 60 字:', policy.text.slice(0, 60).replace(/\n/g, ' '));
  check('确实调用了工具', policyTools.names.length > 0, '模型没查数据就作答，工具层可能未生效');
  check('调用了 get_adoption_policy', policyTools.names.includes('get_adoption_policy'), `实际：${policyTools.names.join(',')}`);
  check('工具的 started/done 成对出现', policyTools.started > 0 && policyTools.started === policyTools.finished, `started=${policyTools.started} done=${policyTools.finished}`);
  check('给出非空回答', policy.text.trim().length > 20, `长度 ${policy.text.trim().length}`);
  check('以 done 事件收尾', policy.events.some(e => e.type === 'done'));
  check('没有 error 事件', !policy.events.some(e => e.type === 'error'), JSON.stringify(policy.events.find(e => e.type === 'error')));

  // ── 用例二：只有查档案才能答 ─────────────────────────────
  console.log('\n【2】问档案类问题（必须先查才能知道有哪些）');
  const roster = await ask('小院现在在册的狗狗都有哪些？各自什么年纪？');
  const rosterTools = toolSummary(roster.events);
  console.log('     实际调用的工具:', rosterTools.names.join(', ') || '（无）');
  console.log('     工具结果摘要:', rosterTools.summaries.join(' | ') || '（无）');
  console.log('     回答前 60 字:', roster.text.slice(0, 60).replace(/\n/g, ' '));
  check('确实调用了工具', rosterTools.names.length > 0);
  check('给出了非空回答', roster.text.trim().length > 20);

  // ── 用例三：多步问题，看是否自主规划 ─────────────────────
  console.log('\n【3】多步问题（需要先查列表、再看细节）');
  const multi = await ask('我想领养一只猫，我租房住，房东同意，白天家里有人。你觉得我适合哪只？');
  const multiTools = toolSummary(multi.events);
  console.log('     实际调用的工具:', multiTools.names.join(', ') || '（无）');
  console.log('     调用次数:', multiTools.started);
  console.log('     回答前 80 字:', multi.text.slice(0, 80).replace(/\n/g, ' '));
  check('确实调用了工具', multiTools.names.length > 0);
  check('回答里提到了具体宠物名或"没有匹配"', /喜豆|小黄|旺仔|皮蛋|花卷|coco|没有|不太匹配/i.test(multi.text), '回答过于笼统');
  check('没有 error 事件', !multi.events.some(e => e.type === 'error'));

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  process.exit(failed ? 1 : 0);
})();
