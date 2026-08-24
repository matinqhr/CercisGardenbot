const FORM_TEMPLATE = `🎵 نام موزیک
🎹 خواننده
📅 تاریخ انتشار
✏️ متن آهنگ
📝 توضیحات`;

const tg = async (env, method, body = {}) => {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
};

const esc = (v = "") => String(v)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const parseLink = (text = "") => {
  const m = text.trim().match(/^https?:\/\/t\.me\/(?:c\/)?([A-Za-z0-9_]+)\/([0-9]+)(?:\?.*)?$/);
  return m ? { channel: m[1], post_id: Number(m[2]) } : null;
};

async function ensureSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    post_id INTEGER NOT NULL,
    url TEXT NOT NULL UNIQUE,
    title TEXT,
    artist TEXT,
    release_date TEXT,
    lyrics TEXT,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    user_id INTEGER PRIMARY KEY,
    step TEXT NOT NULL,
    channel TEXT,
    post_id INTEGER,
    url TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function getTrack(env, channel, postId) {
  return (await env.DB.prepare("SELECT * FROM tracks WHERE channel=? AND post_id=?").bind(channel, postId).first()) || null;
}

function formatTrack(row) {
  const p = [];
  if (row.title) p.push(`🎵 <b>${esc(row.title)}</b>`);
  if (row.artist) p.push(`🎹 <b>${esc(row.artist)}</b>`);
  if (row.release_date) p.push(`📅 ${esc(row.release_date)}`);
  if (row.lyrics) p.push(`\n✏️ <b>متن آهنگ</b>\n${esc(row.lyrics)}`);
  if (row.description) p.push(`\n📝 <b>توضیحات</b>\n${esc(row.description)}`);
  p.push(`\n🔗 <a href="${esc(row.url)}">مشاهده پست اصلی</a>`);
  return p.join("\n");
}

function parseForm(text = "") {
  const keys = [
    ["🎵", "title", "نام موزیک"],
    ["🎹", "artist", "خواننده"],
    ["📅", "release_date", "تاریخ انتشار"],
    ["✏️", "lyrics", "متن آهنگ"],
    ["📝", "description", "توضیحات"],
  ];
  const fields = Object.fromEntries(keys.map(([, k]) => [k, []]));
  let current = null;
  for (const raw of text.replaceAll("\r\n", "\n").split("\n")) {
    const line = raw.trim();
    const found = keys.find(([emoji]) => line.startsWith(emoji));
    if (found) {
      current = found[1];
      let value = line.slice(found[0].length).trim();
      const label = found[2];
      if (value.startsWith(label)) value = value.slice(label.length).trim();
      value = value.replace(/^[:：]/, "").trim().replace(/^\*\*/, "").replace(/\*\*$/, "").trim();
      if (value) fields[current].push(value);
    } else if (current && line) {
      fields[current].push(line);
    }
  }
  const result = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.join("\n").trim()]));
  const missing = keys.filter(([, k]) => !result[k]).map(([, , label]) => label);
  return missing.length ? { missing } : { result };
}

const isAdmin = (env, userId) => Number(env.ADMIN_ID || 0) === Number(userId);

async function setSession(env, userId, data) {
  await env.DB.prepare(`INSERT INTO sessions(user_id,step,channel,post_id,url,updated_at)
    VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET step=excluded.step,channel=excluded.channel,post_id=excluded.post_id,url=excluded.url,updated_at=CURRENT_TIMESTAMP`)
    .bind(userId, data.step || "", data.channel || null, data.post_id || null, data.url || null).run();
}

async function getSession(env, userId) {
  return await env.DB.prepare("SELECT * FROM sessions WHERE user_id=?").bind(userId).first();
}

async function clearSession(env, userId) {
  await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(userId).run();
}

