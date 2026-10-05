/**
 * 群消息预览 / 投递工具。
 *
 * 关键点：它**不是**另写一份消息模板，而是从 functions/yard-api/index.js 里
 * 抽出线上真正在用的 buildWeComContent、wecomLine、beijingTime 来执行，
 * 因此预览结果与实际收到的消息一致，不会出现"预览和线上不一样"的漂移。
 *
 * 用法：
 *   node tools/preview-wecom-message.cjs            # 只打印预览，不发送
 *   WECOM_URL=... node tools/preview-wecom-message.cjs --send   # 真实投递到群
 *
 * 注意：机器人地址只从环境变量读取，绝不打印。
 */
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'functions', 'yard-api', 'index.js'), 'utf8');

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`没有找到函数 ${name}`);
  let depth = 0;
  for (let i = text.indexOf('{', start); i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`函数 ${name} 的花括号不匹配`);
}

const siteUrl = (source.match(/const SITE_URL = [^\n]*?'(https:\/\/[^']+)'/) || [])[1] || '';
const factory = new Function(`
  const SITE_URL = ${JSON.stringify(siteUrl)};
  ${extractFunction(source, 'text')}
  ${extractFunction(source, 'wecomLine')}
  ${extractFunction(source, 'truncateUtf8')}
  ${extractFunction(source, 'beijingTime')}
  ${extractFunction(source, 'buildWeComContent')}
  return { buildWeComContent };
`);
const { buildWeComContent } = factory();

// 预览用的虚构数据，一看就知道是样例。
const SAMPLE = {
  id: 'application_preview_0000-0000-0000-000000000000',
  pet_id: 'pet-preview',
  pet_name: '旺仔',
  application_type: '正式领养申请',
  submitted_at: new Date().toISOString(),
  applicant_name: '张小明（样例）',
  applicant_age: 32,
  applicant_gender: '女',
  contact: '13800001234（样例）',
  has_chengdu_home: true,
  experience: '有',
  family_agreement: '全部同意',
  other_pets: '有猫',
  note: '家里已有一只三岁猫咪，希望再领养一只性格温和的狗狗。工作日白天家中有人。'
};

(async () => {
  const content = buildWeComContent(SAMPLE, 3);
  console.log('=== 实际会发到群里的消息（纯文本原文） ===\n');
  console.log(content);
  console.log('\n=== 以上内容由线上同一个函数生成 ===');

  const webhook = process.env.WECOM_URL || '';
  if (!process.argv.includes('--send')) {
    console.log('\n（未指定 --send，只做预览，没有发送）');
    return;
  }
  if (!webhook) {
    console.log('\n❌ 环境变量 WECOM_URL 为空，无法发送。');
    process.exit(1);
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 必须与云函数保持一致：纯文本类型，markdown 在微信插件里显示不出来。
    body: JSON.stringify({ msgtype: 'text', text: { content } })
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    /* 非 JSON */
  }
  console.log(`\nHTTP ${response.status}  errcode=${body?.errcode}  errmsg=${body?.errmsg}`);
  if (body?.errcode === 0) console.log('✅ 已投递到群，请查看渲染效果。');
  else process.exit(1);
})();
