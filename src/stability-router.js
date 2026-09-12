const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const out=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
const admin=(e,id)=>String(e.ADMIN_ID||"").split(",").map(x=>x.trim()).filter(Boolean).includes(String(id));
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const edit=(e,q,text,markup)=>out(tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text,parse_mode:"HTML",reply_markup:markup}));
const HOME='<a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a>';
const guide=`📚 <b>راهنمای کتابخانه</b>\n\nلینک یا خودِ پستی را که از کانال ${HOME} دریافت کرده‌اید برای من ارسال کنید.\n\nمن فقط اطلاعات پست‌های ثبت‌شده در آرشیو ${HOME} را ارائه می‌کنم.\n\nلطفاً فقط پست‌های ${HOME} را ارسال کنید.`;
async function ensureCompat(e){
  await e.DB.prepare("CREATE TABLE IF NOT EXISTS users(user_id INTEGER PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await e.DB.prepare("CREATE TABLE IF NOT EXISTS usage_stats(key TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0)").run();
  await e.DB.prepare("CREATE TABLE IF NOT EXISTS sessions(user_id INTEGER PRIMARY KEY,step TEXT NOT NULL,channel TEXT,post_id INTEGER,url TEXT,draft TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await e.DB.prepare("CREATE TABLE IF NOT EXISTS tracks(id INTEGER PRIMARY KEY AUTOINCREMENT,channel TEXT NOT NULL,post_id INTEGER NOT NULL,url TEXT NOT NULL UNIQUE,title TEXT,artist TEXT,release_date TEXT,lyrics TEXT,description TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await e.DB.prepare("CREATE TABLE IF NOT EXISTS pickled_tracks(id INTEGER PRIMARY KEY AUTOINCREMENT,channel TEXT NOT NULL,post_id INTEGER NOT NULL,url TEXT UNIQUE,title TEXT,artist TEXT,release_date TEXT,lyrics TEXT,description TEXT,content_type TEXT,details TEXT,details2 TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await e.DB.prepare("CREATE TABLE IF NOT EXISTS information_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,channel TEXT NOT NULL,post_id INTEGER NOT NULL,request_chat_id TEXT NOT NULL,request_message_id INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,resolved_at TEXT)").run();
  await e.DB.prepare("CREATE TABLE IF NOT EXISTS improvement_ideas(id INTEGER PRIMARY KEY AUTOINCREMENT,text TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await e.DB.prepare("CREATE TABLE IF NOT EXISTS flashcards(id INTEGER PRIMARY KEY AUTOINCREMENT,track_id INTEGER NOT NULL,card_no INTEGER NOT NULL,name TEXT,text TEXT,media_type TEXT,media_file_id TEXT,caption TEXT,caption_entities TEXT,entities TEXT)").run();
  const add=async(table,column,type)=>{try{const x=await e.DB.prepare(`PRAGMA table_info(${table})`).all();if(!(x.results||[]).some(r=>r.name===column))await e.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run()}catch(err){console.error("[CERCIS_COMPAT]",table,column,String(err))}};
  for(const [c,t] of [["control_message_id","INTEGER"],["draft_parts","TEXT"],["draft_title","TEXT"]])await add("sessions",c,t);
  for(const [c,t] of [["content_type","TEXT"],["details","TEXT"],["details2","TEXT"],["media_file_id","TEXT"],["media_caption","TEXT"],["display_mode","TEXT"]])await add("tracks",c,t);
  await add("improvement_ideas","status","TEXT DEFAULT 'backlog'");
}
async function stats(e,q){
  const users=Number((await e.DB.prepare("SELECT COUNT(*) n FROM users").first())?.n||0);
  const tracks=Number((await e.DB.prepare("SELECT COUNT(*) n FROM tracks").first())?.n||0);
  const pickled=Number((await e.DB.prepare("SELECT COUNT(*) n FROM pickled_tracks").first())?.n||0);
  const requests=Number((await e.DB.prepare("SELECT COUNT(*) n FROM information_requests WHERE status='pending'").first())?.n||0);
  const rows=(await e.DB.prepare(`SELECT t.id,t.title,t.url,s.count FROM usage_stats s JOIN tracks t ON t.id=CAST(SUBSTR(s.key,6) AS INTEGER) WHERE s.key LIKE 'post:%' ORDER BY s.count DESC,t.id DESC LIMIT 3`).all()).results||[];
  const md=["🥇","🥈","🥉"];
  const popular=rows.length?rows.map((r,i)=>`${md[i]} <b>${esc(r.title||`پرونده #${r.id}`)}</b> — ${Number(r.count||0)} فعالیت\n🔗 <a href="${esc(r.url)}">مشاهده پست اصلی</a>`).join("\n\n"):"هنوز آماری برای رتبه‌بندی ثبت نشده است.";
  return edit(e,q,`📊 <b>آمار ربات</b>\n\n👥 <b>آمار افراد</b>\nتعداد کاربران ثبت‌شده: <b>${users}</b>\n\n🗂️ تعداد پرونده‌های ثبت‌شده: <b>${tracks}</b>\n🥒 تعداد پرونده‌های در آرشیو ترشی: <b>${pickled}</b>\n📩 درخواست‌های در انتظار: <b>${requests}</b>\n\n🏆 <b>سه پرونده برتر از نگاه فعالیت کاربران</b>\n\n${popular}`,{inline_keyboard:[[{text:"🔄 به‌روزرسانی آمار",callback_data:"stats_inline"}],[{text:"🔙 پنل مدیریت",callback_data:"panel"}]]})
}
export default{async fetch(req,e){try{await ensureCompat(e)}catch(err){console.error("[CERCIS_COMPAT_FATAL]",String(err))}let u;try{u=await req.clone().json()}catch{return import("./publish-router.js").then(m=>m.default.fetch(req,e))}const q=u.callback_query;if(q){const d=String(q.data||"");if(d==="help"){await tg(e,"answerCallbackQuery",{callback_query_id:q.id});return edit(e,q,guide,{inline_keyboard:[[{text:"🔙 منوی اصلی",callback_data:"public_start"}]]})}if((d==="stats"||d==="stats_inline")&&admin(e,q.from?.id)){await tg(e,"answerCallbackQuery",{callback_query_id:q.id});return stats(e,q)}if(d==="pickled_add"&&admin(e,q.from?.id)){await tg(e,"answerCallbackQuery",{callback_query_id:q.id});return import("./pickle-master.js").then(m=>m.default.fetch(req,e))}}return import("./publish-router.js").then(m=>m.default.fetch(req,e))}};