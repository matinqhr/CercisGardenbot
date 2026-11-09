import {sendStartMenuMessage} from "./start-menu-store.js";

const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const out=x=>new Response(JSON.stringify(x??{ok:true}),{status:200,headers:{"content-type":"application/json"}});

const aboutText=`🌳 <b>Cercis Garden</b>\n\nکتابخانه و آرشیوی برای دسترسی منظم به اطلاعات پست‌های <a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a>.\n\nمی‌توانی از طریق دسته‌بندی‌ها، فهرست پرونده‌ها و جست‌وجوی Inline به محتوای ثبت‌شده دسترسی پیدا کنی.`;
const guideText=`📚 <b>راهنمای کتابخانه</b>\n\nلینک یا خودِ پستی را که از کانال <a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a> دریافت کرده‌ای برای من ارسال کن.\n\nمن فقط اطلاعات پست‌های ثبت‌شده در آرشیو 𝐇𝐨𝐦𝐞 را ارائه می‌کنم.\n\nلطفاً فقط پست‌های 𝐇𝐨𝐦𝐞 را ارسال کن.`;

async function sendMenu(e,chatId,userId){
  const result=await sendStartMenuMessage(e,chatId,userId);
  if(!result?.ok)console.error("[START_MENU_SEND]",result?.description||result);
  return result;
}

async function sendMenuEdit(e,q){
  const chatId=q?.message?.chat?.id;
  const result=await sendStartMenuMessage(e,chatId,q?.from?.id);
  if(!result?.ok){
    console.error("[START_MENU_RETURN_SEND]",result?.description||result);
    return result;
  }
  const removed=await tg(e,"deleteMessage",{chat_id:chatId,message_id:q?.message?.message_id});
  if(!removed?.ok)console.error("[START_MENU_OLD_SCREEN_DELETE]",removed?.description||removed);
  return result;
}

async function edit(e,q,text,markup){
  const result=await tg(e,"editMessageText",{chat_id:q?.message?.chat?.id,message_id:q?.message?.message_id,text,parse_mode:"HTML",reply_markup:markup});
  if(result?.ok)return result;
  return tg(e,"sendMessage",{chat_id:q?.message?.chat?.id,text,parse_mode:"HTML",reply_markup:markup});
}

export default {async fetch(req,e){
  let u;
  try{u=await req.clone().json()}catch{return out({ok:true})}
  const m=u?.message,q=u?.callback_query;
  const command=String(m?.text||"").trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  if(command==="/start")return out(await sendMenu(e,m?.chat?.id,m?.from?.id));
  if(!q)return out({ok:true});
  const d=String(q.data||"");
  if(d==="about"){
    await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
    return out(await edit(e,q,aboutText,{inline_keyboard:[[{text:"🔙 منوی اصلی",callback_data:"public_start"}]]}));
  }
  if(d==="help"){
    await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
    return out(await edit(e,q,guideText,{inline_keyboard:[[{text:"🔙 منوی اصلی",callback_data:"public_start"}]]}));
  }
  if(d==="public_start"){
    await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
    return out(await sendMenuEdit(e,q));
  }
  return out({ok:true});
}};