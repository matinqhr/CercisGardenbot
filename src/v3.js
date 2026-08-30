import legacy from "./index.js";

const HOME_USERNAME = "Arghavanplaylistt";
const DEFAULT_HOME_CHAT_ID = "@Arghavanplaylistt";
const SMART_TTL_SECONDS = 60 * 60 * 24 * 30;
const TEXT_MODEL = "openrouter/free";
const AUDIO_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

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
  if (!o || o.type !== "channel" || !isHomeChat(env, o.chat) || !o.message_id) return null;
  return {
    channel: o.chat?.username ? String(o.chat.username).replace(/^@/, "") : String(o.chat?.id || ""),
    post_id: Number(o.message_id)
  };
}

function mediaFile(m) {
  if (m?.audio?.file_id) return { id: m.audio.file_id, kind: "audio", mime: m.audio.mime_type || "audio/mpeg" };
  if (m?.voice?.file_id) return { id: m.voice.file_id, kind: "voice", mime: m.voice.mime_type || "audio/ogg" };
  if (m?.document?.file_id && String(m.document.mime_type || "").startsWith("audio/")) {
    return { id: m.document.file_id, kind: "audio", mime: m.document.mime_type };
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
    return await env.DB.prepare("SELECT * FROM tracks WHERE channel=? AND post_id=?")
      .bind(origin.channel, origin.post_id).first();
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
    if (!row?.result) return null;
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
      .bind(origin.channel, origin.post_id, kind, sourceText, mediaFileId, JSON.stringify(result)).run();
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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function openRouterText(data) {
  const c = data?.choices?.[0]?.message?.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) return c.map(x => typeof x?.text === "string" ? x.text : "").join("\n").trim();
  return "";
}

async function openRouter(env, model, messages, maxTokens = 900) {
  if (!env.OPENROUTER_API_KEY) return null;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://t.me/Arghavanplaylistt",
        "X-Title": "Cercis Garden Bot"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
        stream: false
      })
    });
    if (!r.ok) {
      console.error("OpenRouter request failed", r.status, await r.text());
      return null;
    }
    return openRouterText(await r.json());
  } catch (err) {
    console.error("OpenRouter request error", err);
    return null;
  }
}

function cleanAi(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .trim();
}

async function analyzeText(env, text) {
  return openRouter(env, TEXT_MODEL, [
    {
      role: "system",
      content: `تو لایهٔ هوشمند ربات Cercis هستی. وظیفه‌ات شناسایی موضوع پست‌های متنی و ارائهٔ یک لقمهٔ اطلاعاتی کوتاه، دقیق و فارسی است.
اگر متن نقل‌قول است، انتساب نویسنده را فقط وقتی قطعی بدان که از دانش قابل اتکا برخوردار باشی؛ در غیر این صورت صریحاً بگو «انتساب قطعی نیست».
هیچ اطلاعات ساختگی، تاریخ، اثر یا جزئیات حدسی اضافه نکن.
پاسخ را فقط با این ساختار بده:
🏷️ عنوان پست
یک عنوان کوتاه و طبیعی.

📋 اطلاعات
یک تا سه جملهٔ مفید درباره شخص، اثر، موضوع یا مفهوم اصلی.

📝 توضیحات
یک پاراگراف کوتاه و قابل انتشار برای مخاطب Cercis.
اگر موضوع واقعاً قابل شناسایی نیست، فقط همین جمله را بده: «موضوع این پست با اطمینان قابل شناسایی نیست.»`
    },
    { role: "user", content: text }
  ], 750);
}

async function identifyMusic(env, media, caption = "") {
  const bytes = await getTelegramFile(env, media.id);
  if (!bytes) return null;
  const data = arrayBufferToBase64(bytes);
  const format = media.mime.includes("ogg") ? "ogg" : media.mime.includes("wav") ? "wav" : "mp3";
  return openRouter(env, AUDIO_MODEL, [
    {
      role: "system",
      content: `تو سامانهٔ شناسایی موسیقی Cercis هستی. صدای ورودی را تحلیل کن و اگر توانستی نام واقعی قطعه، خواننده/هنرمند و آلبوم را تشخیص بده.
عنوانی که در کانال دیده می‌شود ممکن است عنوان واقعی قطعه نباشد؛ اگر کپشن داده شده آن را فقط سرنخ بدان.
پاسخ را دقیقاً با این قالب بده:
🏷️ عنوان واقعی قطعه
🎹 هنرمند
🗂 آلبوم / مجموعه
📋 اطلاعات
یک یا دو جمله درباره قطعه یا هنرمند.

📝 توضیحات
یک پاراگراف کوتاه درباره اثر.
اگر تشخیص قطعی نیست، به‌جای حدس واضح بنویس: «شناسایی قطعه با اطمینان کافی ممکن نیست.»`
    },
    {
      role: "user",
      content: [
        { type: "text", text: `این فایل صوتی را شناسایی کن. کپشن احتمالی کانال: ${caption || "(ندارد)"}` },
        { type: "input_audio", input_audio: { data, format } }
      ]
    }
  ], 1000);
}

