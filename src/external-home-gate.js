// Home-only source gate for CercisGardenbot.
const HOME_CHANNEL="Arghavanplaylistt";
const isHomeChannel=c=>String(c||"").replace(/^@/,"").trim().toLowerCase()===HOME_CHANNEL.toLowerCase();
const HOME_WARNING=()=>`⚠️ <b>هشدار.</b>\nمن اگر جای تو بودم، هیچ‌وقت پستی به‌جز پست‌های <a href="https://t.me/${HOME_CHANNEL}">𝐇𝐨𝐦𝐞</a> را برای خودم (سرسیس) ارسال نمی‌کردم.\n🔗 دفعهٔ بعد، قبل از ارسال مطمئن شو پست از <a href="https://t.me/${HOME_CHANNEL}">𝐇𝐨𝐦𝐞</a> آمده باشد.`;
export {HOME_CHANNEL,isHomeChannel,HOME_WARNING};
