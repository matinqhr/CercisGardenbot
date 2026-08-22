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
DB_PATH = os.environ.get("DB_PATH", "cercis.db")

ADD_LINK, ADD_TITLE, ADD_ARTIST, ADD_ALBUM, ADD_YEAR, ADD_DESCRIPTION = range(6)
EDIT_LINK, EDIT_FIELD, EDIT_VALUE = range(6, 9)
DELETE_LINK = 9


def db():
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
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )
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


def save_track(channel, post_id, url, title, artist, album, year, description):
    conn = db()
    conn.execute(
        """INSERT INTO tracks(channel, post_id, url, title, artist, album, year, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(url) DO UPDATE SET
             title=excluded.title, artist=excluded.artist, album=excluded.album,
             year=excluded.year, description=excluded.description""",
        (channel, post_id, url, title, artist, album, year, description),
    )
    conn.commit()
    conn.close()


def format_track(row):
    parts = []
    if row["title"]:
        parts.append(f"🎵 <b>{escape(row['title'])}</b>")
    if row["artist"]:
        parts.append(f"🎹 <b>{escape(row['artist'])}</b>")
    if row["album"]:
        parts.append(f"💿 {escape(row['album'])}")
    if row["year"]:
        parts.append(f"📅 {escape(row['year'])}")
    if row["description"]:
        parts.append(f"\n📝 <b>توضیحات</b>\n{escape(row['description'])}")
    parts.append(f"\n🔗 <a href=\"{escape(row['url'])}\">مشاهده پست اصلی</a>")
    return "\n".join(parts)


def is_admin(update):
    return bool(ADMIN_ID and update.effective_user and update.effective_user.id == ADMIN_ID)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("🎵 راهنما", callback_data="help")],
        [InlineKeyboardButton("ℹ️ درباره ربات", callback_data="about")],
    ]
    await update.message.reply_text(
        "🌳 <b>Cercis Garden</b>\n\nبرای دریافت اطلاعات یک موسیقی، لینک پست آن را ارسال کنید.",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def lookup(update: Update, context: ContextTypes.DEFAULT_TYPE):
    parsed = parse_post_link(update.message.text or "")
    if not parsed:
        await update.message.reply_text("❌ لطفاً لینک معتبر یک پست تلگرام را ارسال کنید.")
        return
    channel, post_id = parsed
    row = get_track(channel, post_id)
    if not row:
        await update.message.reply_text("❌ اطلاعاتی برای این پست ثبت نشده است.")
        return
    await update.message.reply_text(format_track(row), parse_mode="HTML", disable_web_page_preview=True)


async def forwarded_lookup(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Look up a track by the original channel post of a forwarded message."""
    message = update.message
    origin = message.forward_origin if message else None

    if origin is None or getattr(origin, "type", None) != "channel":
        await message.reply_text(
            "❌ نتوانستم پست اصلی را شناسایی کنم.\n\n"
            "لطفاً موزیک را مستقیماً از کانال با گزینهٔ Forward برای ربات بفرستید."
        )
        return

    channel_chat = origin.chat
    post_id = origin.message_id
    channel = getattr(channel_chat, "username", None)

    if channel:
        row = get_track(channel, post_id)
    else:
        row = None

    if not row:
        await message.reply_text(
            "❌ این پست هنوز در Cercis Garden ثبت نشده است.\n\n"
            "از لینک همان پست برای ثبت آن در پنل مدیریت استفاده کنید."
        )
        return

    await message.reply_text(
        format_track(row),
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


async def menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    if q.data == "help":
        await q.edit_message_text(
            "🔗 لینک پست موسیقی را همین‌جا ارسال کنید تا اطلاعات ثبت‌شده آن را پیدا کنم.\n\n"
            "همچنین می‌توانید خود پست یا فایل موسیقی را مستقیماً از کانال برای ربات Forward کنید."
        )
    elif q.data == "about":
        await q.edit_message_text(
            "🌳 Cercis Garden\nکتابخانه‌ای از اطلاعات موسیقی‌های ثبت‌شده توسط مدیریت."
        )


async def admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await update.message.reply_text("⛔ دسترسی ندارید.")
        return
    keyboard = [
        [InlineKeyboardButton("➕ افزودن پست", callback_data="add")],
        [
            InlineKeyboardButton("✏️ ویرایش اطلاعات", callback_data="edit"),
            InlineKeyboardButton("🗑 حذف پست", callback_data="delete"),
        ],
        [InlineKeyboardButton("📊 آمار", callback_data="stats")],
    ]
    await update.message.reply_text(
        "👑 <b>پنل مدیریت Cercis Garden</b>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    if not is_admin(update):
        return
    if q.data == "add":
        await q.message.reply_text("🔗 لینک پست را ارسال کنید.")
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
        await q.message.reply_text(
            f"📊 تعداد موسیقی‌های ثبت‌شده: <b>{count}</b>",
            parse_mode="HTML",
        )
    return ConversationHandler.END


async def add_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    parsed = parse_post_link(update.message.text or "")
    if not parsed:
        await update.message.reply_text("❌ لینک معتبر نیست. دوباره ارسال کنید.")
        return ADD_LINK
    context.user_data["add"] = {
        "channel": parsed[0],
        "post_id": parsed[1],
        "url": update.message.text.strip(),
    }
    await update.message.reply_text("🎵 نام موسیقی را وارد کنید:")
    return ADD_TITLE


async def add_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["add"]["title"] = update.message.text
    await update.message.reply_text("🎹 نام آهنگساز / هنرمند را وارد کنید (یا -):")
    return ADD_ARTIST


async def add_artist(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["add"]["artist"] = "" if update.message.text.strip() == "-" else update.message.text
    await update.message.reply_text("💿 نام آلبوم را وارد کنید (یا -):")
    return ADD_ALBUM


async def add_album(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["add"]["album"] = "" if update.message.text.strip() == "-" else update.message.text
    await update.message.reply_text("📅 سال انتشار را وارد کنید (یا -):")
    return ADD_YEAR


async def add_year(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["add"]["year"] = "" if update.message.text.strip() == "-" else update.message.text
    await update.message.reply_text("📝 توضیحات را وارد کنید (یا -):")
    return ADD_DESCRIPTION


async def add_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = context.user_data.pop("add")
    data["description"] = "" if update.message.text.strip() == "-" else update.message.text
    save_track(**data)
    await update.message.reply_text("✅ اطلاعات پست با موفقیت ذخیره شد.")
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
    await update.message.reply_text(
        "✅ اطلاعات حذف شد." if cur.rowcount else "❌ اطلاعاتی برای این پست پیدا نشد."
    )
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
            ADD_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_title)],
            ADD_ARTIST: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_artist)],
            ADD_ALBUM: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_album)],
            ADD_YEAR: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_year)],
            ADD_DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_description)],
            DELETE_LINK: [MessageHandler(filters.TEXT & ~filters.COMMAND, delete_link)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )
    app.add_handler(admin_conv)

    # Forwarded posts are checked before ordinary text handling.
    app.add_handler(MessageHandler(filters.FORWARDED, forwarded_lookup))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, lookup))
    return app


if __name__ == "__main__":
    build_app().run_polling(allowed_updates=Update.ALL_TYPES)
