const FORM_TEMPLATE = `🎵 **نام موزیک**
🎹 **خواننده**
📅 **تاریخ انتشار**
✏️ **متن آهنگ**
📝 **توضیحات**`;

const STATES = {
  ADD_LINK: "ADD_LINK",
  ADD_FORM: "ADD_FORM",
  EDIT_LINK: "EDIT_LINK",
  EDIT_FORM: "EDIT_FORM",
  DELETE_LINK: "DELETE_LINK",
};

function htmlEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeChannel(channel) {
  const value = String(channel || "").trim();
  if (/^\d+$/.test(value)) return `-100${value}`;
  return value.replace(/^@/, "");
}

function parsePostLink(text) {
  const m = String(text || "").trim().match(/^https?:\/\/t\.me\/(?:c\/)?([A-Za-z0-9_]+)\/(\d+)(?:\?.*)?$/);
  if (!m) return null;
  return { channel: normalizeChannel(m[1]), postId: Number(m[2]), url: String(text).trim() };
}

function cleanField(value) {
  value = String(value || "").trim();
  if (value.length >= 4 && value.startsWith("**") && value.endsWith("**")) {
    value = value.slice(2, -2).trim();
  }
  return value;
}

function parseInfoForm(text) {
  const lines = String(text || "").replaceAll("\r\n", "\n").split("\n");
  const fields = { title: [], artist: [], release_date: [], lyrics: [], description: [] };
  const emojiToKey = { "🎵": "title", "🎹": "artist", "📅": "release_date", "✏️": "lyrics", "📝": "description" };
  const labels = "نام\\s+موزیک|خواننده|تاریخ\\s+انتشار|متن\\s+آهنگ|توضیحات";
  const re = new RegExp(`^\\s*(🎵|🎹|📅|✏️|📝)\\s*(?:(?:\\*\\*)?\\s*(?:${labels})\\s*(?:\\*\\*)?\\s*)?(?::|：)?\\s*(.*)\\s*$`);
  let current = null;

  for (const raw of lines) {
    const match = raw.match(re);
    if (match) {
      current = emojiToKey[match[1]];
      const value = cleanField(match[2]);
      if (value) fields[current].push(value);
    } else if (current) {
      const continuation = raw.trim();
      if (continuation) fields[current].push(continuation);
    }
  }

  const result = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.join("\n").trim()]));
  const required = [
    ["title", "🎵 نام موزیک"],
    ["artist", "🎹 خواننده"],
    ["release_date", "📅 تاریخ انتشار"],
    ["lyrics", "✏️ متن آهنگ"],
    ["description", "📝 توضیحات"],
  ];
  const missing = required.filter(([key]) => !result[key]).map(([, label]) => label);
  return missing.length ? { result: null, missing } : { result, missing: [] };
}

function formatTrack(row) {
  const parts = [];
  if (row.title) parts.push(`🎵 <b>${htmlEscape(row.title)}</b>`);
  if (row.artist) parts.push(`🎹 <b>${htmlEscape(row.artist)}</b>`);
  const releaseDate = row.release_date || row.year;
  if (releaseDate) parts.push(`📅 ${htmlEscape(releaseDate)}`);
  if (row.lyrics) parts.push(`\n✏️ <b>متن آهنگ</b>\n${htmlEscape(row.lyrics)}`);
  if (row.description) parts.push(`\n📝 <b>توضیحات</b>\n${htmlEscape(row.description)}`);
  if (row.url) parts.push(`\n🔗 <a href="${htmlEscape(row.url)}">مشاهده پست اصلی</a>`);
  return parts.join("\n");
}

function isAdmin(update, env) {
  return Boolean(env.ADMIN_ID && String(update?.message?.from?.id || update?.callback_query?.from?.id) === String(env.ADMIN_ID));
}

