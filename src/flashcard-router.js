import app from "./final-book-gate.js";
const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const resp=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
const richBlocks=v=>Array.isArray(v)?v.map(richBlock).filter(Boolean):[];
function richMedia(type,x){if(!x)return null;const a=Array.isArray(x)?x:[x],f=a.at(-1)?.file_id||a[0]?.file_id;if(!f)return null;const map={photo:"photo",video:"video",audio:"audio",voice_note:"voice_note",document:"document",animation:"animation"};const t=map[type];return t?{type:t,media:f}:null}
function richBlock(b){if(!b||!b.type)return null;const x={...b};if(b.type==="photo"){const media=richMedia("photo",b.photo);if(!media)return null;x.photo=media}else if(b.type==="video"){const media=richMedia("video",b.video);if(!media)return null;x.video=media}else if(b.type==="audio"){const media=richMedia("audio",b.audio);if(!media)return null;x.audio=media}else if(b.type==="voice_note"){const media=richMedia("voice_note",b.voice_note);if(!media)return null;x.voice_note=media}else if(b.type==="document"){const media=richMedia("document",b.document);if(!media)return null;x.document=media}else if(b.type==="animation"){const media=richMedia("animation",b.animation);if(!media)return null;x.animation=media}if(Array.isArray(b.blocks))x.blocks=richBlocks(b.blocks);if(Array.isArray(b.items))x.items=b.items.map(i=>({...i,blocks:richBlocks(i.blocks)}));return x}
const toInputRich=r=>r?.blocks?{blocks:richBlocks(r.blocks),is_rtl:r.is_rtl}:null;
const readParts=v=>{try{const x=JSON.parse(v||"[]");return Array.isArray(x)?x.filter(p=>p.text||p.media_file_id||p.rich_message):[]}catch{return[]}};
async function sendRichPage(env,chatId,p,index,total,replyTo,markup){const rich=toInputRich(p.rich_message);if(!rich)return null;rich.blocks=[...(rich.blocks||[]),{type:"paragraph",text:`📖 صفحه ${index} از ${total}`}];const body={chat_id:chatId,rich_message:rich,reply_markup:markup,...(replyTo?{reply_to_message_id:replyTo}:{})};return resp(await tg(env,"sendRichMessage",body))}
const nav=(id,i,n)=>({inline_keyboard:[[{text:i>0?`‹ ${i}/${n}`:`• 1/${n}`,callback_data:i>0?`book:${id}:${i}`:"book_noop"},{text:i<n-1?`${i+2}/${n} ›`:`${n}/${n} •`,callback_data:i<n-1?`book:${id}:${i+2}`:"book_noop"}],[{text:"📖 فهرست پرونده",callback_data:`book_index:${id}`}]]});
async function richCallback(env,q){const d=String(q.data||"");if(!d.startsWith("book:"))return null;const [,idRaw,pageRaw]=d.split(":");const id=Number(idRaw),page=Math.max(Number(pageRaw)||1,1),r=await env.DB.prepare("SELECT id,details2 FROM tracks WHERE id=?").bind(id).first();const ps=readParts(r?.details2);const i=page-1,p=ps[i];if(!p?.rich_message)return null;await tg(env,"answerCallbackQuery",{callback_query_id:q.id});await tg(env,"deleteMessage",{chat_id:q.message.chat.id,message_id:q.message.message_id});return sendRichPage(env,q.message.chat.id,p,i+1,ps.length,q.message.reply_to_message?.message_id||null,nav(id,i,ps.length))}
async function richInputMessage(env,m,s){if(!m?.rich_message||!s?.step||!["ADD_FORM","EDIT_FORM"].includes(s.step))return null;const ps=readParts(s.draft_parts);ps.push({text:" ",rich_message:m.rich_message});await env.DB.prepare("UPDATE sessions SET draft_parts=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(JSON.stringify(ps),m.from.id).run();const kind=s.step==="ADD_FORM"?"add":"edit";const markup={inline_keyboard:[[{text:kind==="add"?"📕 ثبت پرونده":"💾 ذخیره پرونده",callback_data:kind==="add"?"book_add_commit":"book_edit_commit"}],[{text:"🗑 پاک‌کردن بخش‌های دریافت‌شده",callback_data:kind==="add"?"book_add_restart":"book_edit_restart"}],[{text:"❌ لغو",callback_data:kind==="add"?"book_add_cancel":"book_edit_cancel"}],[{text:"🔙 پنل مدیریت",callback_data:"panel"}]]};return resp(await tg(env,"editMessageText",{chat_id:m.chat.id,message_id:Number(s.control_message_id||0),text:`📖 <b>صفحه ${ps.length} دریافت شد.</b>\n\nصفحهٔ بعدی را ارسال کنید یا ثبت/ذخیره را بزنید.`,parse_mode:"HTML",reply_markup:markup}))}
async function richIncoming(env,m){const p=String(m?.text||"").trim().match(/^https?:\/\/t\.me\/(?:c\/)?([A-Za-z0-9_]+)\/([0-9]+)(?:\?.*)?$/);const f=m?.forward_origin?.type==="channel"||m?.forward_origin?.type==="channel_message";const ch=p?.[1]||(f?(m.forward_origin.chat?.username||m.forward_origin.chat?.id):null),pid=p?Number(p[2]):(f?Number(m.forward_origin.message_id):null);if(!ch||pid==null)return null;const r=await env.DB.prepare("SELECT id,details2 FROM tracks WHERE post_id=? ORDER BY id DESC LIMIT 1").bind(pid).first();const ps=readParts(r?.details2);if(!r||!ps.length)return null;const i=0,page=ps[i];if(!page?.rich_message)return null;return sendRichPage(env,m.chat.id,page,1,ps.length,m.message_id,nav(r.id,0,ps.length))}
export default {async fetch(req,env,ctx){
  if(req.method!=="POST")return app.fetch(req,env,ctx);
  let u;try{u=await req.clone().json()}catch{return app.fetch(req,env,ctx)};
  const q=u?.callback_query,m=u?.message;
  if(q&&String(q.data||"")==="flash_mode_book"){
    const f=await import("./flashcard-gate.js");
    return f.default.fetch(req,env,ctx)
  }
  if(q&&(String(q.data||"")==="public_list:0:0"||String(q.data||"").startsWith("flashpub:"))){
    const f=await import("./flashcard-public-list-gate.js");
    return f.handle(env,q)
  }
  if(q&&String(q.data||"").startsWith("fedit:")){
    const f=await import("./flashcard-edit-gate.js");
    return f.handleCallback(env,q)
  }
  if(q&&String(q.data||"").startsWith("book:")){const r=await richCallback(env,q);if(r)return r}
  if(m?.from?.id){
    const s=await env.DB.prepare("SELECT * FROM sessions WHERE user_id=?").bind(m.from.id).first();
    if(m?.rich_message){const r=await richInputMessage(env,m,s);if(r)return r}
    if(["FLASH_EDIT_LINK","FC_EDIT_TITLE","FC_EDIT_CARD_NAME","FC_EDIT_CARD_CONTENT","FC_EDIT_ADD_NAME","FC_EDIT_ADD_CONTENT"].includes(s?.step)){
      const f=await import("./flashcard-edit-gate.js");
      return f.handleMessage(env,m)
    }
    if(s?.step&&String(s.step).startsWith("BOOK_")){
      const b=await import("./admin-book-gate-v2.js");
      return b.default.fetch(req,env,ctx)
    }
    if(["ADD_LINK","ADD_FORM","EDIT_LINK","EDIT_FORM","BROADCAST","BROADCAST_CONFIRM"].includes(s?.step)){
      const b=await import("./admin-book-gate-v2.js");
      return b.default.fetch(req,env,ctx)
    }
    const r=await richIncoming(env,m);if(r)return r
  }
  return app.fetch(req,env,ctx)
}};
