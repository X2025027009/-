/**
 * AI 流式代理（CloudBase HTTP 云函数）
 *
 * 为什么单独一个函数：SSE 流式响应只在 HTTP（Web）云函数上支持，
 * 现有 yard-api 是 Event 类型，通过网关只返回一次性 JSON。
 *
 * 路由（HTTP 访问服务会剥掉 `/ai-stream` 前缀，函数内看到的是 `/chat`）：
 *   GET  /            健康信息
 *   POST /chat        访客侧「AI 领养匹配助手」，SSE 流式返回
 *
 * 前端收到的 SSE 事件（每行 `data: {json}`）：
 *   {"type":"meta","mock":false,"petCount":6}
 *   {"type":"delta","text":"..."}          // 增量正文，前端累加即可
 *   {"type":"done"}                        // 正常结束
 *   {"type":"error","message":"..."}       // 出错（HTTP 仍是 200，因为流已开始）
 *
 * ── 安全设计（比赛技术文档可直接引用）──
 *   1. API Key 只从环境变量 DEEPSEEK_API_KEY 读取，**绝不下发前端**；
 *   2. 访客侧按 IP 限频（复用 rate_limit_events 表），防止刷爆额度；
 *   3. 请求体与消息长度都有硬上限；
 *   4. 只把「宠物公开档案」+「用户自己输入的内容」发给模型，
 *      **不发送任何申请人隐私数据**；
 *   5. 模型输出只当文本流回前端，**不执行其中任何指令**；
 *   6. 未配置 API Key 时进入 mock 模式，前端与演示不依赖外网与额度。
 */
const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 9000;
const DEEPSEEK_HOST = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ── 输入硬上限 ──────────────────────────────────────────────
const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_CHARS = 600;
const MAX_TURNS = 8;
const MAX_OUTPUT_TOKENS = 900;

// ── 限频（10 分钟窗口 + 24 小时日上限）──────────────────────
const RATE_KIND = 'ai_chat';
const RATE_WINDOW_MAX = 15;
const RATE_DAILY_MAX = 120;

// ── CORS ────────────────────────────────────────────────────
// ⚠️ 实测结论：CloudBase HTTP 访问服务**自带 CORS**——对本站域名会自动加上
// Access-Control-Allow-Origin 与 Allow-Credentials，对其他来源则一律不放行。
//
// 如果自己也写一遍 ACAO，两个值会被合并成 `origin,origin`，
// 浏览器判定为非法值而**拒绝整个请求**（这个坑真的踩到了）。
// 因此这里**不自行设置任何 CORS 响应头**，完全交给平台处理。
// 只保留 OPTIONS 分支，避免预检请求落到业务逻辑上。

function text(value, max = 1000) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}
function hash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded || String(req.headers['x-real-ip'] || '') || '';
}