async function telegram(env, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${JSON.stringify(data)}`);
  return data.result;
}

async function sendMessage(env, chatId, text, extra = {}) {
  return telegram(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

async function answerCallback(env, callbackId) {
  return telegram(env, "answerCallbackQuery", { callback_query_id: callbackId });
}

async function getSession(env, userId) {
  const row = await env.DB.prepare("SELECT state, payload FROM sessions WHERE user_id=?").bind(String(userId)).first();
  return row ? { state: row.state, payload: JSON.parse(row.payload || "{}") } : null;
}

async function setSession(env, userId, state, payload = {}) {
  await env.DB.prepare(`INSERT INTO sessions(user_id,state,payload,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,payload=excluded.payload,updated_at=CURRENT_TIMESTAMP`)
    .bind(String(userId), state, JSON.stringify(payload)).run();
}

async function clearSession(env, userId) {
  await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(String(userId)).run();
}

async function getTrack(env, channel, postId) {
  return env.DB.prepare("SELECT * FROM tracks WHERE channel=? AND post_id=? LIMIT 1")
    .bind(normalizeChannel(channel), Number(postId)).first();
}

async function saveTrack(env, data, result) {
  await env.DB.prepare(`INSERT INTO tracks(channel,post_id,url,title,artist,release_date,lyrics,description)
    VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(url) DO UPDATE SET
      title=excluded.title,artist=excluded.artist,release_date=excluded.release_date,
      lyrics=excluded.lyrics,description=excluded.description`)
    .bind(data.channel, data.postId, data.url, result.title, result.artist, result.release_date, result.lyrics, result.description)
    .run();
}

async function updateTrack(env, data, result) {
  const res = await env.DB.prepare(`UPDATE tracks SET title=?,artist=?,release_date=?,lyrics=?,description=?
    WHERE channel=? AND post_id=?`)
    .bind(result.title, result.artist, result.release_date, result.lyrics, result.description, data.channel, data.postId).run();
  return res.meta?.changes || 0;
}

async function deleteTrack(env, data) {
  const res = await env.DB.prepare("DELETE FROM tracks WHERE channel=? AND post_id=?")
    .bind(data.channel, data.postId).run();
  return res.meta?.changes || 0;
}

function adminKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "➕ افزودن پست", callback_data: "add" }],
      [{ text: "✏️ ویرایش اطلاعات", callback_data: "edit" }],
      [{ text: "🗑 حذف پست", callback_data: "delete" }],
      [{ text: "📊 آمار", callback_data: "stats" }],
    ],
  };
}

async function start(update, env) {
  await sendMessage(env, update.message.chat.id,
    "🌳 <b>Cercis Garden</b>\n\nبرای دریافت اطلاعات یک موسیقی، لینک پست آن را ارسال کنید.",
    { reply_markup: { inline_keyboard: [[{ text: "🎵 راهنما", callback_data: "help" }], [{ text: "ℹ️ درباره ربات", callback_data: "about" }]] } });
}

async function admin(update, env) {
  if (!isAdmin(update, env)) {
    await sendMessage(env, update.message.chat.id, "⛔ دسترسی ندارید.");
    return;
  }
  await sendMessage(env, update.message.chat.id, "👑 <b>پنل مدیریت Cercis Garden</b>", { reply_markup: adminKeyboard() });
}

async function handleCallback(update, env) {
  const q = update.callback_query;
  await answerCallback(env, q.id);
  const chatId = q.message.chat.id;

  if (q.data === "help") {
    await telegram(env, "editMessageText", { chat_id: chatId, message_id: q.message.message_id,
      text: "🔗 لینک پست موسیقی را همین‌جا ارسال کنید تا اطلاعات ثبت‌شده آن را پیدا کنم.\n\nهمچنین می‌توانید خود پست یا فایل موسیقی را مستقیماً از کانال برای ربات Forward کنید.", parse_mode: "HTML" });
    return;
  }
  if (q.data === "about") {
    await telegram(env, "editMessageText", { chat_id: chatId, message_id: q.message.message_id,
      text: "🌳 <b>Cercis Garden</b>\nکتابخانه‌ای از اطلاعات موسیقی‌های ثبت‌شده توسط مدیریت.", parse_mode: "HTML" });
    return;
  }
  if (!isAdmin(update, env)) return;

  if (q.data === "stats") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM tracks").first();
    await sendMessage(env, chatId, `📊 تعداد موسیقی‌های ثبت‌شده: <b>${row?.count || 0}</b>`);
    return;
  }
  if (q.data === "add") {
    await setSession(env, q.from.id, STATES.ADD_LINK);
    await sendMessage(env, chatId, `🔗 اول لینک پست را ارسال کنید.\n\nبعد، اطلاعات موسیقی را <b>در یک پیام واحد</b> دقیقاً با این قالب بفرستید:\n\n<code>${htmlEscape(FORM_TEMPLATE)}</code>`);
  } else if (q.data === "edit") {
    await setSession(env, q.from.id, STATES.EDIT_LINK);
    await sendMessage(env, chatId, "🔗 لینک پستی که می‌خواهید ویرایش کنید را ارسال کنید.");
  } else if (q.data === "delete") {
    await setSession(env, q.from.id, STATES.DELETE_LINK);
    await sendMessage(env, chatId, "🔗 لینک پستی که می‌خواهید حذف کنید را ارسال کنید.");
  }
}

async function handleForward(update, env) {
  const message = update.message;
  let origin = message.forward_origin;
  let channel = null;
  let postId = null;

  if (origin?.type === "channel") {
    channel = origin.chat?.username || origin.chat?.id;
    postId = origin.message_id;
  } else if (message.forward_from_chat?.type === "channel") {
    channel = message.forward_from_chat.username || message.forward_from_chat.id;
    postId = message.forward_from_message_id;
  }

  if (!channel || !postId) {
    await sendMessage(env, message.chat.id, "❌ نتوانستم پست اصلی را شناسایی کنم.\n\nلطفاً موزیک را مستقیماً از کانال با گزینهٔ Forward برای ربات بفرستید.");
    return;
  }

  const row = await getTrack(env, channel, postId);
  if (!row) {
    await sendMessage(env, message.chat.id, "🌳 این موسیقی هنوز در باغ Cercis ثبت نشده است.\nبه‌زودی شاید اطلاعاتش به آرشیو اضافه شود. 🎵");
    return;
  }
  await sendMessage(env, message.chat.id, formatTrack(row), { disable_web_page_preview: true });
}

async function handleText(update, env) {
  const message = update.message;
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text || "";

  const session = userId ? await getSession(env, userId) : null;
  if (session && isAdmin(update, env)) {
    if (text === "/cancel") {
      await clearSession(env, userId);
      await sendMessage(env, chatId, "❌ عملیات لغو شد.");
      return;
    }

    if (session.state === STATES.ADD_LINK) {
      const parsed = parsePostLink(text);
      if (!parsed) {
        await sendMessage(env, chatId, "❌ لینک معتبر نیست. دوباره ارسال کنید.");
        return;
      }
      await setSession(env, userId, STATES.ADD_FORM, parsed);
      await sendMessage(env, chatId, `📝 حالا همه اطلاعات را در <b>یک پیام واحد</b> و دقیقاً با این قالب ارسال کنید:\n\n<code>${htmlEscape(FORM_TEMPLATE)}</code>`);
      return;
    }

    if (session.state === STATES.ADD_FORM) {
      const parsed = parseInfoForm(text);
      if (!parsed.result) {
        await sendMessage(env, chatId, `❌ قالب کامل نیست. این بخش‌ها پیدا نشد:\n${parsed.missing.map(x => `• ${htmlEscape(x)}`).join("\n")}\n\nدوباره همه اطلاعات را در یک پیام و با همان قالب ارسال کنید.`);
        return;
      }
      await saveTrack(env, session.payload, parsed.result);
      await clearSession(env, userId);
      await sendMessage(env, chatId, "✅ اطلاعات پست با موفقیت ذخیره شد.");
      return;
    }

    if (session.state === STATES.EDIT_LINK) {
      const parsed = parsePostLink(text);
      if (!parsed) {
        await sendMessage(env, chatId, "❌ لینک معتبر نیست. دوباره ارسال کنید.");
        return;
      }
      const row = await getTrack(env, parsed.channel, parsed.postId);
      if (!row) {
        await sendMessage(env, chatId, "❌ اطلاعاتی برای این پست پیدا نشد.");
        return;
      }
      await setSession(env, userId, STATES.EDIT_FORM, parsed);
      await sendMessage(env, chatId, `📌 <b>اطلاعات فعلی:</b>\n\n${formatTrack(row)}\n\n✏️ حالا نسخهٔ جدید اطلاعات را <b>در یک پیام واحد</b> و با این قالب ارسال کنید:\n\n<code>${htmlEscape(FORM_TEMPLATE)}</code>`, { disable_web_page_preview: true });
      return;
    }

    if (session.state === STATES.EDIT_FORM) {
      const parsed = parseInfoForm(text);
      if (!parsed.result) {
        await sendMessage(env, chatId, `❌ قالب کامل نیست. این بخش‌ها پیدا نشد:\n${parsed.missing.map(x => `• ${htmlEscape(x)}`).join("\n")}\n\nنسخهٔ جدید را دوباره در یک پیام ارسال کنید.`);
        return;
      }
      const changes = await updateTrack(env, session.payload, parsed.result);
      await clearSession(env, userId);
      await sendMessage(env, chatId, changes ? "✅ اطلاعات موسیقی با موفقیت ویرایش شد." : "❌ ویرایش انجام نشد؛ اطلاعات پست پیدا نشد.");
      return;
    }

    if (session.state === STATES.DELETE_LINK) {
      const parsed = parsePostLink(text);
      if (!parsed) {
        await sendMessage(env, chatId, "❌ لینک معتبر نیست.");
        return;
      }
      const changes = await deleteTrack(env, parsed);
      await clearSession(env, userId);
      await sendMessage(env, chatId, changes ? "✅ اطلاعات حذف شد." : "❌ اطلاعاتی برای این پست پیدا نشد.");
      return;
    }
  }

  const parsed = parsePostLink(text);
  if (!parsed) {
    await sendMessage(env, chatId, "❌ لطفاً لینک معتبر یک پست تلگرام را ارسال کنید.");
    return;
  }
  const row = await getTrack(env, parsed.channel, parsed.postId);
  if (!row) {
    await sendMessage(env, chatId, "🌳 این موسیقی هنوز در باغ Cercis ثبت نشده است.\nبه‌زودی شاید اطلاعاتش به آرشیو اضافه شود. 🎵");
    return;
  }
  await sendMessage(env, chatId, formatTrack(row), { disable_web_page_preview: true });
}

async function handleUpdate(update, env) {
  if (update.callback_query) return handleCallback(update, env);
  if (!update.message) return;

  const text = update.message.text || "";
  if (text === "/start") return start(update, env);
  if (text === "/admin") return admin(update, env);
  if (update.message.forward_origin || update.message.forward_from_chat) return handleForward(update, env);
  if (text) return handleText(update, env);
}

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return new Response("Cercis Garden Worker is running.", { status: 200 });
    }
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    if (env.WEBHOOK_SECRET) {
      const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (supplied !== env.WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
    }

    try {
      const update = await request.json();
      await handleUpdate(update, env);
      return new Response("ok", { status: 200 });
    } catch (error) {
      console.error(error);
      return new Response("ok", { status: 200 });
    }
  },
};
