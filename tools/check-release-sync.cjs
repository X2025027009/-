/**
 * 发布同步检查。
 *
 * 本站的发布源是 release/ 目录（三个文件），根目录是它们的"源码"。
 * 这里有两个容易漏的环节，本项目都真实发生过：
 *   ① 改了根目录文件，忘了同步到 release/ —— 部署上去的还是旧版本；
 *   ② 同步了 release/，忘了执行部署 —— 线上仍是旧的。
 * 两个环节都不会报错，只会表现为"我明明改了，线上怎么没变"。
 *
 * 因此这个检查做两件事：
 *   1. 根目录与 release/ 逐字节比对；
 *   2. 抓线上文件与 release/ 比对哈希，确认部署真的生效了。
 *
 * 用法：node tools/check-release-sync.cjs
 *      node tools/check-release-sync.cjs --offline   （跳过线上比对）
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const FILES = ['app.js', 'index.html', 'styles.css'];
const SITE = 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.tcloudbaseapp.com';
const offline = process.argv.includes('--offline');

/**
 * 站点素材（assets/ 下的图片等）也要一起比对。
 *
 * 之前只盯三个代码文件，后来加了小院合影才发现：改了图没同步、
 * 或者图没上传，检查都不会报——而那两件事同样会让线上显示旧内容。
 */
function assetFiles() {
  const dir = path.join(ROOT, 'assets');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => !name.startsWith('.'))
    .map(name => `assets/${name}`);
}
const ALL_FILES = [...FILES, ...assetFiles()];

const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) { passed += 1; console.log(`  ✅ ${label}`); }
  else { failed += 1; console.log(`  ❌ ${label}${detail ? ` —— ${detail}` : ''}`); }
}

(async () => {
  console.log('发布同步检查\n');

  console.log('【1】根目录 → release/');
  for (const file of ALL_FILES) {
    const rootPath = path.join(ROOT, file);
    const releasePath = path.join(ROOT, 'release', file);
    if (!fs.existsSync(rootPath) || !fs.existsSync(releasePath)) {
      check(`${file} 两个位置都存在`, false);
      continue;
    }
    const same = sha(fs.readFileSync(rootPath)) === sha(fs.readFileSync(releasePath));
    check(`${file} 已同步到 release/`, same, '根目录改了但没复制到 release/，部署上去的还是旧版本');
  }

  if (offline) {
    console.log('\n（--offline：跳过线上比对）');
  } else {
    console.log('\n【2】release/ → 线上');
    for (const file of ALL_FILES) {
      const local = fs.readFileSync(path.join(ROOT, 'release', file));
      try {
        const response = await fetch(`${SITE}/${file}?t=${Date.now()}`);
        const remote = Buffer.from(await response.arrayBuffer());
        check(`${file} 线上与发布源一致`, sha(local) === sha(remote), 'release/ 改了但没执行部署，线上仍是旧版本');
      } catch (error) {
        check(`${file} 可访问`, false, error.message);
      }
    }
  }

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  // 不在 fetch 连接关闭前强行退出，否则会有 Node 的 UV_HANDLE_CLOSING 断言噪音
  process.exitCode = failed ? 1 : 0;
})();
