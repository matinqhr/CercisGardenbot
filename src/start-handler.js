import {buildStartPayload,getStartMenuSettings,getLibraryEnabled,defaultStartText,buildStartKeyboard} from "./start-menu-store.js";

const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const out=x=>new Response(JSON.stringify(x??{ok:true}),{status:200,headers:{"content-type":"application/json"}});
const GUIDE="https://telegra.ph/Cercis-08-27";
const guideText=`📚 <b>راهنمای کتابخانه</b>\\n\\nلینک یا خودِ پستی را که از کانال <a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a> دریافت کرده‌اید برای من ارسال کنید.\\n\\nمن فقط اطلاعات پست‌های ثبت‌شده در آرشیو 𝐇𝐨𝐦𝐞 را ارائه می‌کنم.\\n\\nلطفاً فقط پست‌های 𝐇𝐨𝐦𝐞 را ارسال کنید.`;

async function sendMenu(e,chatId,userId){
  const payload=await buildStartPayload(e,userId);
  let result=await tg(e,"sendMessage",{chat_id:chatId,...payload});
  if(result?.ok)return result;
  console.error("[START_MENU_SEND_PRIMARY]",result?.description||result);
  if(payload.message_effect_id){
    const retry={...payload};delete retry.message_effect_id;
    result=await tg(e,"sendMessage",{chat_id:chatId,...retry});
    if(result?.ok)return result;
  }
  const fallback={...payload};
  delete fallback.message_effect_id;
  if(fallback.reply_markup?.inline_keyboard){
    fallback.reply_markup={inline_keyboard:fallback.reply_markup.inline_keyboard.map(row=>row.map(({icon_custom_emoji_id,...button})=>button))};
  }
  return tg(e,"sendMessage",{chat_id:chatId,...fallback});
}

const edit=async(e,q,text,markup)=>{const r=await tg(e,"editMessageText",{chat_id:q?.message?.chat?.id,message_id:q?.message?.message_id,text,parse_mode:"HTML",reply_markup:markup});if(r?.ok)return r;return tg(e,"sendMessage",{chat_id:q?.message?.chat?.id,text,parse_mode:"HTML",reply_markup:markup})};

export default{async fetch(req,e){
  let u;try{u=await req.clone().json()}catch{return out({ok:true})}
  const m=u?.message,q=u?.callback_query;
  const command=String(m?.text||"").trim().split(/\\s+/)[0].split("@")[0].toLowerCase();
  if(command==="/start")return out(await sendMenu(e,m?.chat?.id,m?.from?.id));
  if(q){
    const d=String(q.data||"");
    if(d==="help"){
      await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
      return out(await edit(e,q,guideText,{inline_keyboard:[[{text:"🔙 منوی اصلی",callback_data:"public_start"}]]}));
    }
    if(d==="public_start"){
      await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
      return out(await sendMenuEdit(e,q));
    }
  }
  return out({ok:true});
}};

async function sendMenuEdit(e,q){
  const payload=await buildStartPayload(e,q?.from?.id);
  const b={chat_id:q?.message?.chat?.id,message_id:q?.message?.message_id,...payload};
  let result=await tg(e,"editMessageText",b);
  if(result?.ok)return result;
  if(payload.message_effect_id){const retry={...b};delete retry.message_effect_id;result=await tg(e,"editMessageText",retry);if(result?.ok)return result;}
  const fallback={...b};delete fallback.message_effect_id;if(fallback.reply_markup?.inline_keyboard)fallback.reply_markup={inline_keyboard:fallback.reply_markup.inline_keyboard.map(row=>row.map(({icon_custom_emoji_id,...button})=>button))};
  result=await tg(e,"editMessageText",fallback);
  if(result?.ok)return result;
  return tg(e,"sendMessage",{chat_id:q?.message?.chat?.id,...payload});
}