async function smartText(env, m, origin) {
  const source = String(m.text || m.caption || "").trim();
  if (!source) return send(env, m.chat.id, "🌱 این پست در آرشیو سرسیس ثبت نشده و متن قابل تحلیل هم ندارد.", { reply_to_message_id: m.message_id });
  const cached = await getCached(env, origin, "text");
  if (cached?.answer) return send(env, m.chat.id, `🌱 <b>لقمهٔ اطلاعاتی سرسیس</b>\n\n${cached.answer}`, { reply_to_message_id: m.message_id });
  if (!env.OPENROUTER_API_KEY) return send(env, m.chat.id, "🌱 قابلیت جستجوی هوشمند هنوز برای سرسیس تنظیم نشده است.", { reply_to_message_id: m.message_id });
  const answer = await analyzeText(env, source);
  if (!answer) return send(env, m.chat.id, "🌱 سرسیس فعلاً نتوانست اطلاعات قابل اتکایی برای این پست پیدا کند.", { reply_to_message_id: m.message_id });
  const cleaned = cleanAi(answer);
  await putCached(env, origin, "text", { answer: cleaned }, source);
  return send(env, m.chat.id, `🌱 <b>لقمهٔ اطلاعاتی سرسیس</b>\n\n${cleaned}`, { reply_to_message_id: m.message_id });
}

async function smartMusic(env, m, origin, media) {
  const cached = await getCached(env, origin, "music");
  if (cached?.text) return send(env, m.chat.id, `🎵 <b>موسیقی شناسایی‌شده</b>\n\n${cached.text}`, { reply_to_message_id: m.message_id });
  if (!env.OPENROUTER_API_KEY) return send(env, m.chat.id, "🎵 برای شناسایی موسیقی، کلید هوش مصنوعی سرسیس تنظیم نشده است.", { reply_to_message_id: m.message_id });
  const answer = await identifyMusic(env, media, m.caption || "");
  if (!answer) return send(env, m.chat.id, "🎵 سرسیس نتوانست موسیقی این پست را با اطمینان کافی شناسایی کند.", { reply_to_message_id: m.message_id });
  const cleaned = cleanAi(answer);
  await putCached(env, origin, "music", { text: cleaned }, m.caption || null, media.id);
  return send(env, m.chat.id, `🎵 <b>موسیقی شناسایی‌شده</b>\n\n${cleaned}`, { reply_to_message_id: m.message_id });
}

async function handleSmartHomeForward(env, m, origin) {
  if (await getRegisteredTrack(env, origin)) return false;

  const media = mediaFile(m);
  if (media) {
    await smartMusic(env, m, origin, media);
    return true;
  }

  const source = String(m.text || m.caption || "").trim();
  if (source) {
    await smartText(env, m, origin);
    return true;
  }

  await send(env, m.chat.id, "🌱 این پست در آرشیو سرسیس ثبت نشده و محتوای قابل شناسایی ندارد.", { reply_to_message_id: m.message_id });
  return true;
}

export default {
  async fetch(req, env, ctx) {
    try {
      await ensureV3Schema(env);
      if (req.method !== "POST") return legacy.fetch(req, env, ctx);
      const update = await req.clone().json();
      const m = update?.message;
      const origin = m ? getHomeOrigin(env, m) : null;

      if (origin) {
        const registered = await getRegisteredTrack(env, origin);
        if (!registered) {
          const handled = await handleSmartHomeForward(env, m, origin);
          if (handled) return new Response("ok");
        }
      }

      return legacy.fetch(req, env, ctx);
    } catch (err) {
      console.error("Cercis V3 error", err);
      try { return legacy.fetch(req, env, ctx); } catch { return new Response("Internal Error", { status: 500 }); }
    }
  }
};
