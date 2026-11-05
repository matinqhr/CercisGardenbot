const tg = async (e, method, body = {}) => (
  await fetch("https://api.telegram.org/bot" + e.BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
).json();

const isAdmin = (e, id) => String(e.ADMIN_ID || "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean)
  .includes(String(id));

const sendText = (e, chatId, text, extra = {}) =>
  tg(e, "sendMessage", { chat_id: chatId, text, ...extra });

const SETTINGS_TABLE = "music_tagger_settings";
const SESSIONS_TABLE = "music_tagger_sessions";
const ARTIST = "ارغوان";
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_COVER_BYTES = 200 * 1024;

const menuKeyboard = {
  inline_keyboard: [
    [{ text: "🎵 ویرایش یک فایل موسیقی", callback_data: "music_tagger_start" }],
    [{ text: "🖼 ثبت / تغییر کاور ثابت", callback_data: "music_tagger_set_cover" }]
  ]
};

async function setting(e, key) {
  return e.DB.prepare(
    "SELECT setting_value FROM " + SETTINGS_TABLE + " WHERE setting_key=?"
  ).bind(key).first();
}

async function saveSetting(e, key, value) {
  return e.DB.prepare(
    "INSERT INTO " + SETTINGS_TABLE + "(setting_key,setting_value) VALUES(?,?) " +
    "ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP"
  ).bind(key, String(value)).run();
}

async function getSession(e, userId) {
  return e.DB.prepare(
    "SELECT * FROM " + SESSIONS_TABLE + " WHERE user_id=?"
  ).bind(userId).first();
}

async function setSession(e, userId, step, audio = null) {
  return e.DB.prepare(
    "INSERT INTO " + SESSIONS_TABLE +
    "(user_id,step,audio_file_id,audio_file_name,audio_mime_type,updated_at) " +
    "VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) " +
    "ON CONFLICT(user_id) DO UPDATE SET step=excluded.step," +
    "audio_file_id=excluded.audio_file_id,audio_file_name=excluded.audio_file_name," +
    "audio_mime_type=excluded.audio_mime_type,updated_at=CURRENT_TIMESTAMP"
  ).bind(
    userId,
    step,
    audio?.file_id || null,
    audio?.file_name || null,
    audio?.mime_type || null
  ).run();
}

async function clearSession(e, userId) {
  return e.DB.prepare(
    "DELETE FROM " + SESSIONS_TABLE + " WHERE user_id=?"
  ).bind(userId).run();
}

async function downloadTelegramFile(e, fileId, maxBytes) {
  const info = await tg(e, "getFile", { file_id: fileId });
  if (!info?.ok || !info.result?.file_path) {
    throw new Error("TELEGRAM_GET_FILE_FAILED: " + (info?.description || "unknown"));
  }
  if (Number(info.result.file_size || 0) > maxBytes) {
    throw new Error("FILE_TOO_LARGE");
  }

  const response = await fetch(
    "https://api.telegram.org/file/bot" + e.BOT_TOKEN + "/" + info.result.file_path
  );
  if (!response.ok) throw new Error("TELEGRAM_DOWNLOAD_FAILED");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("FILE_TOO_LARGE");
  return bytes;
}

function isJpeg(bytes) {
  return bytes?.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function chooseCoverPhoto(photoSizes) {
  const sizes = Array.isArray(photoSizes) ? photoSizes.filter(x => x?.file_id) : [];
  const withinTelegramLimit = sizes.filter(x =>
    Number(x.width || 0) > 0 &&
    Number(x.height || 0) > 0 &&
    Number(x.width) <= 320 &&
    Number(x.height) <= 320 &&
    (!Number(x.file_size) || Number(x.file_size) <= MAX_COVER_BYTES)
  );
  const candidates = withinTelegramLimit.length
    ? withinTelegramLimit
    : sizes.filter(x => Number(x.width || 0) > 0 && Number(x.height || 0) > 0);
  candidates.sort((a, b) => {
    const areaA = Number(a.width || 0) * Number(a.height || 0);
    const areaB = Number(b.width || 0) * Number(b.height || 0);
    return withinTelegramLimit.length ? areaB - areaA : areaA - areaB;
  });
  return candidates[0] || null;
}

function uint32be(value) {
  return new Uint8Array([
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ]);
}

function syncsafe(value) {
  return new Uint8Array([
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f
  ]);
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function utf16leWithBom(value) {
  const text = String(value);
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 255;
    bytes[3 + i * 2] = code >>> 8;
  }
  return bytes;
}

function id3Frame(id, body) {
  const name = new TextEncoder().encode(id);
  return concatBytes([name, uint32be(body.length), new Uint8Array([0, 0]), body]);
}

function makeId3Tag(title, artist, coverBytes) {
  const titleFrame = id3Frame(
    "TIT2",
    concatBytes([new Uint8Array([1]), utf16leWithBom(title)])
  );
  const artistFrame = id3Frame(
    "TPE1",
    concatBytes([new Uint8Array([1]), utf16leWithBom(artist)])
  );
  const apicBody = concatBytes([
    new Uint8Array([1]),
    new TextEncoder().encode("image/jpeg"),
    new Uint8Array([0, 3]),
    new Uint8Array([0xff, 0xfe, 0, 0]),
    coverBytes
  ]);
  const coverFrame = id3Frame("APIC", apicBody);
  const frames = concatBytes([titleFrame, artistFrame, coverFrame]);
  return concatBytes([
    new TextEncoder().encode("ID3"),
    new Uint8Array([3, 0, 0]),
    syncsafe(frames.length),
    frames
  ]);
}

function stripExistingId3(bytes) {
  let start = 0;
  let end = bytes.length;

  if (bytes.length >= 10 &&
      bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const sizeBytes = bytes.subarray(6, 10);
    if (sizeBytes.some(value => value & 0x80)) throw new Error("INVALID_ID3_HEADER");
    const tagSize =
      (sizeBytes[0] << 21) |
      (sizeBytes[1] << 14) |
      (sizeBytes[2] << 7) |
      sizeBytes[3];
    start = 10 + tagSize + ((bytes[5] & 0x10) ? 10 : 0);
    if (start >= end) throw new Error("INVALID_ID3_HEADER");
  }

  if (end - start >= 128 &&
      bytes[end - 128] === 0x54 &&
      bytes[end - 127] === 0x41 &&
      bytes[end - 126] === 0x47) {
    end -= 128;
  }

  if (end <= start) throw new Error("INVALID_MP3");
  let hasMpegFrame = false;
  const scanEnd = Math.min(end - 1, start + 4096);
  for (let i = start; i < scanEnd; i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
      hasMpegFrame = true;
      break;
    }
  }
  if (!hasMpegFrame) throw new Error("INVALID_MP3");
  return { start, end };
}

async function registerCover(e, message) {
  const chosen = chooseCoverPhoto(message.photo);
  if (!chosen) {
    await sendText(e, message.chat.id, "❌ عکس کاور دریافت نشد. تصویر را به‌صورت Photo بفرست، نه به شکل Document.");
    return;
  }

  try {
    const bytes = await downloadTelegramFile(e, chosen.file_id, MAX_COVER_BYTES);
    if (!isJpeg(bytes)) throw new Error("COVER_NOT_JPEG");
    await saveSetting(e, "cover_file_id", chosen.file_id);
    await clearSession(e, message.from.id);
    await sendText(
      e,
      message.chat.id,
      "✅ کاور ثابت سرسیس ثبت شد. از این پس همین تصویر روی فایل‌های MP3 ویرایش‌شده قرار می‌گیرد.",
      { reply_markup: menuKeyboard }
    );
  } catch (error) {
    console.error("[MUSIC_TAGGER_COVER]", error);
    const description = error?.message === "FILE_TOO_LARGE"
      ? "حجم نسخهٔ کوچک تصویر هم بیشتر از ۲۰۰ کیلوبایت است. لطفاً تصویر را دوباره به‌صورت Photo بفرست."
      : "تصویر باید JPEG باشد و نسخهٔ کوچک آن حداکثر ۲۰۰ کیلوبایت حجم داشته باشد.";
    await sendText(e, message.chat.id, "❌ " + description);
  }
}

function audioFromMessage(message) {
  const audio = message.audio || message.document;
  if (!audio?.file_id) return null;
  const providedName = String(audio.file_name || "");
  const fileName = providedName || "music.mp3";
  const mimeType = String(audio.mime_type || "").toLowerCase();
  const isMp3 = /\.mp3$/i.test(providedName) || mimeType === "audio/mpeg";
  if (!isMp3) return { unsupported: true, file_name: fileName, mime_type: mimeType };
  return {
    file_id: audio.file_id,
    file_name: fileName,
    mime_type: "audio/mpeg",
    file_size: Number(audio.file_size || 0)
  };
}

async function processAudio(e, message, session, rawTitle) {
  const chatId = message.chat.id;
  const plainTitle = String(rawTitle || "").trim().replace(/^~+|~+$/g, "").trim();
  if (!plainTitle) {
    await sendText(e, chatId, "❌ نام قطعه خالی است. نام را دوباره بفرست.");
    return;
  }
  if (Array.from(plainTitle).length > 120) {
    await sendText(e, chatId, "❌ نام قطعه بیش از حد طولانی است. حداکثر ۱۲۰ نویسه بفرست.");
    return;
  }

  const coverSetting = await setting(e, "cover_file_id");
  if (!coverSetting?.setting_value) {
    await clearSession(e, message.from.id);
    await sendText(e, chatId, "❌ هنوز کاور ثابتی ثبت نشده است. ابتدا از بخش «ثبت / تغییر کاور ثابت» یک تصویر ثبت کن.");
    return;
  }

  await sendText(e, chatId, "⚙️ در حال اصلاح مشخصات فایل موسیقی…");
  try {
    const [audioBytes, coverBytes] = await Promise.all([
      downloadTelegramFile(e, session.audio_file_id, MAX_AUDIO_BYTES),
      downloadTelegramFile(e, coverSetting.setting_value, MAX_COVER_BYTES)
    ]);

    if (!isJpeg(coverBytes)) throw new Error("COVER_NOT_JPEG");
    const { start, end } = stripExistingId3(audioBytes);
    const title = "~" + plainTitle + "~";
    const tag = makeId3Tag(title, ARTIST, coverBytes);
    const audioBlob = new Blob(
      [tag, audioBytes.subarray(start, end)],
      { type: "audio/mpeg" }
    );

    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("title", title);
    form.append("performer", ARTIST);
    form.append("audio", audioBlob, "Cercis-edited.mp3");
    form.append("thumbnail", new Blob([coverBytes], { type: "image/jpeg" }), "cover.jpg");

    const sent = await fetch(
      "https://api.telegram.org/bot" + e.BOT_TOKEN + "/sendAudio",
      { method: "POST", body: form }
    ).then(response => response.json());

    if (!sent?.ok) {
      console.error("[MUSIC_TAGGER_SEND_AUDIO]", JSON.stringify(sent));
      throw new Error("SEND_AUDIO_FAILED");
    }

    await clearSession(e, message.from.id);
    await sendText(
      e,
      chatId,
      "✅ مشخصات فایل اصلاح شد.\n\nعنوان: " + title +
      "\nخواننده: " + ARTIST +
      "\nکاور: تصویر ثابت ثبت‌شده در سرسیس",
      { reply_markup: menuKeyboard }
    );
  } catch (error) {
    console.error("[MUSIC_TAGGER_PROCESS]", error);
    let description = "پردازش فایل ناموفق بود. فایل را دوباره بررسی کن و نام قطعه را مجدداً بفرست تا تلاش کنیم.";
    if (error?.message === "FILE_TOO_LARGE") {
      await setSession(e, message.from.id, "await_audio");
      description = "حجم MP3 برای این نسخه بیشتر از ۱۲ مگابایت است. لطفاً فایل کوچک‌تری بفرست.";
    } else if (error?.message === "INVALID_MP3") {
      await setSession(e, message.from.id, "await_audio");
      description = "فایل ارسالی ساختار MP3 قابل‌ویرایش ندارد. لطفاً یک فایل واقعی با پسوند MP3 بفرست.";
    } else if (error?.message === "INVALID_ID3_HEADER") {
      await setSession(e, message.from.id, "await_audio");
      description = "تگ فعلی فایل MP3 معتبر نیست. لطفاً یک فایل دیگر بفرست.";
    } else if (error?.message === "SEND_AUDIO_FAILED") {
      description = "فایل ویرایش شد، اما Telegram آن را نپذیرفت. نشست حفظ شده؛ نام قطعه را دوباره بفرست تا دوباره ارسال شود.";
    }
    await sendText(e, chatId, "❌ " + description);
  }
}

async function openMenu(e, callback) {
  const chatId = callback.message?.chat?.id;
  const cover = await setting(e, "cover_file_id");
  const text = cover?.setting_value
    ? "🎧 <b>ویرایشگر مشخصات موسیقی سرسیس</b>\n\nکاور ثابت ثبت شده است. برای هر فایل MP3، نام قطعه را وارد می‌کنی و سرسیس عنوان، خواننده و تصویر کاور را داخل فایل ذخیره می‌کند."
    : "🎧 <b>ویرایشگر مشخصات موسیقی سرسیس</b>\n\nبرای شروع، ابتدا یک کاور ثابت ثبت کن. بعد از آن می‌توانی فایل‌های MP3 را با همان کاور و نام خوانندهٔ «ارغوان» ویرایش کنی.";
  await sendText(e, chatId, text, { parse_mode: "HTML", reply_markup: menuKeyboard });
}

export async function handle(e, update) {
  const callback = update?.callback_query;
  if (callback?.data?.startsWith("music_tagger_")) {
    const userId = callback.from?.id;
    const chatId = callback.message?.chat?.id;
    await tg(e, "answerCallbackQuery", { callback_query_id: callback.id });
    if (!isAdmin(e, userId)) return new Response("ok");

    if (callback.data === "music_tagger_open") return openMenu(e, callback);

    if (callback.data === "music_tagger_set_cover") {
      await setSession(e, userId, "await_cover");
      return sendText(e, chatId, "🖼 تصویر کاور ثابت را به‌صورت Photo ارسال کن. برای کیفیت مناسب، تصویر مربعی و واضح انتخاب کن.");
    }

    if (callback.data === "music_tagger_start") {
      const cover = await setting(e, "cover_file_id");
      if (!cover?.setting_value) {
        return sendText(e, chatId, "ابتدا باید کاور ثابت را ثبت کنی.", {
          reply_markup: { inline_keyboard: [[{ text: "🖼 ثبت کاور", callback_data: "music_tagger_set_cover" }]] }
        });
      }
      await setSession(e, userId, "await_audio");
      return sendText(e, chatId, "🎵 حالا فایل موسیقی را به‌صورت MP3 ارسال کن. پس از دریافت فایل، نام قطعه را از تو می‌پرسم.\n\nبرای لغو: /music_tagger_cancel");
    }

    return new Response("ok");
  }

  const message = update?.message;
  if (!message || !isAdmin(e, message.from?.id) || message.chat?.type !== "private") return null;

  const session = await getSession(e, message.from.id).catch(() => null);
  if (!session) return null;

  if (message.text?.trim() === "/music_tagger_cancel") {
    await clearSession(e, message.from.id);
    await sendText(e, message.chat.id, "ویرایش موسیقی لغو شد.");
    return new Response("ok");
  }

  if (session.step === "await_cover") {
    if (message.photo?.length) {
      await registerCover(e, message);
      return new Response("ok");
    }
    await sendText(e, message.chat.id, "لطفاً تصویر را به‌صورت Photo ارسال کن، نه فایل متنی یا Document.");
    return new Response("ok");
  }

  if (session.step === "await_audio") {
    const audio = audioFromMessage(message);
    if (!audio) {
      await sendText(e, message.chat.id, "لطفاً یک فایل موسیقی MP3 بفرست.");
      return new Response("ok");
    }
    if (audio.unsupported) {
      await sendText(e, message.chat.id, "این قالب پشتیبانی نمی‌شود. در نسخهٔ فعلی فقط MP3 پذیرفته می‌شود.");
      return new Response("ok");
    }
    if (audio.file_size > MAX_AUDIO_BYTES) {
      await sendText(e, message.chat.id, "حجم فایل بیشتر از ۱۲ مگابایت است. لطفاً نسخهٔ کوچک‌تری بفرست.");
      return new Response("ok");
    }
    await setSession(e, message.from.id, "await_title", audio);
    await sendText(e, message.chat.id, "🏷️ نام قطعه را بفرست.\n\nمثال: سلام\n\nسرسیس آن را به شکل «~سلام~» داخل فایل ثبت می‌کند.");
    return new Response("ok");
  }

  if (session.step === "await_title") {
    if (!message.text) {
      await sendText(e, message.chat.id, "🏷️ لطفاً نام قطعه را به‌صورت پیام متنی بفرست.");
      return new Response("ok");
    }
    await processAudio(e, message, session, message.text);
    return new Response("ok");
  }

  return null;
}
