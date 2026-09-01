import app from "./src/index.js";

const tg = async (env, method, body = {}) => {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
};

const esc = (v = "") => String(v)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const isAdmin = (env, id) => String(env.ADMIN_ID || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean)
  .includes(String(id));

async function sendStats(env, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;

  await tg(env, "answerCallbackQuery", {
    callback_query_id: callbackQuery.id
  });

  if (!isAdmin(env, userId)) return new Response("ok");

  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM tracks").first();
  const users = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  const rows = (await env.DB.prepare(`
    SELECT t.id, t.title, t.url, u.count
    FROM usage_stats u
    JOIN tracks t
      ON t.id = CAST(SUBSTR(u.key, 6) AS INTEGER)
    WHERE u.key LIKE 'post:%'
    ORDER BY u.count DESC, t.id DESC
    LIMIT 3
  `).all()).results || [];

  let popular = "هنوز آماری برای رتبه‌بندی ثبت نشده است.";
  if (rows.length) {
    const medals = ["🥇", "🥈", "🥉"];
    popular = rows.map((row, i) =>
      `${medals[i]} <b>${esc(row.title || `پرونده #${row.id}`)}</b> — ${row.count} بار\n` +
      `🔗 <a href="${esc(row.url)}">مشاهده پست اصلی</a>`
    ).join("\n\n");
  }

  await tg(env, "sendMessage", {
    chat_id: chatId,
    text:
      `📊 <b>آمار ربات</b>\n\n` +
      `📚 پرونده‌ها: ${total?.n || 0}\n` +
      `👥 اعضا: ${users?.n || 0}\n\n` +
      `🏆 <b>سه پست برتر از نگاه فعالیت کاربران</b>\n\n` +
      popular,
    parse_mode: "HTML"
  });

  return new Response("ok");
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      try {
        const payload = await request.clone().json();
        if (payload.callback_query?.data === "stats") {
          return sendStats(env, payload.callback_query);
        }
      } catch {
        // Let the existing application handle malformed/non-Telegram requests.
      }
    }
    return app.fetch(request, env, ctx);
  }
};
