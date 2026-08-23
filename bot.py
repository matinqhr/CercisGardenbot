import logging
import os
import re
import sqlite3

from html import escape

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_ID = int(os.environ.get("ADMIN_ID", "0"))
DB_PATH = os.environ.get("DB_PATH", "/data/cercis.db")

ADD_LINK, ADD_FORM, EDIT_LINK, EDIT_FORM = range(4)
DELETE_LINK = 4

FORM_TEMPLATE = (
    "🎵 **نام موزیک**\n"
    "🎹 **خواننده**\n"
    "📅 **تاریخ انتشار**\n"
    "✏️ **متن آهنگ**\n"
    "📝 **توضیحات**"
)


def db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL,
            post_id INTEGER NOT NULL,
            url TEXT NOT NULL UNIQUE,
            title TEXT,
            artist TEXT,
            album TEXT,
            year TEXT,
            release_date TEXT,
            lyrics TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(tracks)").fetchall()}
    migrations = {
        "release_date": "ALTER TABLE tracks ADD COLUMN release_date TEXT",
        "lyrics": "ALTER TABLE tracks ADD COLUMN lyrics TEXT",
    }
    for column, statement in migrations.items():
        if column not in columns:
            conn.execute(statement)
    conn.commit()
    return conn


def parse_post_link(text):
    m = re.match(r"^https?://t\.me/(?:c/)?([A-Za-z0-9_]+)/([0-9]+)(?:\?.*)?$", text.strip())
    if not m:
        return None
    channel, post_id = m.groups()
    return channel, int(post_id)


def get_track(channel, post_id):
    conn = db()
    row = conn.execute(
        "SELECT * FROM tracks WHERE channel=? AND post_id=?",
        (channel, post_id),
    ).fetchone()
    conn.close()
    return row


def save_track(channel, post_id, url, title, artist, release_date, lyrics, description):
    conn = db()
    conn.execute(
        """INSERT INTO tracks(channel, post_id, url, title, artist, release_date, lyrics, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(url) DO UPDATE SET
             title=excluded.title, artist=excluded.artist,
             release_date=excluded.release_date, lyrics=excluded.lyrics,
             description=excluded.description""",
        (channel, post_id, url, title, artist, release_date, lyrics, description),
    )
    conn.commit()
    conn.close()


def update_track(channel, post_id, title, artist, release_date, lyrics, description):
    conn = db()
    cur = conn.execute(
        """UPDATE tracks SET title=?, artist=?, release_date=?, lyrics=?, description=?
           WHERE channel=? AND post_id=?""",
        (title, artist, release_date, lyrics, description, channel, post_id),
    )
    conn.commit()
    conn.close()
    return cur.rowcount


def format_track(row):
    parts = []
    if row["title"]:
        parts.append(f"🎵 <b>{escape(row['title'])}</b>")
    if row["artist"]:
        parts.append(f"🎹 <b>{escape(row['artist'])}</b>")
    release_date = row["release_date"] or row["year"]
    if release_date:
        parts.append(f"📅 {escape(release_date)}")
    if row["lyrics"]:
        parts.append(f"\n✏️ <b>متن آهنگ</b>\n{escape(row['lyrics'])}")
    if row["description"]:
        parts.append(f"\n📝 <b>توضیحات</b>\n{escape(row['description'])}")
    parts.append(f"\n🔗 <a href=\"{escape(row['url'])}\">مشاهده پست اصلی</a>")
    return "\n".join(parts)


def is_admin(update):
    return bool(ADMIN_ID and update.effective_user and update.effective_user.id == ADMIN_ID)


def _clean_field(value):
    value = value.strip()
    if len(value) >= 4 and value.startswith("**") and value.endswith("**"):
        value = value[2:-2].strip()
    return value.strip()


