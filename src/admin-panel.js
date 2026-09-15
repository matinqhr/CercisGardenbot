const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const resp=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
const admin=(e,id)=>String(e.ADMIN_ID||"").split(",").map(x=>x.trim()).filter(Boolean).includes(String(id));
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const panel={inline_keyboard:[[{text:"➕ افزودن پرونده",callback_data:"add"}],[{text:"✏️ ویرایش پرونده",callback_data:"edit"}],[{text:"🗑 حذف پرونده",callback_data:"delete"}],[{text:"📊 آمار",callback_data:"stats"}],[{text:"📢 پیام همگانی",callback_data:"broadcast"}],[{text:"🌱 از کاستی تا کمال",callback_data:"ideas"}]]};
async function q1(e,sql,...b){try{return await e.DB.prepare(sql).bind(...b).first()}catch{return null}}
async function qall(e,sql,...b){try{return(await e.DB.prepare(sql).bind(...b).all()).results||[]}catch{return[]}}
async function n(e,sql,...b){const r=await q1(e,sql,...b);return Number(r?.n||0)}
async function stats(e,q){
  const users=await n(e,"SELECT COUNT(*) n FROM users");
  const tracks=await n(e,"SELECT COUNT(*) n FROM tracks");
  const flashTracks=await n(e,"SELECT COUNT(*) n FROM tracks WHERE display_mode='flashcard'");
  const cards=await n(e,"SELECT COUNT(*) n FROM flashcards");
  const sessions=await n(e,"SELECT COUNT(*) n FROM sessions WHERE step IS NOT NULL AND TRIM(step)!='' AND (updated_at IS NULL OR updated_at >= datetime('now','-30 minutes'))");
  const ideas=await n(e,"SELECT COUNT(*) n FROM improvement_ideas");
  const activities=await n(e,"SELECT COALESCE(SUM(count),0) n FROM usage_stats");
  const requests=await n(e,"SELECT COUNT(*) n FROM information_requests");
  const posts=await qall(e,"SELECT t.id,t.title,t.url,COALESCE(SUM(s.count),0) activity FROM tracks t LEFT JOIN usage_stats s ON s.key='post:'||t.id GROUP BY t.id,t.title,t.url ORDER BY activity DESC,t.id DESC LIMIT 3");
  const medals=["🥇","🥈","🥉"];
  const top=posts.length?posts.map((r,i)=>`${medals[i]} <b>${esc(r.title||`پرونده #${r.id}`)}</b> — <b>${Number(r.activity||0)}</b> فعالیت\n🔗 <a href="${esc(r.url||"")}">مشاهده پست اصلی</a>`).join("\n\n"):"هنوز فعالیتی برای رتبه‌بندی ثبت نشده است.";
  const text=`📊 <b>آمار کامل 𝐂𝐞𝐫𝐜𝐢𝐬</b>\n\n`+
    `👥 <b>کاربران</b>: ${users}\n`+
    `📚 <b>پرونده‌های ثبت‌شده</b>: ${tracks}\n`+
    `🃏 <b>پرونده‌های فلش‌کارتی</b>: ${flashTracks}\n`+
    `📝 <b>تعداد کارت‌های فلش‌کارت</b>: ${cards}\n`+
    `⚡ <b>کل فعالیت‌های ثبت‌شده</b>: ${activities}\n`+
    `📩 <b>درخواست‌های ثبت اطلاعات</b>: ${requests}\n`+
    `🟡 <b>نشست‌های فعال</b>: ${sessions}\n`+
    `🌱 <b>ایده‌ها و کاستی‌ها</b>: ${ideas}\n\n`+
    `🏆 <b>سه پرونده با بیشترین فعالیت</b>\n\n${top}`;
  return edit(e,q,text,{inline_keyboard:[[{text:"🔄 به‌روزرسانی آمار",callback_data:"stats"}],[{text:"🔙 پنل مدیریت",callback_data:"panel"}]]})
}
async function edit(e,q,text,markup){const r=await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text,parse_mode:"HTML",reply_markup:markup});return resp(r)}
export default{async fetch(req,e){let u;try{u=await req.clone().json()}catch{return new Response("ok")};const q=u?.callback_query,m=u?.message,id=q?.from?.id||m?.from?.id;if(!admin(e,id))return new Response("ok");const c=q?.message?.chat?.id||m?.chat?.id,mid=q?.message?.message_id;if(q?.id)await tg(e,"answerCallbackQuery",{callback_query_id:q.id});if(q?.data==="stats"||q?.data==="stats_inline")return stats(e,q);const body={chat_id:c,text:"👑 <b>پنل مدیریت 𝐂𝐞𝐫𝐜𝐢𝐬🤖</b>",parse_mode:"HTML",reply_markup:panel};if(q?.id)return resp(await tg(e,"editMessageText",{...body,message_id:mid}));return resp(await tg(e,"sendMessage",body))}};