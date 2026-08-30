import legacy from "./index.js";

const HOME_USERNAME = "Arghavanplaylistt";
const DEFAULT_HOME_CHAT_ID = "@Arghavanplaylistt";
const SMART_TTL_SECONDS = 60 * 60 * 24 * 30;

const TG = (env, method, body) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
}).then(r => r.json());

const send = (env, chatId, text, extra = {}) => TG(env, "sendMessage", {
  chat_id: chatId,
  text,
  parse_mode: "HTML",
  ...extra
});

const esc = (v = "") => String(v)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function configuredHomeIds(env) {
  return new Set([
    DEFAULT_HOME_CHAT_ID,
    env.HOME_CHANNEL_ID,
    env.HOME_CHANNEL_USERNAME,
    `@${HOME_USERNAME}`,
    HOME_USERNAME
  ].filter(Boolean).map(x => String(x).replace(/^@/, "").toLowerCase()));
}

function isHomeChat(env, chat) {
  if (!chat) return false;
  const username = String(chat.username || "").replace(/^@/, "").toLowerCase();
  const id = String(chat.id || "").toLowerCase();
  const ids = configuredHomeIds(env);
  return ids.has(username) || ids.has(id) || ids.has(`@${username}`);
}

function getHomeOrigin(env, m) {
  const o = m?.forward_origin;
  if (!o || o.type !== "channel" || !isHomeChat(env, o.chat)) return null;
  if (!o.message_id) return null;
  return {
    channel: o.chat?.username ? String(o.chat.username).replace(/^@/, "") : String(o.chat?.id || ""),
    post_id: Number(o.message_id)
  };
}

function mediaFile(m) {
  if (m?.audio?.file_id) return { id: m.audio.file_id, kind: "audio" };
  if (m?.voice?.file_id) return { id: m.voice.file_id, kind: "voice" };
  if (m?.document?.file_id && String(m.document.mime_type || "").startsWith("audio/")) {
    return { id: m.document.file_id, kind: "audio" };
  }
  return null;
}

async function ensureV3Schema(env) {
  if (!env.DB) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS v3_smart_cache(
    channel TEXT NOT NULL,
    post_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    source_text TEXT,
    media_file_id TEXT,
    result TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY(channel, post_id, kind)
  )`).run();
}

async function getRegisteredTrack(env, origin) {
  if (!env.DB || !origin?.channel || !origin?.post_id) return null;
  try {
    return await env.DB.prepare(
      "SELECT * FROM tracks WHERE channel=? AND post_id=?"
    ).bind(origin.channel, origin.post_id).first();
  } catch (err) {
    console.error("V3 track lookup failed", err);
    return null;
  }
}

async function getCached(env, origin, kind) {
  if (!env.DB || !origin) return null;
  try {
    const row = await env.DB.prepare(
      "SELECT result,created_at FROM v3_smart_cache WHERE channel=? AND post_id=? AND kind=?"
    ).bind(origin.channel, origin.post_id, kind).first();
    if (!row || !row.result) return null;
    if (Number(row.created_at || 0) + SMART_TTL_SECONDS < Math.floor(Date.now() / 1000)) return null;
    return JSON.parse(row.result);
  } catch {
    return null;
  }
}

async function putCached(env, origin, kind, result, sourceText = null, mediaFileId = null) {
  if (!env.DB || !origin) return;
  try {
    await env.DB.prepare(`INSERT INTO v3_smart_cache(channel,post_id,kind,source_text,media_file_id,result,created_at)
      VALUES(?,?,?,?,?,?,unixepoch())
      ON CONFLICT(channel,post_id,kind) DO UPDATE SET
      source_text=excluded.source_text,
      media_file_id=excluded.media_file_id,
      result=excluded.result,
      created_at=excluded.created_at`)
      .bind(origin.channel, origin.post_id, kind, sourceText, mediaFileId, JSON.stringify(result))
      .run();
  } catch (err) {
    console.error("V3 cache write failed", err);
  }
}

async function getTelegramFile(env, fileId) {
  const meta = await TG(env, "getFile", { file_id: fileId });
  if (!meta.ok || !meta.result?.file_path) return null;
  const r = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${meta.result.file_path}`);
  if (!r.ok) return null;
  return await r.arrayBuffer();
}

