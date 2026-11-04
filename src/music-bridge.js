const tg = async (e, method, body = {}) => (
  await fetch("https://api.telegram.org/bot" + e.BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
).json();

const out = value => new Response(JSON.stringify(value || { ok: true }), {
  status: 200,
  headers: { "content-type": "application/json" }
});

const isAdmin = (e, id) => String(e.ADMIN_ID || "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean)
  .includes(String(id));

const configuredGroup = e => String(e.MUSIC_BRIDGE_CHAT_ID || "").trim();
const configuredBot = e => String(e.MUSIC_BOT_USERNAME || "")
  .trim()
  .replace(/^@/, "")
  .toLowerCase();

async function sendText(e, chatId, text, extra = {}) {
  return tg(e, "sendMessage", { chat_id: chatId, text, ...extra });
}

async function startTest(e, callback) {
  const userId = callback.from?.id;
  const chatId = callback.message?.chat?.id;
  await tg(e, "answerCallbackQuery", { callback_query_id: callback.id });

  if (!isAdmin(e, userId)) return out({ ok: true });

  const groupId = configuredGroup(e);
  const botUsername = configuredBot(e);

  if (!groupId || !botUsername) {
    const missing = [];
    if (!groupId) missing.push("MUSIC_BRIDGE_CHAT_ID");
    if (!botUsername) missing.push("MUSIC_BOT_USERNAME");
    await sendText(
      e,
      chatId,
      "برای فعال‌کردن آزمایش، این متغیرها را در تنظیمات Worker تعریف کن:\n\n" +
      missing.map(value => "• " + value).join("\n") +
      "\n\nبرای گرفتن شناسه گروه، پس از Deploy دستور /musicbridge_id را داخل گروه Cercis Gap بفرست."
    );
    return out({ ok: true });
  }

  await e.DB.prepare(
    "UPDATE music_bridge_requests SET status='expired', updated_at=CURRENT_TIMESTAMP " +
    "WHERE status IN ('awaiting_video','sending_video','waiting_audio','delivering') " +
    "AND created_at < datetime('now','-15 minutes')"
  ).run();

  const active = await e.DB.prepare(
    "SELECT id,user_id,status FROM music_bridge_requests " +
    "WHERE group_id=? AND status IN ('awaiting_video','sending_video','waiting_audio','delivering') " +
    "ORDER BY id DESC LIMIT 1"
  ).bind(groupId).first();

  if (active) {
    const message = Number(active.user_id) === Number(userId) && active.status === "awaiting_video"
      ? "درخواست آزمایشی تو هنوز منتظر ویدیو است. همان ویدیو را ارسال کن یا /musicbridge_cancel بفرست."
      : "یک آزمایش دیگر در حال اجراست. برای جلوگیری از جابه‌جایی پاسخ‌ها، تا پایان آن درخواست تازه‌ای ثبت نمی‌کنیم.";
    await sendText(e, chatId, message);
    return out({ ok: true });
  }

  try {
    await e.DB.prepare(
      "INSERT INTO music_bridge_requests(user_id,private_chat_id,group_id,status) VALUES(?,?,?,'awaiting_video')"
    ).bind(userId, String(chatId), groupId).run();
  } catch (error) {
    console.error("[MUSIC_BRIDGE_START]", error);
    await sendText(e, chatId, "❌ ثبت درخواست آزمایشی ممکن نشد. دوباره تلاش کن.");
    return out({ ok: true });
  }

  await sendText(
    e,
    chatId,
    "🎵 آزمایش تشخیص موسیقی آماده است.\n\nحالا یک ویدیو را به همین گفت‌وگوی خصوصی ارسال کن.\nبرای لغو آزمایش: /musicbridge_cancel"
  );
  return out({ ok: true });
}

async function cancelTest(e, message) {
  const userId = message.from?.id;
  const active = await e.DB.prepare(
    "SELECT id FROM music_bridge_requests WHERE user_id=? " +
    "AND status IN ('awaiting_video','sending_video','waiting_audio') ORDER BY id DESC LIMIT 1"
  ).bind(userId).first();

  if (!active) {
    await sendText(e, message.chat.id, "درخواست فعالی برای لغو وجود ندارد.");
    return out({ ok: true });
  }

  await e.DB.prepare(
    "UPDATE music_bridge_requests SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=?"
  ).bind(active.id).run();
  await sendText(e, message.chat.id, "آزمایش لغو شد.");
  return out({ ok: true });
}

async function acceptVideo(e, message) {
  const userId = message.from?.id;
  const request = await e.DB.prepare(
    "SELECT * FROM music_bridge_requests WHERE user_id=? AND status='awaiting_video' " +
    "AND created_at >= datetime('now','-15 minutes') ORDER BY id DESC LIMIT 1"
  ).bind(userId).first();

  if (!request) return null;

  const isVideo = Boolean(
    message.video?.file_id ||
    (message.document?.file_id && String(message.document.mime_type || "").toLowerCase().startsWith("video/"))
  );

  if (!isVideo) {
    await sendText(e, message.chat.id, "لطفاً خودِ فایل ویدیو را ارسال کن؛ لینک یا متن برای این آزمایش کافی نیست.");
    return out({ ok: true });
  }

  const claimed = await e.DB.prepare(
    "UPDATE music_bridge_requests SET status='sending_video', source_message_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='awaiting_video'"
  ).bind(message.message_id, request.id).run();

  if (Number(claimed?.meta?.changes || 0) !== 1) {
    await sendText(e, message.chat.id, "این درخواست قبلاً با یک ویدیو ثبت شده است.");
    return out({ ok: true });
  }

  const copied = await tg(e, "copyMessage", {
    chat_id: request.group_id,
    from_chat_id: message.chat.id,
    message_id: message.message_id
  });

  if (!copied?.ok || !copied.result?.message_id) {
    await e.DB.prepare(
      "UPDATE music_bridge_requests SET status='failed', updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(request.id).run();
    console.error("[MUSIC_BRIDGE_COPY_VIDEO]", JSON.stringify(copied));
    await sendText(e, message.chat.id, "❌ ارسال ویدیو به گروه ناموفق بود. تنظیمات و دسترسی سرسیس به گروه را بررسی کن.");
    return out({ ok: true });
  }

  await e.DB.prepare(
    "UPDATE music_bridge_requests SET status='waiting_audio', bridge_message_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='sending_video'"
  ).bind(copied.result.message_id, request.id).run();

  const latest = await e.DB.prepare(
    "SELECT status FROM music_bridge_requests WHERE id=?"
  ).bind(request.id).first();

  if (latest?.status === "waiting_audio") {
    await sendText(e, message.chat.id, "📨 ویدیو به گروه آزمایش رسید. منتظر فایل موسیقی از ربات شناسایی هستم…");
  }
  return out({ ok: true });
}

function isAudioMessage(message) {
  return Boolean(
    message.audio?.file_id ||
    message.voice?.file_id ||
    (message.document?.file_id && String(message.document.mime_type || "").toLowerCase().startsWith("audio/"))
  );
}

async function receiveBotAudio(e, message) {
  const groupId = configuredGroup(e);
  const expectedBot = configuredBot(e);
  if (!groupId || !expectedBot) return null;
  if (String(message.chat?.id) !== groupId) return null;
  if (!message.from?.is_bot || String(message.from.username || "").toLowerCase() !== expectedBot) return null;
  if (!isAudioMessage(message)) return out({ ok: true });

  const request = await e.DB.prepare(
    "SELECT * FROM music_bridge_requests WHERE group_id=? " +
    "AND status IN ('sending_video','waiting_audio') " +
    "AND created_at >= datetime('now','-15 minutes') ORDER BY id DESC LIMIT 1"
  ).bind(groupId).first();

  if (!request) return out({ ok: true });

  const locked = await e.DB.prepare(
    "UPDATE music_bridge_requests SET status='delivering', updated_at=CURRENT_TIMESTAMP " +
    "WHERE id=? AND status IN ('sending_video','waiting_audio')"
  ).bind(request.id).run();

  if (Number(locked?.meta?.changes || 0) !== 1) return out({ ok: true });

  const delivered = await tg(e, "copyMessage", {
    chat_id: request.private_chat_id,
    from_chat_id: groupId,
    message_id: message.message_id
  });

  if (!delivered?.ok) {
    await e.DB.prepare(
      "UPDATE music_bridge_requests SET status='delivery_failed', updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(request.id).run();
    console.error("[MUSIC_BRIDGE_DELIVER_AUDIO]", JSON.stringify(delivered));
    await sendText(e, request.private_chat_id, "❌ موسیقی شناسایی شد، اما انتقال فایل به گفت‌وگوی خصوصی ناموفق بود.");
    return out({ ok: true });
  }

  await e.DB.prepare(
    "UPDATE music_bridge_requests SET status='completed', audio_message_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
  ).bind(message.message_id, request.id).run();

  await sendText(e, request.private_chat_id, "✅ موسیقی شناسایی شد و فایل آن برایت ارسال شد.");
  return out({ ok: true });
}

export async function handle(e, update) {
  if (!update) return null;

  const callback = update.callback_query;
  if (callback?.data === "music_bridge_start") return startTest(e, callback);

  const message = update.message;
  if (!message) return null;

  if (String(message.text || "").trim() === "/musicbridge_id" && isAdmin(e, message.from?.id)) {
    if (message.chat?.type !== "group" && message.chat?.type !== "supergroup") {
      await sendText(e, message.chat.id, "این دستور را داخل گروه Cercis Gap بفرست، نه در گفت‌وگوی خصوصی.");
      return out({ ok: true });
    }
    await sendText(e, message.chat.id, "شناسه گروه Cercis Gap:\n" + String(message.chat.id));
    return out({ ok: true });
  }

  if (String(message.text || "").trim() === "/musicbridge_cancel" && isAdmin(e, message.from?.id) && message.chat?.type === "private") {
    return cancelTest(e, message);
  }

  if (message.chat?.type === "private" && isAdmin(e, message.from?.id)) {
    const result = await acceptVideo(e, message);
    if (result) return result;
  }

  if (message.chat?.type === "group" || message.chat?.type === "supergroup") {
    return receiveBotAudio(e, message);
  }

  return null;
}
