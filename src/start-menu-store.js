const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();

const DEFAULTS={
  library_text:"📚 کتابخانه Home",
  dossiers_text:"📜 فهرست پرونده‌های ثبت‌شده",
  about_text:"ℹ️ درباره ربات",
  guide_text:"📖 راهنما"
};

let startMenuSchemaPromise=null;
export async function ensureStartMenuSettings(e){
  if(!startMenuSchemaPromise){
    startMenuSchemaPromise=(async()=>{
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
    })().catch(err=>{startMenuSchemaPromise=null;throw err;});
  }
  await startMenuSchemaPromise;
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
  return `🌿 <b>به سرسیس خوش آمدید.</b>

<b>CERCIS GARDEN — ARCHIVE SYSTEM</b>

<blockquote>هر پست، نشانی از چیزی‌ست که نباید در میان انبوه محتوا گم شود.</blockquote>

سرسیس فضایی برای نگهداری، پردازش و بازیابی محتوای آرشیوشده از <a href='https://t.me/Arghavanplaylistt'>Home</a> است؛ مجموعه‌ای از موسیقی‌ها، نوشته‌ها، تصاویر، ویدیوها و یادداشت‌ها که هرکدام می‌توانند بیش از یک نشانی ساده باشند.

📁 <b>پرونده‌های ثبت‌شده</b>
اینجا جایی‌ست که به‌صورت تخصصی و مفصل روی پست‌ها کار می‌کنیم؛ اطلاعات هر پست را ثبت و تکمیل می‌کنیم، جزئیات مربوط به آن را کنار هم می‌گذاریم و برای هرکدام پرونده‌ای مستقل می‌سازیم. هر پرونده تلاشی‌ست برای اینکه چیزی فراتر از خودِ پست باقی بماند.

🌱 <b>کتابخانه</b>
کتابخانه جایی‌ست برای پرسه‌زدن میان محتواهای ثبت‌شده؛ مجموعه‌ای طبقه‌بندی‌شده از دسته‌ها و موضوعات که کمک می‌کند مسیرهای مختلف آرشیو را کشف کنید، میان پست‌ها بگردید و با جست‌وجوی درون‌خطی، آنچه را به دنبالش هستید دوباره پیدا کنید.

🪴 <b>و البته ایستراگ‌ها...</b>
همه‌چیز در سرسیس قرار نیست از همان ابتدا آشکار باشد. گوشه‌وکنار این باغ، نشانه‌ها و غافلگیری‌هایی پنهان شده‌اند؛ بعضی خوشایند و بعضی نه‌چندان خوشایند. بخشی از تجربهٔ کشف سرسیس همین چیزهایی‌ست که شاید اتفاقی به آن‌ها برخورد کنید.

<b>SILIQUASTRUM INDUSTRIES</b>
<i>An archive of things worth finding again.</i>`;
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
    button("about","",{callback_data:"about"}),
    button("guide","",{callback_data:"help"})
  ]);
  return {inline_keyboard:rows};
}

export async function buildStartPayload(e,userId){
  const settings=await getStartMenuSettings(e);
  const libraryEnabled=await getLibraryEnabled(e);
  const raw=String(settings?.start_text??"");
  const payload={
    text:raw.trim()?raw:defaultStartText(),
    reply_markup:buildStartKeyboard(settings,libraryEnabled),
    message_effect_id:"5159385139981059251"
  };
  if(raw.trim()){
    let entities=[];
    try{entities=JSON.parse(String(settings?.start_entities||"[]"))}catch{}
    if(Array.isArray(entities)&&entities.length)payload.entities=entities;
  }else payload.parse_mode="HTML";
  return payload;
}
