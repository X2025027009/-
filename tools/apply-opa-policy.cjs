/**
 * 应用 OPA 鉴权策略。
 *
 * 为什么不直接写 PowerShell 命令：
 *   Windows 下把多行字符串作为参数传给原生程序时，**换行会被截断**，
 *   服务端只收到第一行（`package authz.user`），校验直接报
 *   `policy_missing_rule: none found in package authz.user`。
 *
 *   这里改用 node 直接调用 CLI 的 JS 入口（不经 shell），
 *   把 Rego 内容作为单个 argv 元素传递，换行完整保留。
 *
 * 用法：node tools/apply-opa-policy.cjs [envId]
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const envId = process.argv[2] || process.env.YARD_ENV || 'chuanzhibei-d3gvmowp1e63d7f33';
// 第二个参数可指定策略文件，便于先应用诊断策略再恢复正式策略
const policyFile = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'cloudbase', 'policy', 'authz.rego');
const cliEntry = path.join(root, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase');

const rego = fs.readFileSync(policyFile, 'utf8');
console.log(`策略文件：${policyFile}`);
console.log(`策略内容：${rego.length} 字节 / ${rego.split('\n').length} 行`);
console.log(`目标环境：${envId}`);
console.log('（提示：保存后会停用旧网关鉴权；如策略有问题，可再次运行本脚本覆盖）\n');

// stdio[0] 用 pipe 以便自动应答确认提示；stdout/stderr 直接继承，不做捕获
const result = spawnSync(process.execPath, [cliEntry, 'policy', 'set', rego, '-e', envId, '--json'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  input: 'Y\n'
});

console.log(`\n退出码：${result.status}`);
if (result.error) console.error('子进程错误：', result.error.message);
process.exit(typeof result.status === 'number' ? result.status : 1);