async function send(env, chatId, text, extra = {}) {
  return tg(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

async function adminPanel(env, chatId) {
  return send(env, chatId, "👑 <b>پنل مدیریت Cercis Garden</b>", {
    reply_markup: { inline_keyboard: [
      [{ text: "➕ افزودن پست", callback_data: "add" }],
      [{ text: "✏️ ویرایش اطلاعات", callback_data: "edit" }],
      [{ text: "🗑 حذف پست", callback_data: "delete" }],
      [{ text: "📊 آمار", callback_data: "stats" }],
    ] }
  });
}

async function handleAdminText(env, message, session) {
  const userId = message.from.id;
  const chatId = message.chat.id;
  if (session.step === "ADD_LINK") {
    const parsed = parseLink(message.text);
    if (!parsed) return send(env, chatId, "❌ لینک معتبر نیست. دوباره ارسال کنید.");
    await setSession(env, userId, { step: "ADD_FORM", ...parsed, url: message.text.trim() });
    return send(env, chatId, `📝 حالا همه اطلاعات را در <b>یک پیام واحد</b> و دقیقاً با این قالب ارسال کنید:\n\n<code>${esc(FORM_TEMPLATE)}</code>`);
  }
  if (session.step === "ADD_FORM") {
    const parsed = parseForm(message.text);
    if (parsed.missing) return send(env, chatId, `❌ قالب کامل نیست. این بخش‌ها پیدا نشد:\n${parsed.missing.map(x => `• ${x}`).join("\n")}\n\nدوباره همه اطلاعات را در یک پیام ارسال کنید.`);
    const d = parsed.result;
    await env.DB.prepare(`INSERT INTO tracks(channel,post_id,url,title,artist,release_date,lyrics,description)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title,artist=excluded.artist,release_date=excluded.release_date,lyrics=excluded.lyrics,description=excluded.description`)
      .bind(session.channel, session.post_id, session.url, d.title, d.artist, d.release_date, d.lyrics, d.description).run();
    await clearSession(env, userId);
    return send(env, chatId, "✅ اطلاعات پست با موفقیت ذخیره شد.");
  }
  if (session.step === "EDIT_LINK") {
    const parsed = parseLink(message.text);
    if (!parsed) return send(env, chatId, "❌ لینک معتبر نیست. دوباره ارسال کنید.");
    const row = await getTrack(env, parsed.channel, parsed.post_id);
    if (!row) return send(env, chatId, "❌ اطلاعاتی برای این پست پیدا نشد.");
    await setSession(env, userId, { step: "EDIT_FORM", channel: parsed.channel, post_id: parsed.post_id, url: row.url });
    return send(env, chatId, `📌 <b>اطلاعات فعلی:</b>\n\n${formatTrack(row)}\n\n✏️ نسخهٔ جدید را در <b>یک پیام واحد</b> با این قالب بفرستید:\n\n<code>${esc(FORM_TEMPLATE)}</code>`);
  }
  if (session.step === "EDIT_FORM") {
    const parsed = parseForm(message.text);
    if (parsed.missing) return send(env, chatId, `❌ قالب کامل نیست. این بخش‌ها پیدا نشد:\n${parsed.missing.map(x => `• ${x}`).join("\n")}`);
    const d = parsed.result;
    await env.DB.prepare(`UPDATE tracks SET title=?,artist=?,release_date=?,lyrics=?,description=? WHERE channel=? AND post_id=?`)
      .bind(d.title, d.artist, d.release_date, d.lyrics, d.description, session.channel, session.post_id).run();
    await clearSession(env, userId);
    return send(env, chatId, "✅ اطلاعات با موفقیت ویرایش شد.");
  }
  if (session.step === "DELETE_LINK") {
    const parsed = parseLink(message.text);
    if (!parsed) return send(env, chatId, "❌ لینک معتبر نیست. دوباره ارسال کنید.");
    const row = await getTrack(env, parsed.channel, parsed.post_id);
    if (!row) return send(env, chatId, "❌ اطلاعاتی برای این پست پیدا نشد.");
    await env.DB.prepare("DELETE FROM tracks WHERE channel=? AND post_id=?").bind(parsed.channel, parsed.post_id).run();
    await clearSession(env, userId);
    return send(env, chatId, "🗑 اطلاعات پست حذف شد.");
  }
}

async function handleCallback(env, q) {
  const chatId = q.message.chat.id;
  const userId = q.from.id;
  await tg(env, "answerCallbackQuery", { callback_query_id: q.id });
  if (!isAdmin(env, userId)) return;
  if (q.data === "add") {
    await setSession(env, userId, { step: "ADD_LINK" });
    return send(env, chatId, "🔗 اول لینک پست را ارسال کنید.");
  }
  if (q.data === "edit") {
    await setSession(env, userId, { step: "EDIT_LINK" });
    return send(env, chatId, "🔗 لینک پستی که می‌خواهید ویرایش کنید را ارسال کنید.");
  }
  if (q.data === "delete") {
    await setSession(env, userId, { step: "DELETE_LINK" });
    return send(env, chatId, "🔗 لینک پستی که می‌خواهید حذف کنید را ارسال کنید.");
  }
  if (q.data === "stats") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM tracks").first();
    return send(env, chatId, `📊 تعداد موسیقی‌های ثبت‌شده: <b>${row?.count || 0}</b>`);
  }
  if (q.data === "help") return send(env, chatId, "🔗 لینک پست موسیقی را همین‌جا ارسال کنید تا اطلاعات ثبت‌شده آن را پیدا کنم.\n\nهمچنین می‌توانید خود پست یا فایل موسیقی را مستقیماً از کانال برای ربات Forward کنید.");
  if (q.data === "about") return send(env, chatId, "🌳 <b>Cercis Garden</b>\nکتابخانه‌ای از اطلاعات موسیقی‌های ثبت‌شده توسط مدیریت.");
}

async function handleMessage(env, message) {
  if (!message) return;
  const userId = message.from?.id;
  const chatId = message.chat.id;
  const session = userId ? await getSession(env, userId) : null;
  if (session && isAdmin(env, userId) && message.text) return handleAdminText(env, message, session);

  if (message.text === "/start") {
    return send(env, chatId, "🌳 <b>Cercis Garden</b>\n\nبرای دریافت اطلاعات یک موسیقی، لینک پست آن را ارسال کنید.", {
      reply_markup: { inline_keyboard: [[{ text: "🎵 راهنما", callback_data: "help" }], [{ text: "ℹ️ درباره ربات", callback_data: "about" }]] }
    });
  }
  if (message.text === "/admin") return isAdmin(env, userId) ? adminPanel(env, chatId) : send(env, chatId, "⛔ دسترسی ندارید.");

  const origin = message.forward_origin;
  if (origin?.type === "channel") {
    const channel = origin.chat?.username;
    const postId = origin.message_id;
    const row = channel ? await getTrack(env, channel, postId) : null;
    return row ? send(env, chatId, formatTrack(row)) : send(env, chatId, "🌳 این موسیقی هنوز در باغ Cercis ثبت نشده است.\nبه‌زودی شاید اطلاعاتش به آرشیو اضافه شود. 🎵");
  }

  if (message.text) {
    const parsed = parseLink(message.text);
    if (!parsed) return send(env, chatId, "❌ لطفاً لینک معتبر یک پست تلگرام را ارسال کنید.");
    const row = await getTrack(env, parsed.channel, parsed.post_id);
    return row ? send(env, chatId, formatTrack(row)) : send(env, chatId, "🌳 این موسیقی هنوز در باغ Cercis ثبت نشده است.\nبه‌زودی شاید اطلاعاتش به آرشیو اضافه شود. 🎵");
  }
}

async function setWebhook(env, url) {
  const secret = env.WEBHOOK_SECRET ? { secret_token: env.WEBHOOK_SECRET } : {};
  return tg(env, "setWebhook", { url, allowed_updates: ["message", "callback_query"], drop_pending_updates: false, ...secret });
}

export default {
  async fetch(request, env) {
    try {
      if (!env.BOT_TOKEN || !env.ADMIN_ID || !env.DB) return new Response("Missing BOT_TOKEN, ADMIN_ID or DB binding", { status: 500 });
      await ensureSchema(env);
      const url = new URL(request.url);
      if (request.method === "GET") {
        if (url.pathname === "/") {
          const result = await setWebhook(env, url.origin + "/telegram");
          return new Response(result.ok ? "Cercis Garden Bot is running." : JSON.stringify(result), { status: result.ok ? 200 : 500 });
        }
        return new Response("Not found", { status: 404 });
      }
      if (request.method !== "POST" || url.pathname !== "/telegram") return new Response("Not found", { status: 404 });
      if (env.WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
      const update = await request.json();
      if (update.callback_query) await handleCallback(env, update.callback_query);
      else if (update.message) await handleMessage(env, update.message);
      return new Response("OK");
    } catch (e) {
      console.error(e);
      return new Response("Internal error", { status: 500 });
    }
  }
};
