const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
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
export default{async fetch(req,e,ctx){
  if(req.method!=="POST")return import("./stability-router.js").then(m=>m.default.fetch(req,e,ctx));
  let u;try{u=await req.clone().json()}catch{return import("./stability-router.js").then(m=>m.default.fetch(req,e,ctx))}
  const m=u?.message,link=forwardedLink(m);
  if(link){
    const patched={...u,message:{...m,text:link,entities:[]}};
    const r=new Request(req.url,{method:"POST",headers:req.headers,body:JSON.stringify(patched)});
    return import("./stability-router.js").then(x=>x.default.fetch(r,e,ctx));
  }
  return import("./stability-router.js").then(x=>x.default.fetch(req,e,ctx));
}};