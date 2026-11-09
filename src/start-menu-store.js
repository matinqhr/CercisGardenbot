const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();

const DEFAULTS={
  library_text:"📚 کتابخانه Home",
  dossiers_text:"📜 فهرست پرونده‌های ثبت‌شده",
  about_text:"ℹ️ درباره ربات",
  guide_text:"📖 راهنما"
};

export async function ensureStartMenuSettings(e){
  await e.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_start_menu_settings(
    id INTEGER PRIMARY KEY CHECK(id=1),
    start_text TEXT,
    start_entities TEXT NOT NULL DEFAULT '[]',
    library_text TEXT NOT NULL DEFAULT '📚 کتابخانه Home',
    library_icon_custom_emoji_id TEXT,
    dossiers_text TEXT NOT NULL DEFAULT '📜 فهرست پرونده‌های ثبت‌شده',
    dossiers_icon_custom_emoji_id TEXT,
    about_text TEXT NOT NULL DEFAULT 'ℹ️ درباره ربات',
    about_icon_custom_emoji_id TEXT,
    guide_text TEXT NOT NULL DEFAULT '📖 راهنما',
    guide_icon_custom_emoji_id TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await e.DB.prepare("INSERT OR IGNORE INTO bot_start_menu_settings(id) VALUES(1)").run();
  await e.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_start_menu_sessions(
    user_id INTEGER PRIMARY KEY,
    field TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function getStartMenuSettings(e){
  await ensureStartMenuSettings(e);
  return await e.DB.prepare("SELECT * FROM bot_start_menu_settings WHERE id=1").first();
}

export async function getLibraryEnabled(e){
  try{
    const row=await e.DB.prepare("SELECT library_enabled FROM classification_settings WHERE id=1").first();
    return Number(row?.library_enabled)===1;
  }catch{return false;}
}

export function defaultStartText(){
  return "🌳 <b>Cercis Garden</b>\\n\\nکتابخانه‌ای از اطلاعات پست‌های <a href=\"https://t.me/Arghavanplaylistt\">𝐇𝐨𝐦𝐞</a>.\\n\\nلینک یا خودِ پستی را که از 𝐇𝐨𝐦𝐞 دریافت کرده‌اید برای من ارسال کنید.";
}

export function buildStartKeyboard(settings,libraryEnabled){
  const button=(field,callback,extra={})=>{
    const label=String(settings?.[field+"_text"]||DEFAULTS[field+"_text"]||"").trim();
    const icon=settings?.[field+"_icon_custom_emoji_id"];
    return {text:label,...(icon?{icon_custom_emoji_id:String(icon)}:{}),...extra};
  };
  const rows=[];
  if(libraryEnabled)rows.push([button("library","", {callback_data:"library_home",style:"primary"})]);
  rows.push([button("dossiers","",{callback_data:"public_list",style:"success"})]);
  rows.push([
    button("about","",{url:"https://telegra.ph/Cercis-08-27"}),
    button("guide","",{callback_data:"help"})
  ]);
  return {inline_keyboard:rows};
}

export async function buildStartPayload(e,userId){
  const settings=await getStartMenuSettings(e);
  const libraryEnabled=await getLibraryEnabled(e);
  const raw=String(settings?.start_text||"").trim();
  const payload={
    text:raw||defaultStartText(),
    reply_markup:buildStartKeyboard(settings,libraryEnabled),
    message_effect_id:"5159385139981059251"
  };
  if(raw){
    let entities=[];
    try{entities=JSON.parse(String(settings?.start_entities||"[]"))}catch{}
    if(Array.isArray(entities)&&entities.length)payload.entities=entities;
  }else payload.parse_mode="HTML";
  return payload;
}
