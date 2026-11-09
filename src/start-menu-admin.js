import {ensureStartMenuSettings,getStartMenuSettings,buildStartPayload} from "./start-menu-store.js";

const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const out=x=>new Response(JSON.stringify(x??{ok:true}),{status:200,headers:{"content-type":"application/json"}});
const admin=(e,id)=>String(e.ADMIN_ID||"").split(",").map(x=>x.trim()).filter(Boolean).includes(String(id));
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const LABELS={library:"دکمهٔ کتابخانه Home",dossiers:"دکمهٔ فهرست پرونده‌ها",about:"دکمهٔ دربارهٔ ربات",guide:"دکمهٔ راهنما"};
const MAX_BUTTON_CHARS=64;

async function openSettings(e,q){
  const s=await getStartMenuSettings(e);
  const rows=[
    [{text:"✏️ متن پیام شروع",callback_data:"startmenu_edit:text",style:"primary"}],
    [{text:"📚 نام دکمهٔ کتابخانه",callback_data:"startmenu_edit:library"}],
    [{text:"📜 نام دکمهٔ فهرست پرونده‌ها",callback_data:"startmenu_edit:dossiers"}],
    [{text:"ℹ️ نام دکمهٔ دربارهٔ ربات",callback_data:"startmenu_edit:about"}],
    [{text:"📖 نام دکمهٔ راهنما",callback_data:"startmenu_edit:guide"}],
    [{text:"👁 پیش‌نمایش منوی شروع",callback_data:"startmenu_preview",style:"success"}],
    [{text:"♻️ بازنشانی تنظیمات منو",callback_data:"startmenu_reset",style:"danger"}],
    [{text:"🔙 بازگشت به پنل مدیریت",callback_data:"panel"}]
  ];
  const text="🎛 <b>شخصی‌سازی منوی شروع</b>\n\n"+
    "متن و عنوان دکمه‌های پیام /start را از این بخش تغییر بده. برای عنوان دکمه‌ها می‌توانی ایموجی معمولی یا یک Custom Emoji بفرستی.\n\n"+
    "<b>وضعیت فعلی:</b>\n"+
    "📚 "+esc(s.library_text)+"\n"+
    "📜 "+esc(s.dossiers_text)+"\n"+
    "ℹ️ "+esc(s.about_text)+"\n"+
    "📖 "+esc(s.guide_text)+"\n\n"+
    "متن پیام شروع: "+(String(s.start_text||"").trim()?"شخصی‌سازی‌شده":"متن پیش‌فرض");
  const result=await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text,parse_mode:"HTML",reply_markup:{inline_keyboard:rows}});
  if(!result?.ok)console.error("[START_MENU_SETTINGS_RENDER]",result?.description||result);
  return out(result);
}

async function beginEdit(e,q,field){
  if(!["text","library","dossiers","about","guide"].includes(field))return out({ok:true});
  await e.DB.prepare("INSERT INTO bot_start_menu_sessions(user_id,field,created_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET field=excluded.field,created_at=CURRENT_TIMESTAMP").bind(q.from.id,field).run();
  const hint=field==="text"
    ?"متن کامل پیام /start را ارسال کن. قالب‌بندی و ایموجی‌های پرمیومِ موجود در همان پیام، در صورت ارسال Entity از تلگرام، حفظ می‌شوند. برای بازگشت به متن پیش‌فرض /reset بفرست."
    :"عنوان جدید "+LABELS[field]+" را ارسال کن. می‌توانی یک ایموجی معمولی یا Custom Emoji در ابتدای عنوان قرار بدهی. حداکثر ۶۴ نویسه؛ برای بازگشت به عنوان پیش‌فرض /reset بفرست.";
  return out(await tg(e,"sendMessage",{chat_id:q.message.chat.id,text:"✏️ "+hint,reply_markup:{force_reply:true,selective:true}}));
}

function extractButtonLabel(m){
  const raw=String(m?.text??m?.caption??"");
  const entities=[...(Array.isArray(m?.entities)?m.entities:[]),...(Array.isArray(m?.caption_entities)?m.caption_entities:[])];
  const custom=entities.find(x=>x?.type==="custom_emoji"&&x?.custom_emoji_id);
  if(!custom)return {text:raw.trim(),icon:null};
  const start=Math.max(0,Number(custom.offset)||0),end=Math.max(start,start+(Number(custom.length)||0));
  return {text:(raw.slice(0,start)+raw.slice(end)).trim(),icon:String(custom.custom_emoji_id)};
}

