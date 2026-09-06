const HOME_CHANNEL="Arghavanplaylistt";
const GUIDE="https://telegra.ph/Cercis-08-27";
const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const tgResponse=async(e,m,b={})=>new Response(JSON.stringify(await tg(e,m,b)),{status:200,headers:{"content-type":"application/json"}});
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const isAdmin=(e,id)=>String(e.ADMIN_ID||"").split(",").map(x=>x.trim()).filter(Boolean).includes(String(id));
async function editStats(e,c,messageId){
  const users=await e.DB.prepare("SELECT COUNT(*) n FROM users").first();
  const rows=(await e.DB.prepare(`SELECT t.id,t.title,t.url FROM usage_stats s JOIN tracks t ON t.id=CAST(SUBSTR(s.key,6) AS INTEGER) WHERE s.key LIKE 'post:%' ORDER BY s.count DESC,t.id DESC LIMIT 3`).all()).results||[];
  const md=["🥇","🥈","🥉"];
  const popular=rows.length?rows.map((r,i)=>`${md[i]} <b>${esc(r.title||`پرونده #${r.id}`)}</b>\n🔗 <a href="${esc(r.url)}">مشاهده پست اصلی</a>`).join("\n\n"):"هنوز آماری برای رتبه‌بندی ثبت نشده است.";
  const b={chat_id:c,text:`📊 <b>آمار ربات</b>\n\n👥 <b>تعداد کاربران ربات:</b> ${Number(users?.n||0)}\n\n🏆 <b>سه پست برتر از نگاه فعالیت کاربران</b>\n\n${popular}`,parse_mode:"HTML",reply_markup:{inline_keyboard:[[{text:"🔄 به‌روزرسانی آمار",callback_data:"stats_inline"}],[{text:"🔙 پنل مدیریت",callback_data:"panel"}]]}};
  return messageId?tgResponse(e,"editMessageText",{...b,message_id:messageId}):tgResponse(e,"sendMessage",b)
}
export default{async fetch(req,e){
  if(req.method==="POST"){
    let u;try{u=await req.clone().json()}catch{u=null}
    const q=u?.callback_query;
    if(q&&(q.data==="stats"||q.data==="stats_inline")&&isAdmin(e,q.from?.id)){
      await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
      return editStats(e,q.message?.chat?.id,q.message?.message_id)
    }
  }
  const mod=await import("./home-gate.js");
  return mod.default.fetch(req,e)
}};