// ── 数据库：与 yard-api 相同的特权通道（ExecutePGSql）──────────
// 注意：函数内的 app.rdb() 以 anon 身份运行，读不到受限表，
// 因此这里沿用 yard-api 已验证的 OpenAPI 通道。
function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function tc3Date(timestamp) {
  const d = new Date(timestamp * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function hmacSha256(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}
/**
 * 解析可用于 ExecutePGSql 的临时凭证。
 *
 * 与 yard-api 的做法一致，但这里**不依赖 @cloudbase/node-sdk**：
 * 云函数运行时本来就会把带角色的临时凭证注入成环境变量，直接读即可，
 * 少一个依赖也少一份部署负担。环境变量拿不到时再退回腾讯云元数据服务。
 */
async function resolveSecret() {
  const secretId = text(process.env.TENCENTCLOUD_SECRETID, 300);
  const secretKey = text(process.env.TENCENTCLOUD_SECRETKEY, 300);
  if (secretId && secretKey) {
    return { source: 'env', secretId, secretKey, sessionToken: text(process.env.TENCENTCLOUD_SESSIONTOKEN, 4000) };
  }

  const roleName = process.env.ROLE_NAME || 'TCB_QcsRole';
  try {
    const response = await fetch(`http://metadata.tencentyun.com/latest/meta-data/cam/security-credentials/${roleName}`, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      const payload = await response.json();
      if (payload?.TmpSecretId && payload?.TmpSecretKey) {
        return { source: 'metadata', secretId: payload.TmpSecretId, secretKey: payload.TmpSecretKey, sessionToken: payload.Token || '' };
      }
    }
  } catch {
    /* 交给调用方统一报错 */
  }
  return null;
}
async function executePgSql(sql) {
  const credentials = await resolveSecret();
  const { secretId, secretKey, sessionToken } = credentials || {};
  const envId = process.env.TCB_ENV || process.env.SCF_NAMESPACE;
  if (!secretId || !secretKey || !envId) throw new Error('AI 服务暂不可用（凭据缺失）。');
  const service = 'tcb';
  const host = 'tcb.tencentcloudapi.com';
  const method = 'POST';
  const region = process.env.TENCENTCLOUD_REGION || process.env.TCB_REGION || 'ap-shanghai';
  const body = JSON.stringify({ EnvId: envId, Sql: sql });
  const timestamp = Math.floor(Date.now() / 1000);
  const date = tc3Date(timestamp);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `${method}\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256Hex(body)}`;
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${date}/${service}/tc3_request\n${sha256Hex(canonicalRequest)}`;
  const kDate = hmacSha256(`TC3${secretKey}`, date);
  const kSigning = hmacSha256(hmacSha256(kDate, service), 'tc3_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const headers = {
    Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${date}/${service}/tc3_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'Content-Type': 'application/json',
    Host: host,
    'X-TC-Action': 'ExecutePGSql',
    'X-TC-Region': region,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': '2018-06-08'
  };
  if (sessionToken) headers['X-TC-Token'] = sessionToken;
  const response = await fetch(`https://${host}/`, { method, headers, body });
  const result = await response.json();
  if (!response.ok || result?.Response?.Error) {
    throw new Error(result?.Response?.Error?.Message || 'AI 服务暂不可用（数据库）。');
  }
  return result.Response;
}
function sqlResult(response) {
  if (!Array.isArray(response?.Rows) || !response.Rows.length) throw new Error('AI 服务暂不可用（无返回）。');
  const row = JSON.parse(response.Rows[0]);
  const value = Array.isArray(row) ? row[0] : row;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

/** 读取可用于推荐的宠物公开档案。只取已发布，且不包含任何申请人信息。 */
async function loadPetCatalog() {
  const sql = `SELECT jsonb_build_object('pets', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'type', pet_type, 'status', adoption_status,
      'gender', gender, 'age', age_text, 'tags', tags,
      'description', description, 'health', health,
      'requirements', requirements, 'pauseReason', pause_reason
    ) ORDER BY created_at), '[]'::jsonb)) AS result
    FROM public.pets WHERE is_published = TRUE`;
  const payload = sqlResult(await executePgSql(sql));
  const pets = Array.isArray(payload?.pets) ? payload.pets : [];
  // 只保留推荐时真正有用的字段，减少 token 消耗
  return pets.map(pet => ({
    id: text(pet.id, 80),
    name: text(pet.name, 40),
    type: text(pet.type, 10),
    status: text(pet.status, 20),
    gender: text(pet.gender, 10),
    age: text(pet.age, 40),
    tags: Array.isArray(pet.tags) ? pet.tags.slice(0, 8).map(tag => text(tag, 20)) : [],
    description: text(pet.description, 500),
    health: text(pet.health, 300),
    requirements: text(pet.requirements, 300),
    pauseReason: text(pet.pauseReason, 200)
  }));
}

/** 访客侧限频：同一 IP 在 10 分钟内过多、或当天过多，直接拒绝。 */
async function checkRateLimit(ip) {
  const key = `${RATE_KIND}:ip:${hash(ip || 'unknown')}`;
  const sql = `WITH recent AS (
      SELECT count(*) AS n FROM public.rate_limit_events
      WHERE event_kind = ${sqlLiteral(RATE_KIND)} AND key_hash = ${sqlLiteral(key)}
        AND created_at >= NOW() - INTERVAL '10 minutes'
    ), daily AS (
      SELECT count(*) AS n FROM public.rate_limit_events
      WHERE event_kind = ${sqlLiteral(RATE_KIND)} AND key_hash = ${sqlLiteral(key)}
        AND created_at >= NOW() - INTERVAL '24 hours'
    ), logged AS (
      INSERT INTO public.rate_limit_events (id, event_kind, key_hash, created_at)
      VALUES (${sqlLiteral(`ai_${crypto.randomUUID()}`)}, ${sqlLiteral(RATE_KIND)}, ${sqlLiteral(key)}, NOW())
      RETURNING 1
    )
    SELECT jsonb_build_object(
      'allowed', (SELECT n FROM recent) < ${RATE_WINDOW_MAX} AND (SELECT n FROM daily) < ${RATE_DAILY_MAX},
      'recent', (SELECT n FROM recent), 'daily', (SELECT n FROM daily)
    ) AS result FROM (SELECT count(*) FROM logged) AS _`;
  return sqlResult(await executePgSql(sql));
}

/** 组装系统提示词。核心约束：只能用档案里的信息，不许编。 */
function buildSystemPrompt(pets) {
  const catalog = pets
    .map(pet => {
      const lines = [
        `名称：${pet.name}（${pet.type}·${pet.gender}·${pet.age}）`,
        `领养状态：${pet.status}`,
        pet.tags.length ? `标签：${pet.tags.join('、')}` : '',
        pet.description ? `性格与情况：${pet.description}` : '',
        pet.health ? `健康情况：${pet.health}` : '',
        pet.requirements ? `领养要求：${pet.requirements}` : '',
        pet.pauseReason ? `暂不开放原因：${pet.pauseReason}` : ''
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');

  return `你是「成都猫狗小院」流浪动物领养平台的 AI 领养匹配助手。

小院当前在册的宠物档案如下（这是你唯一可用的宠物信息来源）：
"""
${catalog}
"""

你的任务：根据访客描述的自身情况（居住条件、作息、养宠经验、家人态度等），从上面的档案里推荐 1-3 只最合适的宠物。

必须遵守：
1. **只能推荐档案里真实存在的宠物**，用档案里的名字称呼它们，绝不编造不存在的宠物或信息。
2. 每推荐一只，都要说明**为什么适合**，理由必须能对应到档案里的具体条目。
3. **主动指出访客可能没考虑到的风险**，例如：租房是否经房东同意、家人是否全部同意、白天家中是否有人、经济与时间投入、现有宠物是否合得来。
4. 如果访客的条件与所有宠物都不太匹配，要**如实说明**，并给出改善建议，不要硬推。
5. 不要替小院做任何承诺（不能承诺"一定能领养"），最终由小院与申请人沟通后决定。
6. 语气亲切、简洁，用中文，不要用 markdown 标题符号，不要输出 JSON。
7. 控制在 300 字以内。`;
}

/** 校验并规范化前端传来的对话历史。 */
function normalizeMessages(raw) {
  if (!Array.isArray(raw)) throw new Error('对话格式不正确。');
  const turns = raw
    .slice(-MAX_TURNS)
    .map(item => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: text(item?.content, MAX_MESSAGE_CHARS)
    }))
    .filter(item => item.content);
  if (!turns.length) throw new Error('请先描述一下你的情况。');
  if (turns[turns.length - 1].role !== 'user') throw new Error('最后一条消息需要来自访客。');
  return turns;
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/** mock 模式：没配 API Key 时也能完整跑通前后端与演示。 */
async function streamMock(res, pets, messages) {
  const asked = messages[messages.length - 1].content;
  const candidates = pets.filter(pet => pet.status === '待领养').slice(0, 2);
  const pick = candidates[0] || pets[0];
  const body = pick
    ? `【当前为演示模式，未接入大模型】\n你提到「${text(asked, 60)}」。根据小院现有档案，我建议你先了解 ${pick.name}：${pick.age}的${pick.type}，${text(pick.description, 80) || '性格温和'}。它的领养要求是：${text(pick.requirements, 80) || '暂未特别注明'}。\n同时提醒你确认两件事：居住地是否允许养宠、家人是否全部同意。这两点没确认好，后续容易出现退养。`
    : '【当前为演示模式】小院目前还没有在册宠物档案，请稍后再来。';
  for (const chunk of body.match(/[\s\S]{1,12}/g) || []) {
    writeSse(res, { type: 'delta', text: chunk });
    await new Promise(resolve => setTimeout(resolve, 45));
  }
  writeSse(res, { type: 'done', mock: true });
  res.end();
}

/** 真实调用：把 DeepSeek 的 SSE 流转换成我们自己的精简协议。 */
async function streamDeepSeek(res, pets, messages, apiKey) {
  const upstream = await fetch(`${DEEPSEEK_HOST}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
      messages: [{ role: 'system', content: buildSystemPrompt(pets) }, ...messages]
    })
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    // 只回传状态码与截断后的原因，避免把上游响应头等信息泄露给前端
    throw new Error(`AI 服务返回 ${upstream.status}${detail ? `：${text(detail, 120)}` : ''}`);
  }

  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) writeSse(res, { type: 'delta', text: delta });
      } catch {
        /* 上游偶发不完整行，跳过即可 */
      }
    }
  }
  writeSse(res, { type: 'done', mock: false });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求内容过大。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('请求格式不正确。'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 解析大模型 API Key。
 *
 * 优先级：环境变量 DEEPSEEK_API_KEY > 数据库 yard_settings.ai_config.apiKey
 *
 * 为什么不把 Key 写进 cloudbaserc.json：那个文件是要提交进仓库的，
 * 写进去等于把密钥公开。改成「管理员在后台填、存数据库」的套路，
 * 与企业微信机器人地址完全一致——不进代码、不用重新部署、随时可换。
 * 数据库里该 key 不在公开只读策略内，匿名访客读不到。
 *
 * 结果在实例内缓存 60 秒，避免每次对话都多一次数据库查询。
 */
let cachedApiKey = null;
let cachedApiKeyAt = 0;
const API_KEY_CACHE_MS = 60 * 1000;

async function resolveApiKey() {
  const fromEnv = text(process.env.DEEPSEEK_API_KEY, 200);
  if (fromEnv) return { key: fromEnv, source: 'env' };

  if (cachedApiKey !== null && Date.now() - cachedApiKeyAt < API_KEY_CACHE_MS) return cachedApiKey;
  try {
    const response = await executePgSql("SELECT jsonb_build_object('key', COALESCE((SELECT value->>'apiKey' FROM public.yard_settings WHERE key='ai_config' LIMIT 1), '')) AS result");
    const resolved = { key: text(sqlResult(response)?.key, 200), source: 'database' };
    cachedApiKey = resolved;
    cachedApiKeyAt = Date.now();
    return resolved;
  } catch (error) {
    console.error('读取 AI 配置失败：', error.message);
    return { key: '', source: 'none' };
  }
}

async function handleChat(req, res) {
  const base = { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' };
  res.writeHead(200, base);

  try {
    const body = await readBody(req);
    const messages = normalizeMessages(body?.messages);
    const ip = clientIp(req);

    const rate = await checkRateLimit(ip).catch(error => {
      // 限频自身故障不应阻断正常访客，但要记录
      console.error('限频检查失败：', error.message);
      return { allowed: true, degraded: true };
    });
    if (!rate.allowed) {
      writeSse(res, { type: 'error', message: '提问太频繁了，请十分钟后再试。' });
      res.end();
      return;
    }

    const pets = await loadPetCatalog();
    const resolved = await resolveApiKey();
    const apiKey = resolved.key;
    writeSse(res, { type: 'meta', mock: !apiKey, petCount: pets.length, keySource: resolved.source });

    if (!apiKey) {
      await streamMock(res, pets, messages);
      return;
    }
    await streamDeepSeek(res, pets, messages, apiKey);
  } catch (error) {
    console.error('AI 对话失败：', error.message);
    writeSse(res, { type: 'error', message: text(error.message, 200) || 'AI 服务暂时不可用。' });
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  const url = String(req.url || '/');

  // 预检交给平台自动附加 CORS 头，这里只需一个空 204，避免落到业务逻辑
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.includes('/chat') && req.method === 'POST') {
    await handleChat(req, res);
    return;
  }

  const resolved = await resolveApiKey();
  const apiKey = resolved.key;
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      ok: true,
      service: 'ai-stream',
      purpose: 'AI 领养匹配助手（SSE 流式）',
      // 只暴露「有没有配 Key」与来源，绝不回显 Key 本身
      model: apiKey ? DEEPSEEK_MODEL : 'mock',
      mockMode: !apiKey,
      keySource: resolved.source,
      // 诊断用布尔值（不含任何密钥内容），便于定位「凭据缺失」这类问题
      diagnostics: {
        hasSecretId: Boolean(process.env.TENCENTCLOUD_SECRETID),
        hasSecretKey: Boolean(process.env.TENCENTCLOUD_SECRETKEY),
        hasSessionToken: Boolean(process.env.TENCENTCLOUD_SESSIONTOKEN),
        hasEnvId: Boolean(process.env.TCB_ENV || process.env.SCF_NAMESPACE)
      },
      endpoints: { 'POST /chat': 'SSE 流式对话，body: {messages:[{role,content}]}' },
      time: new Date().toISOString()
    })
  );
});

server.listen(PORT, () => {
  console.log(`[ai-stream] 已启动，监听 ${PORT}`);
});
