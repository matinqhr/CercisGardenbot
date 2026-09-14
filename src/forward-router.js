const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const out=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
const admin=(e,id)=>String(e.ADMIN_ID||"").split(",").map(x=>x.trim()).filter(Boolean).includes(String(id));
const link=t=>{const m=String(t||"").trim().match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:c\/)?([A-Za-z0-9_]+)\/?([0-9]+)\/?(?:\?.*)?$/);return m?{channel:m[1],post_id:Number(m[2])}:null};
const forwardedLink=m=>{const o=m?.forward_origin;if(o&&(o.type==="channel"||o.type==="channel_message")&&o.message_id!=null){const c=o.chat?.username||o.chat?.id;return c!=null?`https://t.me/${String(c).replace(/^@/,"")}/${Number(o.message_id)}`:null}if(m?.forward_from_chat&&m?.forward_from_message_id!=null){const c=m.forward_from_chat.username||m.forward_from_chat.id;return c!=null?`https://t.me/${String(c).replace(/^@/,"")}/${Number(m.forward_from_message_id)}`:null}return null};
const startText=`🌳 <b>Cercis Garden</b>\n\nکتابخانه‌ای از اطلاعات پست‌های <a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a>.\n\nلینک یا خودِ پستی را که از 𝐇𝐨𝐦𝐞 دریافت کرده‌اید برای من ارسال کنید.`;
const startKeyboard={inline_keyboard:[[{text:"📚 راهنما",callback_data:"help"}],[{text:"ℹ️ درباره ربات",url:"https://telegra.ph/Cercis-08-27"}],[{text:"📜 فهرست پست‌های ثبت‌شده",callback_data:"public_list"}]]};
const sendStart=async(e,m)=>out(await tg(e,"sendMessage",{chat_id:m?.chat?.id,text:startText,parse_mode:"HTML",reply_markup:startKeyboard}));
async function hasActiveAdminSession(e,id){if(!admin(e,id))return false;try{const s=await e.DB.prepare("SELECT step,updated_at FROM sessions WHERE user_id=?").bind(id).first();if(!s?.step)return false;if(!s.updated_at)return true;const t=Date.parse(String(s.updated_at).replace(" ","T")+"Z");return !Number.isNaN(t)&&Date.now()-t<30*60*1000}catch{return false}}
const publicHelpText=`📚 <b>راهنمای کتابخانه</b>\n\nلینک یا خودِ پستی را که از کانال <a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a> دریافت کرده‌اید برای من ارسال کنید.\n\nمن فقط اطلاعات پست‌های ثبت‌شده در آرشیو 𝐇𝐨𝐦𝐞 را ارائه می‌کنم.\n\nلطفاً فقط پست‌های 𝐇𝐨𝐦𝐞 را ارسال کنید.`;
async function publicList(e,c){try{const rows=(await e.DB.prepare("SELECT id,url,title FROM tracks ORDER BY id DESC").all()).results||[];if(!rows.length)return tg(e,"sendMessage",{chat_id:c,text:"📜 <b>فهرست پرونده‌های ثبت‌شده</b>\n\nهنوز هیچ پرونده‌ای ثبت نشده است.",parse_mode:"HTML"});let t="📜 <b>فهرست پرونده‌های ثبت‌شده</b>\n\n";for(let i=0;i<rows.length;i++){const r=rows[i],title=String(r.title||`پرونده #${r.id}`).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),url=String(r.url||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;");const x=`${i+1}. 🏷️ <b>${title}</b>\n🔗 <a href="${url}">مشاهده پست اصلی</a>\n\n`;if((t+x).length>3800){await tg(e,"sendMessage",{chat_id:c,text:t,parse_mode:"HTML"});t="📜 <b>ادامه فهرست</b>\n\n"}t+=x}return tg(e,"sendMessage",{chat_id:c,text:t,parse_mode:"HTML"})}catch(err){return tg(e,"sendMessage",{chat_id:c,text:"⚠️ در حال حاضر امکان نمایش فهرست پرونده‌ها وجود ندارد.\n\nلطفاً کمی بعد دوباره تلاش کنید."})}}
async function routeCallback(req,e,ctx,u){
  const q=u?.callback_query;
  if(!q)return null;
  const id=q.from?.id;
  if(admin(e,id))return import("./stability-router.js").then(x=>x.default.fetch(req,e,ctx));
  const d=String(q.data||"");
  if(d==="help"){
    await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
    return out(await tg(e,"sendMessage",{chat_id:q.message?.chat?.id,text:publicHelpText,parse_mode:"HTML",reply_markup:{inline_keyboard:[[{text:"🔙 منوی اصلی",callback_data:"public_start"}]]}}));
  }
  if(d==="public_start"){
    await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
    return out(await tg(e,"sendMessage",{chat_id:q.message?.chat?.id,text:startText,parse_mode:"HTML",reply_markup:startKeyboard}));
  }
  if(d==="public_list"){
    await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
    return out(await publicList(e,q.message?.chat?.id));
  }
  if(d==="request_info")return import("./home-gate.js").then(x=>x.default.fetch(req,e,ctx));
  return out({ok:true});
}
async function route(req,e,ctx,u){
  const cb=await routeCallback(req,e,ctx,u);
  if(cb)return cb;
  const m=u?.message;
  if(!m)return out({ok:true});
  if(String(m.text||"").trim()==="/start")return sendStart(e,m);
  const direct=link(m.text||m.caption||"");
  const forwarded=forwardedLink(m);
  const publicLink=direct||forwarded;
  const patched=publicLink?new Request(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({...u,message:{...m,text:publicLink,entities:[]}})}):req;
  const active=admin(e,m.from?.id)&&await hasActiveAdminSession(e,m.from?.id);
  if(publicLink&&!active)return import("./public-delivery.js").then(x=>x.default.fetch(patched,e,ctx));
  if(!admin(e,m.from?.id))return out({ok:true});
  return import("./stability-router.js").then(x=>x.default.fetch(patched,e,ctx));
}
export default{async fetch(req,e,ctx){
  if(req.method!=="POST")return out({ok:true});
  let u;try{u=await req.clone().json()}catch{return out({ok:true})}
  return route(req,e,ctx,u)
}};