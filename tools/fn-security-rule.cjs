/**
 * 查询 / 设置「云函数安全规则」。
 *
 * 背景：环境迁移后匿名访客调用云函数被拦（EXCEED_AUTHORITY），
 * 而 OPA 网关策略已排除（差分测试证明：故意 deny 数据库会立刻生效，
 * 但无条件 allow 也打不开云函数 → 说明云函数还有一道独立关卡）。
 *
 * 官方 Manager SDK 文档给出的接口：
 *   查询：Action = DescribeSecurityRule, Param = { EnvId, ResourceType: "FUNCTION" }
 *   设置：Action = ModifySecurityRule, Param = { EnvId, ResourceType: "FUNCTION",
 *                                               AclTag: "CUSTOM", Rule: <JSON 字符串> }
 *   官方示例中的 Rule 即 {"*":{"invoke":true}}
 *
 * 用法：
 *   node tools/fn-security-rule.cjs describe     # 只读，查看当前规则
 *   node tools/fn-security-rule.cjs apply        # 设为 {"*":{"invoke":true}}
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const envId = process.env.YARD_ENV || 'chuanzhibei-d3gvmowp1e63d7f33';
const cliEntry = path.join(root, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase');
const mode = (process.argv[2] || 'describe').toLowerCase();

/** 用 node 直接调用 CLI 的 JS 入口，避免 shell 引号/转义问题。 */
function callApi(action, body) {
  const result = spawnSync(
    process.execPath,
    [cliEntry, 'api', 'tcb', action, '--body', JSON.stringify(body), '--json'],
    { encoding: 'utf8' }
  );
  if (result.error) throw result.error;
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

(async () => {
  console.log(`环境：${envId}\n`);

  console.log('═══ 当前云函数安全规则 ═══');
  const described = callApi('DescribeSecurityRule', { EnvId: envId, ResourceType: 'FUNCTION' });
  const current = parseJson(described.stdout);
  if (!current) {
    console.log('查询失败，原始输出：');
    console.log(described.stdout.slice(0, 600));
    console.log(described.stderr.slice(0, 600));
  } else {
    const payload = current.data || current.Response || current;
    console.log(`  AclTag: ${payload.AclTag ?? '(空)'}`);
    console.log(`  Rule  : ${payload.Rule === null ? '(null)' : (payload.Rule ?? '(空)')}`);
  }

  if (mode !== 'apply') {
    console.log('\n（未做任何修改。要设置为 {"*":{"invoke":true}}，请运行：node tools/fn-security-rule.cjs apply）');
    return;
  }

  console.log('\n═══ 设置为 {"*":{"invoke":true}} ═══');
  const rule = JSON.stringify({ '*': { invoke: true } });
  const applied = callApi('ModifySecurityRule', {
    EnvId: envId,
    ResourceType: 'FUNCTION',
    AclTag: 'CUSTOM',
    Rule: rule
  });
  console.log(applied.stdout.slice(0, 600));
  console.log(applied.stderr.slice(0, 600));

  console.log('\n═══ 复查 ═══');
  const verify = parseJson(callApi('DescribeSecurityRule', { EnvId: envId, ResourceType: 'FUNCTION' }).stdout);
  const payload = verify?.data || verify?.Response || verify;
  console.log(`  AclTag: ${payload?.AclTag ?? '(空)'}`);
  console.log(`  Rule  : ${payload?.Rule ?? '(空)'}`);
})();
