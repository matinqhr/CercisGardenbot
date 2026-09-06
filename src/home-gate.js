const HOME_CHANNEL="Arghavanplaylistt";
const isHomeChannel=c=>String(c||"").replace(/^@/,"").trim().toLowerCase()===HOME_CHANNEL.toLowerCase();
const parseLink=t=>{const m=String(t||"").trim().match(/^https?:\/\/t\.me\/(?:c\/)?([A-Za-z0-9_]+)\/([0-9]+)(?:\?.*)?$/);return m?{channel:m[1],post_id:Number(m[2])}:null};
const HOME='<a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a>';
const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const tgResponse=async(e,m,b={})=>new Response(JSON.stringify(await tg(e,m,b)),{status:200,headers:{"content-type":"application/json"}});
const trackUser=async(e,id)=>{if(id!=null)await e.DB.prepare("INSERT OR IGNORE INTO users(user_id) VALUES(?)").bind(id).run()};
const isAdmin=(e,id)=>String(e.ADMIN_ID||"").split(",").map(x=>x.trim()).filter(Boolean).includes(String(id));
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const warning=async(e,c,r)=>{await tg(e,"sendMessage",{chat_id:c,text:`⚠️ <b>هشدار.</b>\nمن اگر جای تو بودم، هیچ‌وقت پستی به‌جز پست‌های ${HOME} را برای خودم (سرسیس) ارسال نمی‌کردم.\n🔗 دفعهٔ بعد، قبل از ارسال مطمئن شو پست از ${HOME} آمده باشد.`,parse_mode:"HTML",...(r?{reply_to_message_id:r}:{})});return new Response("ok",{status:200})};
const listKeyboard=(page,total,admin)=>{const row=[];if(page>1)row.push({text:"‹",callback_data:`postlist:${admin?"admin":"public"}:${page-1}`});if(page<total)row.push({text:"›",callback_data:`postlist:${admin?"admin":"public"}:${page+1}`});const k=[];if(row.length)k.push(row);if(admin)k.push([{text:"🔙 پنل مدیریت",callback_data:"panel"}]);return{inline_keyboard:k}};
const listText=(rows,page,total)=>{const size=15,start=(page-1)*size;let t=`📜 <b>فهرست پست‌های ثبت‌شده</b>\n\n<b>صفحه ${page} از ${total}</b>\n\n`;for(let i=0;i<rows.length;i++){const r=rows[i],n=start+i+1;t+=`${n}. ${r.title?`🏷️ <b>${esc(r.title)}</b>`:`پرونده #${r.id}`}\n🔗 <a href="${esc(r.url)}">مشاهده پست اصلی</a>\n\n`}return t.trim()};
async function renderList(e,c,page,admin=false,messageId=null){const size=15;const count=await e.DB.prepare("SELECT COUNT(*) n FROM tracks").first();const total=Math.max(1,Math.ceil(Number(count?.n||0)/size));const p=Math.min(Math.max(Number(page)||1,1),total);const rows=(await e.DB.prepare("SELECT id,url,title FROM tracks ORDER BY id DESC LIMIT ? OFFSET ?").bind(size,(p-1)*size).all()).results||[];if(!Number(count?.n||0))return tgResponse(e,"sendMessage",{chat_id:c,text:"📜 <b>فهرست پست‌های ثبت‌شده</b>\n\nهنوز هیچ پستی ثبت نشده است.",parse_mode:"HTML",...(admin?{reply_markup:listKeyboard(1,1,true)}:{})});const body={chat_id:c,text:listText(rows,p,total),parse_mode:"HTML",reply_markup:listKeyboard(p,total,admin)};return messageId?tgResponse(e,"editMessageText",{...body,message_id:messageId}):tgResponse(e,"sendMessage",body)}
export default{async fetch(req,e){
  if(req.method!=="POST")return import("./index.js").then(mod=>mod.default.fetch(req,e));
  let update;
  try{update=await req.clone().json()}catch{return import("./index.js").then(mod=>mod.default.fetch(req,e))}
  const m=update.message,q=update.callback_query;
  if(q?.data==="request_info"){
    const r=q.message?.reply_to_message,o=r?.forward_origin,p=r?.text?parseLink(r.text):((o?.type==="channel"||o?.type==="channel_message")&&o.chat?.id!=null?{channel:o.chat?.username||o.chat?.id,post_id:o.message_id}:null);
    if(p&&!isHomeChannel(p.channel)){
      await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
      return warning(e,q.message?.chat?.id,q.message?.message_id)
    }
  }
  if(q?.data==="public_list"||(q?.data==="list"&&isAdmin(e,q.from?.id))){
    await trackUser(e,q.from?.id);
    await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
    return renderList(e,q.message?.chat?.id,1,q.data==="list");
  }
  if(q?.data?.startsWith("postlist:")){
    const [,kind,page]=q.data.split(":");
    const admin=kind==="admin";
    if(admin&&!isAdmin(e,q.from?.id))return new Response("ok",{status:200});
    await trackUser(e,q.from?.id);
    await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
    return renderList(e,q.message?.chat?.id,Number(page)||1,admin,q.message?.message_id);
  }
  if(m){
    const p=parseLink(m.text||"");
    const f=m.forward_origin?.type==="channel"||m.forward_origin?.type==="channel_message";
    const ch=p?.channel||(f?(m.forward_origin.chat?.username||m.forward_origin.chat?.id):null);
    if(ch&&!isHomeChannel(ch))return warning(e,m.chat?.id,m.message_id)
  }
  const mod=await import("./index.js");
  return mod.default.fetch(new Request(req.url,{method:req.method,headers:req.headers,body:JSON.stringify(update)}),e)
}};
