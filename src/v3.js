import legacy from "./index.js";

const HOME_USERNAME = "Arghavanplaylistt";
const HOME_CHAT_ID = "@Arghavanplaylistt";
const TG = (env, method, body) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
const send = (env, chatId, text, extra = {}) => TG(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
const esc = (v = "") => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function isHomeForward(m) {
  const o = m?.forward_origin;
  if (!o || (o.type !== "channel" && o.type !== "channel_message")) return false;
  const username = String(o.chat?.username || "").replace(/^@/, "").toLowerCase();
  return username === HOME_USERNAME.toLowerCase() || String(o.chat?.id || "") === HOME_CHAT_ID;
}

function mediaFileId(m) {
  if (m?.audio?.file_id) return { id: m.audio.file_id, kind: "audio" };
  if (m?.voice?.file_id) return { id: m.voice.file_id, kind: "voice" };
  if (m?.video?.file_id) return { id: m.video.file_id, kind: "video" };
  if (m?.document?.file_id && String(m.document.mime_type || "").startsWith("audio/")) return { id: m.document.file_id, kind: "audio" };
  return null;
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
  return data?.status === "success" ? data.result || null : null;
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) for (const c of item?.content || []) if (typeof c?.text === "string") parts.push(c.text);
  return parts.join("\n").trim();
}

async function aiResearch(env, prompt) {
  if (!env.OPENAI_API_KEY) return null;
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: env.CERCIS_AI_MODEL || "gpt-5",
      tools: [{ type: "web_search" }],
      input: prompt,
      store: false
    })
  });
  if (!r.ok) return null;
  return extractResponseText(await r.json());
}

async function enrichMusic(env, result) {
  const artist = result?.artist || "";
  const title = result?.title || "";
  const album = result?.album || "";
  const release = result?.release_date || "";
  const base = `🏷️ <b>${esc(title)}</b>\n🎹 <b>${esc(artist)}</b>\n🗂 ${esc(album || "موسیقی")}${release ? `\n📅 ${esc(release)}` : ""}`;
  if (!env.OPENAI_API_KEY) return `${base}\n\n📝 <b>توضیحات</b>\nاین قطعه از روی صدای پست شناسایی شد.`;
  const text = await aiResearch(env, `برای قطعه موسیقی «${title}» از «${artist}» یک معرفی کوتاه فارسی و دقیق برای ربات Cercis بنویس. فقط این قالب را رعایت کن و هیچ مقدمه‌ای اضافه نکن:\n📋 اطلاعات\nیک یا دو جمله درباره قطعه، هنرمند یا زمینه اثر\n\n📝 توضیحات\nیک پاراگراف کوتاه درباره فضای اثر و نکته مهم آن. اگر اطلاعات قطعی نیست صریحاً بگو.\n\nاز ساختن اطلاعات بدون پشتوانه خودداری کن.`);
  return `${base}${text ? `\n\n${text}` : ""}`;
}

async function analyzeText(env, text) {
  if (!env.OPENAI_API_KEY) return null;
  return aiResearch(env, `این متن از یک پست عمومیِ کانال Home است. موضوع، شخص، اثر یا مفهوم اصلی را شناسایی کن و برای کاربر یک «لقمه اطلاعاتی» فارسی تولید کن. اگر نقل‌قول است، نویسنده را فقط وقتی نسبتاً مطمئن هستی ذکر کن و اگر انتساب مشکوک است بگو «انتساب قطعی نیست». پاسخ دقیقاً با این قالب باشد و هیچ مقدمه‌ای نداشته باشد:\n🏷️ عنوان پست\nیک عنوان کوتاه و طبیعی برای موضوع\n\n📋 اطلاعات\nیک تا سه جمله درباره شخص/موضوع/اثر و دلیل ارتباط آن با متن\n\n📝 توضیحات\nیک پاراگراف کوتاه و مفید برای مخاطب کانال.\n\nمتن پست:\n${text}`);
}

async function smartFallback(env, m) {
  const chatId = m.chat?.id;
  const media = mediaFileId(m);
  if (media) {
    const result = await recognizeMusic(env, media.id);
    if (result) {
      const text = await enrichMusic(env, result);
      return send(env, chatId, `🎵 <b>موسیقی شناسایی‌شده</b>\n\n${text}`);
    }
    if (!env.AUDD_API_TOKEN) return send(env, chatId, "🎵 برای شناسایی موسیقی، سرویس تشخیص موسیقی هنوز برای سرسیس تنظیم نشده است.");
    return send(env, chatId, "🎵 سرسیس نتوانست موسیقی این پست را با اطمینان شناسایی کند.");
  }
  const source = String(m.text || m.caption || "").trim();
  if (!source) return send(env, chatId, "🌱 این پست هنوز پرونده‌ای در آرشیو ندارد و محتوای قابل تحلیل هم از آن دریافت نشد.");
  const answer = await analyzeText(env, source);
  if (answer) return send(env, chatId, `🌱 <b>لقمهٔ اطلاعاتی سرسیس</b>\n\n${answer}`);
  if (!env.OPENAI_API_KEY) return send(env, chatId, "🌱 این پست در آرشیو سرسیس ثبت نشده است. قابلیت تحلیل هوشمند هنوز تنظیم نشده است.");
  return send(env, chatId, "🌱 سرسیس فعلاً نتوانست اطلاعات قابل اتکایی برای این پست پیدا کند.");
}

async function trackExists(env, origin) {
  const username = String(origin?.chat?.username || "").replace(/^@/, "");
  const channel = username || origin?.chat?.id;
  const postId = origin?.message_id;
  if (!channel || !postId || !env.DB) return false;
  const row = await env.DB.prepare("SELECT id FROM tracks WHERE channel=? AND post_id=?").bind(channel, Number(postId)).first();
  return !!row;
}

export default {
  async fetch(req, env, ctx) {
    if (req.method !== "POST") return legacy.fetch(req, env, ctx);
    let update;
    try { update = await req.clone().json(); } catch { return legacy.fetch(req, env, ctx); }
    if (!update.message || !isHomeForward(update.message)) return legacy.fetch(req, env, ctx);
    try {
      if (await trackExists(env, update.message.forward_origin)) return legacy.fetch(req, env, ctx);
      await smartFallback(env, update.message);
      return new Response("ok");
    } catch (err) {
      console.error("Cercis V3 smart layer error", err);
      return send(env, update.message.chat.id, "⚠️ سرسیس هنگام تحلیل این پست با خطا روبه‌رو شد. لطفاً دوباره امتحان کنید.").then(() => new Response("ok"));
    }
  }
};
