const HOME_CHANNEL="Arghavanplaylistt";
const isHomeChannel=c=>String(c||"").replace(/^@/,"").trim().toLowerCase()===HOME_CHANNEL.toLowerCase();
const parseLink=t=>{const m=String(t||"").trim().match(/^https?:\/\/t\.me\/(?:c\/)?([A-Za-z0-9_]+)\/([0-9]+)(?:\?.*)?$/);return m?{channel:m[1],post_id:Number(m[2])}:null};
const HOME='<a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a>';
const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const warning=async(e,c,r)=>{await tg(e,"sendMessage",{chat_id:c,text:`⚠️ <b>هشدار.</b>\nمن اگر جای تو بودم، هیچ‌وقت پستی به‌جز پست‌های ${HOME} را برای خودم (سرسیس) ارسال نمی‌کردم.\n🔗 دفعهٔ بعد، قبل از ارسال مطمئن شو پست از ${HOME} آمده باشد.`,parse_mode:"HTML",...(r?{reply_to_message_id:r}:{})});return new Response("ok",{status:200})};
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
  if(m){
    const p=parseLink(m.text||"");
    const f=m.forward_origin?.type==="channel"||m.forward_origin?.type==="channel_message";
    const ch=p?.channel||(f?(m.forward_origin.chat?.username||m.forward_origin.chat?.id):null);
    if(ch&&!isHomeChannel(ch))return warning(e,m.chat?.id,m.message_id)
  }
  const mod=await import("./index.js");
  return mod.default.fetch(new Request(req.url,{method:req.method,headers:req.headers,body:JSON.stringify(update)}),e)
}};
