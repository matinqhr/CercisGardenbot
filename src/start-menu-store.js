const tg=async(e,m,b={})=>(await fetch("https://api.telegram.org/bot"+e.BOT_TOKEN+"/"+m,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();

const DEFAULTS={
  library_text:"📚 کتابخانه 𝐇𝐨𝐦𝐞",
  dossiers_text:"📜 فهرست پرونده‌های ثبت‌شده",
  about_text:"ℹ️ درباره ربات",
  guide_text:"📖 راهنما"
};
const BUTTON_STYLES={library:"primary",dossiers:"success",about:"default",guide:"default"};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
let startMenuSchemaPromise=null;
export async function ensureStartMenuSettings(e){
  if(!startMenuSchemaPromise){
    startMenuSchemaPromise=(async()=>{
      await e.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_start_menu_settings(
        id INTEGER PRIMARY KEY CHECK(id=1),
        start_text TEXT,
        start_entities TEXT NOT NULL DEFAULT '[]',
        start_source_chat_id INTEGER,
        start_source_message_id INTEGER,
        library_text TEXT NOT NULL DEFAULT '📚 کتابخانه 𝐇𝐨𝐦𝐞',
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
      const columnsResult=await e.DB.prepare("PRAGMA table_info(bot_start_menu_settings)").all();
      const columns=new Set((columnsResult.results||[]).map(column=>column.name));
      if(!columns.has("start_source_chat_id"))await e.DB.prepare("ALTER TABLE bot_start_menu_settings ADD COLUMN start_source_chat_id INTEGER").run();
      if(!columns.has("start_source_message_id"))await e.DB.prepare("ALTER TABLE bot_start_menu_settings ADD COLUMN start_source_message_id INTEGER").run();
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
  return `<h1>🌿 به سرسیس خوش آمدید.</h1>
<p><b>CERCIS GARDEN — ARCHIVE SYSTEM</b></p>
<blockquote>هر پست، نشانی از چیزی‌ست که نباید در میان انبوه محتوا گم شود.</blockquote>
<p>سرسیس فضایی برای نگهداری، پردازش و بازیابی محتوای آرشیوشده از <a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a> است؛ مجموعه‌ای از موسیقی‌ها، نوشته‌ها، تصاویر، ویدیوها و یادداشت‌ها که هرکدام می‌توانند بیش از یک نشانی ساده باشند.</p>
<h2>📁 <mark>پرونده‌های ثبت‌شده</mark></h2>
<p>اینجا جایی‌ست که به‌صورت تخصصی و مفصل روی پست‌ها کار می‌کنیم؛ اطلاعات هر پست را ثبت و تکمیل می‌کنیم، جزئیات مربوط به آن را کنار هم می‌گذاریم و برای هرکدام پرونده‌ای مستقل می‌سازیم. هر پرونده تلاشی‌ست برای اینکه چیزی فراتر از خودِ پست باقی بماند.</p>
<h2>🌱 <mark>کتابخانه</mark></h2>
<p>کتابخانه جایی‌ست برای پرسه‌زدن میان محتواهای ثبت‌شده؛ مجموعه‌ای طبقه‌بندی‌شده از دسته‌ها و موضوعات که کمک می‌کند مسیرهای مختلف آرشیو را کشف کنید، میان پست‌ها بگردید و با جست‌وجوی درون‌خطی، آنچه را به دنبالش هستید دوباره پیدا کنید.</p>
<h2>🪴 و البته ایستراگ‌ها...</h2>
<p>همه‌چیز در سرسیس قرار نیست از همان ابتدا آشکار باشد. گوشه‌وکنار این باغ، نشانه‌ها و غافلگیری‌هایی پنهان شده‌اند؛ بعضی خوشایند و بعضی نه‌چندان خوشایند. بخشی از تجربهٔ کشف سرسیس همین چیزهایی‌ست که شاید اتفاقی به آن‌ها برخورد کنید.</p>
<hr/>
<p><b>SILIQUASTRUM INDUSTRIES</b><br/><i>An archive of things worth finding again.</i></p>`;
}

function startButton(settings,field,callback,libraryEnabled){
  if(field==="library"&&!libraryEnabled)return null;
  const label=String(settings?.[field+"_text"]||DEFAULTS[field+"_text"]).trim().replace(/\bHome\b/g,"𝐇𝐨𝐦𝐞");
  const icon=settings?.[field+"_icon_custom_emoji_id"];
  const style=BUTTON_STYLES[field];
  return {
    text:label,
    ...(icon?{icon_custom_emoji_id:String(icon)}:{}),
    ...(style&&style!=="default"?{style}:{}),
    callback_data:callback
  };
}

export function buildStartKeyboard(settings,libraryEnabled){
  const rows=[];
  const library=startButton(settings,"library","library_home",libraryEnabled);
  if(library)rows.push([library]);
  rows.push([startButton(settings,"dossiers","public_list",libraryEnabled)]);
  rows.push([
    startButton(settings,"about","about",libraryEnabled),
    startButton(settings,"guide","help",libraryEnabled)
  ]);
  return {inline_keyboard:rows.map(row=>row.filter(Boolean))};
}

function normalizeRichInput(raw){
  const value=String(raw||"").trim();
  return {html:value||defaultStartText(),is_rtl:true};
}

export async function buildStartPayload(e,userId){
  const settings=await getStartMenuSettings(e);
  const libraryEnabled=await getLibraryEnabled(e);
  const reply_markup=buildStartKeyboard(settings,libraryEnabled);
  const message_effect_id="5159385139981059251";
  const from_chat_id=Number(settings?.start_source_chat_id);
  const message_id=Number(settings?.start_source_message_id);
  if(Number.isSafeInteger(from_chat_id)&&from_chat_id!==0&&Number.isSafeInteger(message_id)&&message_id>0){
    return {source:{from_chat_id,message_id},reply_markup,message_effect_id};
  }
  return {rich_message:normalizeRichInput(settings?.start_text),reply_markup,message_effect_id};
}

export async function sendStartMenuMessage(e,chatId,userId){
  const payload=await buildStartPayload(e,userId);
  if(payload.source){
    return tg(e,"copyMessage",{
      chat_id:chatId,
      ...payload.source,
      reply_markup:payload.reply_markup,
      message_effect_id:payload.message_effect_id
    });
  }
  return tg(e,"sendRichMessage",{
    chat_id:chatId,
    rich_message:payload.rich_message,
    reply_markup:payload.reply_markup,
    message_effect_id:payload.message_effect_id
  });
}