async function recognizeMusic(env, fileId) {
  if (!env.AUDD_API_TOKEN) return null;
  const bytes = await getTelegramFile(env, fileId);
  if (!bytes) return null;

  const form = new FormData();
  form.append("api_token", env.AUDD_API_TOKEN);
  form.append("return", "apple_music,spotify");
  form.append("file", new Blob([bytes], { type: "application/octet-stream" }), "cercis-audio");

  const r = await fetch("https://api.audd.io/", { method: "POST", body: form });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.status === "success" && data.result ? data.result : null;
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (typeof c?.text === "string") parts.push(c.text);
    }
  }
  return parts.join("\n").trim();
}

async function aiResearch(env, prompt) {
  if (!env.OPENAI_API_KEY) return null;
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.CERCIS_AI_MODEL || "gpt-5.6-luna",
      tools: [{ type: "web_search" }],
      input: prompt,
      store: false
    })
  });
  if (!r.ok) {
    console.error("Cercis AI request failed", r.status, await r.text());
    return null;
  }
  return extractResponseText(await r.json());
}

function normalizeAiText(text) {
  return String(text || "")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .trim();
}

async function enrichMusic(env, result) {
  const title = result?.title || "";
  const artist = result?.artist || "";
  const album = result?.album || "موسیقی";
  const release = result?.release_date || "";
  const base = [
    `🏷️ <b>${esc(title)}</b>`,
    `🎹 <b>${esc(artist)}</b>`,
    `🗂 ${esc(album)}`,
    release ? `📅 ${esc(release)}` : ""
  ].filter(Boolean).join("\n");

  if (!env.OPENAI_API_KEY) {
    return `${base}\n\n📝 <b>توضیحات</b>\nاین قطعه از روی صدای پست شناسایی شد.`;
  }

  const text = await aiResearch(env, `
قطعه موسیقی زیر با یک سرویس تشخیص صدا شناسایی شده است:
عنوان: ${title}
هنرمند: ${artist}
آلبوم: ${album}
تاریخ انتشار: ${release}

برای Cercis یک «لقمه اطلاعاتی» فارسی بنویس.
قالب دقیق:
📋 اطلاعات
یک یا دو جمله دقیق درباره اثر، هنرمند یا زمینه انتشار.

📝 توضیحات
یک پاراگراف کوتاه درباره فضای اثر و نکته مهم آن.

قوانین:
- اطلاعات را با جستجوی وب بررسی کن.
- اگر موردی قطعی نیست، آن را قطعی جلوه نده.
- نام اثر را همان عنوان رسمی نگه دار؛ عنوانی که کانال برای هارمونی استفاده می‌کند ممکن است عنوان واقعی نباشد.
- متن کوتاه، تمیز و مناسب پیام تلگرام باشد.
`);

  return `${base}${text ? `\n\n${normalizeAiText(text)}` : ""}`;
}

async function analyzeText(env, text) {
  if (!env.OPENAI_API_KEY) return null;
  return aiResearch(env, `
این متن از یک پست کانال Home است:

${text}

موضوع، شخص، اثر یا مفهوم اصلی را شناسایی کن و یک «لقمه اطلاعاتی» فارسی برای کاربر بساز.
اگر متن نقل‌قول است، نویسنده را فقط با بررسی وب و وقتی انتساب قابل اتکاست ذکر کن؛ اگر انتساب مشکوک است صریحاً بگو «انتساب قطعی نیست».

قالب دقیق:
🏷️ عنوان پست
یک عنوان کوتاه و طبیعی بر اساس موضوع اصلی؛ اگر نام مشهور یا نام واقعی اثر وجود دارد از آن استفاده کن.

📋 اطلاعات
یک تا سه جمله درباره شخص، موضوع یا اثر و ارتباط آن با متن.

📝 توضیحات
یک پاراگراف کوتاه، مفید و قابل انتشار برای مخاطب Cercis.

قوانین:
- جستجوی وب برای راستی‌آزمایی انجام بده.
- اطلاعات ساختگی یا جزئیات حدسی اضافه نکن.
- اگر متن برای شناسایی موضوع کافی نیست، فقط بنویس «موضوع این پست با اطمینان قابل شناسایی نیست.»
- پاسخ کوتاه و مناسب تلگرام باشد.
`);
}