def parse_info_form(text):
    heading_re = re.compile(
        r"^\s*(?P<emoji>🎵|🎹|📅|✏️|📝)\s*"
        r"(?:(?:\*\*)?\s*(?P<label>نام\s+موزیک|خواننده|تاریخ\s+انتشار|متن\s+آهنگ|توضیحات)\s*(?:\*\*)?\s*)?"
        r"(?::|：)?\s*(?P<value>.*)\s*$"
    )
    key_by_emoji = {"🎵": "title", "🎹": "artist", "📅": "release_date", "✏️": "lyrics", "📝": "description"}
    fields = {key: [] for key in key_by_emoji.values()}
    current = None
    for raw_line in text.replace("\r\n", "\n").split("\n"):
        match = heading_re.match(raw_line)
        if match:
            current = key_by_emoji[match.group("emoji")]
            value = _clean_field(match.group("value"))
            if value:
                fields[current].append(value)
        elif current is not None:
            continuation = raw_line.strip()
            if continuation:
                fields[current].append(continuation)
    result = {key: "\n".join(values).strip() for key, values in fields.items()}
    missing = [label for key, label in [
        ("title", "🎵 نام موزیک"), ("artist", "🎹 خواننده"),
        ("release_date", "📅 تاریخ انتشار"), ("lyrics", "✏️ متن آهنگ"),
        ("description", "📝 توضیحات")
    ] if not result[key]]
    if missing:
        return None, missing
    return result, []


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton("🎵 راهنما", callback_data="help")], [InlineKeyboardButton("ℹ️ درباره ربات", callback_data="about")]]
    await update.message.reply_text("🌳 <b>Cercis Garden</b>\n\nبرای دریافت اطلاعات یک موسیقی، لینک پست آن را ارسال کنید.", parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))


async def lookup(update: Update, context: ContextTypes.DEFAULT_TYPE):
    parsed = parse_post_link(update.message.text or "")
    if not parsed:
        await update.message.reply_text("❌ لطفاً لینک معتبر یک پست تلگرام را ارسال کنید.")
        return
    channel, post_id = parsed
    row = get_track(channel, post_id)
    if not row:
        await update.message.reply_text("🌳 این موسیقی هنوز در باغ Cercis ثبت نشده است.\nبه‌زودی شاید اطلاعاتش به آرشیو اضافه شود. 🎵")
        return
    await update.message.reply_text(format_track(row), parse_mode="HTML", disable_web_page_preview=True)


async def forwarded_lookup(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message
    origin = message.forward_origin if message else None
    if origin is None or getattr(origin, "type", None) != "channel":
        await message.reply_text("❌ نتوانستم پست اصلی را شناسایی کنم.\n\nلطفاً موزیک را مستقیماً از کانال با گزینهٔ Forward برای ربات بفرستید.")
        return
    channel_chat = origin.chat
    post_id = origin.message_id
    channel = getattr(channel_chat, "username", None)
    row = get_track(channel, post_id) if channel else None
    if not row:
        await message.reply_text("🌳 این موسیقی هنوز در باغ Cercis ثبت نشده است.\nبه‌زودی شاید اطلاعاتش به آرشیو اضافه شود. 🎵")
        return
    await message.reply_text(format_track(row), parse_mode="HTML", disable_web_page_preview=True)


async def menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    if q.data == "help":
        await q.edit_message_text("🔗 لینک پست موسیقی را همین‌جا ارسال کنید تا اطلاعات ثبت‌شده آن را پیدا کنم.\n\nهمچنین می‌توانید خود پست یا فایل موسیقی را مستقیماً از کانال برای ربات Forward کنید.")
    elif q.data == "about":
        await q.edit_message_text("🌳 Cercis Garden\nکتابخانه‌ای از اطلاعات موسیقی‌های ثبت‌شده توسط مدیریت.")


async def admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await update.message.reply_text("⛔ دسترسی ندارید.")
        return
    keyboard = [
        [InlineKeyboardButton("➕ افزودن پست", callback_data="add")],
        [InlineKeyboardButton("✏️ ویرایش اطلاعات", callback_data="edit")],
        [InlineKeyboardButton("🗑 حذف پست", callback_data="delete")],
        [InlineKeyboardButton("📊 آمار", callback_data="stats")],
    ]
    await update.message.reply_text("👑 <b>پنل مدیریت Cercis Garden</b>", parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))


async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    if not is_admin(update):
        return ConversationHandler.END
    if q.data == "add":
        await q.message.reply_text("🔗 اول لینک پست را ارسال کنید.\n\nبعد، اطلاعات موسیقی را <b>در یک پیام واحد</b> دقیقاً در این قالب بفرستید:\n\n" + f"<code>{escape(FORM_TEMPLATE)}</code>", parse_mode="HTML")
        return ADD_LINK
    if q.data == "edit":
        await q.message.reply_text("🔗 لینک پستی که می‌خواهید ویرایش کنید را ارسال کنید.")
        return EDIT_LINK
    if q.data == "delete":
        await q.message.reply_text("🔗 لینک پستی که می‌خواهید حذف کنید را ارسال کنید.")
        return DELETE_LINK
    if q.data == "stats":
        conn = db()
        count = conn.execute("SELECT COUNT(*) FROM tracks").fetchone()[0]
        conn.close()
        await q.message.reply_text(f"📊 تعداد موسیقی‌های ثبت‌شده: <b>{count}</b>", parse_mode="HTML")
    return ConversationHandler.END