export async function handleStartMenuMessage(e,m){
  if(!admin(e,m?.from?.id))return null;
  await ensureStartMenuSettings(e);
  const session=await e.DB.prepare("SELECT field FROM bot_start_menu_sessions WHERE user_id=?").bind(m.from.id).first();
  if(!session?.field)return null;
  const field=String(session.field),raw=String(m.text??m.caption??""),trimmed=raw.trim();
  if(!trimmed)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ پیام متنی خالی است؛ لطفاً متن را بفرست."}));
  if(trimmed==="/reset"){
    if(field==="text")await e.DB.prepare("UPDATE bot_start_menu_settings SET start_text=NULL,start_entities='[]',updated_at=CURRENT_TIMESTAMP WHERE id=1").run();
    else await e.DB.prepare("UPDATE bot_start_menu_settings SET "+field+"_text=?, "+field+"_icon_custom_emoji_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(({library:"📚 کتابخانه Home",dossiers:"📜 فهرست پرونده‌های ثبت‌شده",about:"ℹ️ درباره ربات",guide:"📖 راهنما"})[field]).run();
    await e.DB.prepare("DELETE FROM bot_start_menu_sessions WHERE user_id=?").bind(m.from.id).run();
    return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"♻️ مقدار به حالت پیش‌فرض برگشت.",reply_markup:{inline_keyboard:[[{text:"🎛 بازگشت به تنظیمات منو",callback_data:"startmenu_open"}]]}}));
  }
  if(field==="text"){
    const entities=Array.isArray(m.entities)?m.entities:(Array.isArray(m.caption_entities)?m.caption_entities:[]);
    if(Array.from(trimmed).length>4096)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ متن از محدودیت ۴۰۹۶ نویسه بیشتر است."}));
    await e.DB.prepare("UPDATE bot_start_menu_settings SET start_text=?,start_entities=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(raw,JSON.stringify(entities)).run();
  }else{
    const label=extractButtonLabel(m);
    const chars=Array.from(label.text).length;
    if(!label.text||chars>MAX_BUTTON_CHARS)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ عنوان دکمه باید پس از جداکردن ایموجی اختصاصی، بین ۱ تا ۶۴ نویسه باشد."}));
    await e.DB.prepare("UPDATE bot_start_menu_settings SET "+field+"_text=?,"+field+"_icon_custom_emoji_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(label.text,label.icon).run();
  }
  await e.DB.prepare("DELETE FROM bot_start_menu_sessions WHERE user_id=?").bind(m.from.id).run();
  return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"✅ تغییر ذخیره شد.",reply_markup:{inline_keyboard:[[{text:"👁 پیش‌نمایش منوی شروع",callback_data:"startmenu_preview"}],[{text:"🎛 تنظیمات منوی شروع",callback_data:"startmenu_open"}]]}}));
}

export default {async fetch(req,e){
  let u;try{u=await req.clone().json()}catch{return out({ok:true})}
  const q=u?.callback_query,m=u?.message,id=q?.from?.id||m?.from?.id;
  if(!admin(e,id))return out({ok:true});
  await ensureStartMenuSettings(e);
  if(m)return handleStartMenuMessage(e,m)||out({ok:true});
  if(!q)return out({ok:true});
  const d=String(q.data||"");
  if(q.id)await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
  if(d==="startmenu_open")return openSettings(e,q);
  if(d.startsWith("startmenu_edit:"))return beginEdit(e,q,d.split(":")[1]);
  if(d==="startmenu_preview"){
    const payload=await buildStartPayload(e,id);
    const result=await tg(e,"sendMessage",{chat_id:q.message.chat.id,...payload});
    if(!result?.ok)console.error("[START_MENU_PREVIEW_SEND]",result?.description||result);
    return out(result);
  }
  if(d==="startmenu_reset"){
    await e.DB.prepare("UPDATE bot_start_menu_settings SET start_text=NULL,start_entities='[]',library_text='📚 کتابخانه Home',library_icon_custom_emoji_id=NULL,dossiers_text='📜 فهرست پرونده‌های ثبت‌شده',dossiers_icon_custom_emoji_id=NULL,about_text='ℹ️ درباره ربات',about_icon_custom_emoji_id=NULL,guide_text='📖 راهنما',guide_icon_custom_emoji_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=1").run();
    return openSettings(e,q);
  }
  return out({ok:true});
}};