async function sendSmartText(env, chatId, answer, replyTo) {
  return send(env, chatId, `🌱 <b>لقمهٔ اطلاعاتی سرسیس</b>\n\n${normalizeAiText(answer)}`, {
    reply_to_message_id: replyTo
  });
}

async function handleSmartText(env, m, origin) {
  const source = String(m.text || m.caption || "").trim();
  if (!source) {
    return send(env, m.chat.id, "🌱 این پست در آرشیو سرسیس ثبت نشده و متن قابل تحلیل هم ندارد.", {
      reply_to_message_id: m.message_id
    });
  }

  const cached = await getCached(env, origin, "text");
  if (cached?.answer) return sendSmartText(env, m.chat.id, cached.answer, m.message_id);

  if (!env.OPENAI_API_KEY) {
    return send(env, m.chat.id,
      "🌱 این پست در آرشیو سرسیس ثبت نشده است. قابلیت جستجوی هوشمند هنوز برای سرسیس تنظیم نشده است.",
      { reply_to_message_id: m.message_id }
    );
  }

  const answer = await analyzeText(env, source);
  if (!answer) {
    return send(env, m.chat.id, "🌱 سرسیس فعلاً نتوانست اطلاعات قابل اتکایی برای این پست پیدا کند.", {
      reply_to_message_id: m.message_id
    });
  }

  await putCached(env, origin, "text", { answer }, source);
  return sendSmartText(env, m.chat.id, answer, m.message_id);
}

async function handleSmartMusic(env, m, origin, media) {
  const cached = await getCached(env, origin, "music");
  if (cached?.text) {
    return send(env, m.chat.id, `🎵 <b>موسیقی شناسایی‌شده</b>\n\n${cached.text}`, {
      reply_to_message_id: m.message_id
    });
  }

  if (!env.AUDD_API_TOKEN) {
    return send(env, m.chat.id,
      "🎵 برای شناسایی موسیقی، سرویس تشخیص موسیقی هنوز برای سرسیس تنظیم نشده است.",
      { reply_to_message_id: m.message_id }
    );
  }

  const result = await recognizeMusic(env, media.id);
  if (!result) {
    return send(env, m.chat.id, "🎵 سرسیس نتوانست موسیقی این پست را با اطمینان شناسایی کند.", {
      reply_to_message_id: m.message_id
    });
  }

  const text = await enrichMusic(env, result);
  await putCached(env, origin, "music", { text, result }, null, media.id);
  return send(env, m.chat.id, `🎵 <b>موسیقی شناسایی‌شده</b>\n\n${text}`, {
    reply_to_message_id: m.message_id
  });
}

async function handleSmartHomeForward(env, m, origin) {
  const registered = await getRegisteredTrack(env, origin);
  if (registered) {
    // V3 never replaces the established archive. Registered posts always go through V1/V2.
    return legacy.fetch(new Request("https://cercis.internal/", {
      method: "POST",
      body: JSON.stringify({ message: m }),
      headers: { "content-type": "application/json" }
    }), env, {});
  }

  const media = mediaFile(m);
  if (media) return handleSmartMusic(env, m, origin, media);
  return handleSmartText(env, m, origin);
}

export default {
  async fetch(req, env, ctx) {
    // Keep all existing V1/V2 commands and admin flows untouched.
    if (req.method !== "POST") return legacy.fetch(req, env, ctx);

    let update;
    try {
      update = await req.clone().json();
    } catch {
      return legacy.fetch(req, env, ctx);
    }

    // V3 only acts on forwarded channel posts. Everything else belongs to the legacy bot.
    const message = update?.message;
    const origin = getHomeOrigin(env, message);
    if (!message || !message.forward_origin) return legacy.fetch(req, env, ctx);

    // A forward from any channel other than Home must be ignored by V3.
    // Do not pass it to legacy, because that would allow an unrelated registered post to answer.
    if (!origin) return new Response("ok");

    try {
      await ensureV3Schema(env);
      const result = await handleSmartHomeForward(env, message, origin);
      if (result instanceof Response) return result;
      return new Response("ok");
    } catch (err) {
      console.error("Cercis V3 smart layer error", err);
      await send(env, message.chat.id,
        "⚠️ سرسیس هنگام تحلیل این پست با خطا روبه‌رو شد. لطفاً دوباره امتحان کنید.",
        { reply_to_message_id: message.message_id }
      );
      return new Response("ok");
    }
  }
};