async def add_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    parsed = parse_post_link(update.message.text or "")
    if not parsed:
        await update.message.reply_text("❌ لینک معتبر نیست. دوباره ارسال کنید.")
        return ADD_LINK
    context.user_data["add"] = {"channel": parsed[0], "post_id": parsed[1], "url": update.message.text.strip()}
    await update.message.reply_text("📝 حالا همه اطلاعات را در <b>یک پیام واحد</b> و دقیقاً با این قالب ارسال کنید:\n\n" + f"<code>{escape(FORM_TEMPLATE)}</code>", parse_mode="HTML")
    return ADD_FORM


async def add_form(update: Update, context: ContextTypes.DEFAULT_TYPE):
    result, missing = parse_info_form(update.message.text or "")
    if not result:
        await update.message.reply_text("❌ قالب کامل نیست. این بخش‌ها پیدا نشد:\n" + "\n".join(f"• {item}" for item in missing) + "\n\nدوباره همه اطلاعات را در یک پیام و با همان قالب ارسال کنید.")
        return ADD_FORM
    data = context.user_data.pop("add")
    save_track(data["channel"], data["post_id"], data["url"], result["title"], result["artist"], result["release_date"], result["lyrics"], result["description"])
    await update.message.reply_text("✅ اطلاعات پست با موفقیت ذخیره شد.")
    return ConversationHandler.END


async def edit_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    parsed = parse_post_link(update.message.text or "")
    if not parsed:
        await update.message.reply_text("❌ لینک معتبر نیست. دوباره ارسال کنید.")
        return EDIT_LINK
    row = get_track(parsed[0], parsed[1])
    if not row:
        await update.message.reply_text("❌ اطلاعاتی برای این پست پیدا نشد.")
        return EDIT_LINK
    context.user_data["edit"] = {"channel": parsed[0], "post_id": parsed[1]}
    await update.message.reply_text("📌 <b>اطلاعات فعلی:</b>\n\n" + format_track(row) + "\n\n✏️ حالا نسخهٔ جدید اطلاعات را <b>در یک پیام واحد</b> و با این قالب ارسال کنید:\n\n" + f"<code>{escape(FORM_TEMPLATE)}</code>", parse_mode="HTML", disable_web_page_preview=True)
    return EDIT_FORM


async def edit_form(update: Update, context: ContextTypes.DEFAULT_TYPE):
    result, missing = parse_info_form(update.message.text or "")
    if not result:
        await update.message.reply_text("❌ قالب کامل نیست. این بخش‌ها پیدا نشد:\n" + "\n".join(f"• {item}" for item in missing) + "\n\nنسخهٔ جدید را دوباره در یک پیام ارسال کنید.")
        return EDIT_FORM
    data = context.user_data.pop("edit")
    updated = update_track(data["channel"], data["post_id"], result["title"], result["artist"], result["release_date"], result["lyrics"], result["description"])
    if not updated:
        await update.message.reply_text("❌ ویرایش انجام نشد؛ اطلاعات پست پیدا نشد.")
        return ConversationHandler.END
    await update.message.reply_text("✅ اطلاعات موسیقی با موفقیت ویرایش شد.")
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("❌ عملیات لغو شد.")
    return ConversationHandler.END


async def delete_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    parsed = parse_post_link(update.message.text or "")
    if not parsed:
        await update.message.reply_text("❌ لینک معتبر نیست.")
        return DELETE_LINK
    conn = db()
    cur = conn.execute("DELETE FROM tracks WHERE channel=? AND post_id=?", parsed)
    conn.commit()
    conn.close()
    await update.message.reply_text("✅ اطلاعات حذف شد." if cur.rowcount else "❌ اطلاعاتی برای این پست پیدا نشد.")
    return ConversationHandler.END


def build_app():
    if not TOKEN:
        raise RuntimeError("BOT_TOKEN is not configured")
    db()
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("admin", admin))
    app.add_handler(CallbackQueryHandler(menu_callback, pattern="^(help|about)$"))
    admin_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(admin_panel, pattern="^(add|edit|delete|stats)$")],
        states={
            ADD_LINK: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_link)],
            ADD_FORM: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_form)],
            EDIT_LINK: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_link)],
            EDIT_FORM: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_form)],
            DELETE_LINK: [MessageHandler(filters.TEXT & ~filters.COMMAND, delete_link)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )
    app.add_handler(admin_conv)
    app.add_handler(MessageHandler(filters.FORWARDED, forwarded_lookup))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, lookup))
    return app


if __name__ == "__main__":
    build_app().run_polling(allowed_updates=Update.ALL_TYPES)
