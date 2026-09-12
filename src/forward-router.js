const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const admin=(e,id)=>String(e.ADMIN_ID||"").split(",").map(x=>x.trim()).filter(Boolean).includes(String(id));
const link=t=>{const m=String(t||"").trim().match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:c\/)?([A-Za-z0-9_]+)\/([0-9]+)\/?(?:\?.*)?$/);return m?{channel:m[1],post_id:Number(m[2])}:null};
function forwardedLink(m){
  const o=m?.forward_origin;
  if(o?.type==="channel"&&o.message_id!=null){
    const c=o.chat?.username||o.chat?.id;
    if(c!=null){const s=String(c).replace(/^@/,"");const channel=/^-100\d+$/.test(s)?`c/${s.slice(4)}`:s;return `https://t.me/${channel}/${Number(o.message_id)}`;}
  }
  if(m?.forward_from_chat&&m?.forward_from_message_id!=null){
    const c=m.forward_from_chat.username||m.forward_from_chat.id;
    if(c!=null){const s=String(c).replace(/^@/,"");const channel=/^-100\d+$/.test(s)?`c/${s.slice(4)}`:s;return `https://t.me/${channel}/${Number(m.forward_from_message_id)}`;}
  }
  return null;
}
async function hasActiveAdminSession(e,id){
  if(!admin(e,id))return false;
  try{const s=await e.DB.prepare("SELECT step,updated_at FROM sessions WHERE user_id=?").bind(id).first();if(!s?.step)return false;if(!s.updated_at)return true;const t=Date.parse(String(s.updated_at).replace(" ","T")+"Z");return !Number.isNaN(t)&&Date.now()-t<30*60*1000}catch{return false}
}
async function route(req,e,ctx,u){
  const m=u?.message;
  if(!m)return import("./stability-router.js").then(x=>x.default.fetch(req,e,ctx));
  const direct=link(m.text||m.caption||"");
  const forwarded=forwardedLink(m);
  const synthetic=forwarded?{...u,message:{...m,text:forwarded,entities:[]}}:null;
  const patched=synthetic?new Request(req.url,{method:"POST",headers:req.headers,body:JSON.stringify(synthetic)}):req;
  const active=await hasActiveAdminSession(e,m.from?.id);
  if((direct||forwarded)&&!active){
    return import("./final-book-gate.js").then(x=>x.default.fetch(patched,e,ctx));
  }
  return import("./stability-router.js").then(x=>x.default.fetch(patched,e,ctx));
}
export default{async fetch(req,e,ctx){
  if(req.method!=="POST")return import("./stability-router.js").then(m=>m.default.fetch(req,e,ctx));
  let u;try{u=await req.clone().json()}catch{return import("./stability-router.js").then(m=>m.default.fetch(req,e,ctx))}
  return route(req,e,ctx,u);
}};