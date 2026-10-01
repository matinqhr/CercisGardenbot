const tg=async(e,m,b={})=>(await fetch("https://api.telegram.org/bot"+e.BOT_TOKEN+"/"+m,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const out=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const admin=(e,id)=>String(e.ADMIN_ID||"").split(",").map(x=>x.trim()).filter(Boolean).includes(String(id));
const HOME="Arghavanplaylistt";
const ensure=async e=>{
 await e.DB.prepare("CREATE TABLE IF NOT EXISTS home_archive_posts(message_id INTEGER PRIMARY KEY,channel TEXT NOT NULL DEFAULT 'Arghavanplaylistt',url TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',future_dossier INTEGER NOT NULL DEFAULT 0,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
 await e.DB.prepare("CREATE TABLE IF NOT EXISTS classification_categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,parent_id INTEGER,emoji TEXT,emoji_id TEXT,sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1)").run();
 await e.DB.prepare("CREATE TABLE IF NOT EXISTS home_post_classification(post_id INTEGER NOT NULL,level INTEGER NOT NULL,category_id INTEGER NOT NULL,PRIMARY KEY(post_id,level),UNIQUE(post_id,category_id))").run();
 await e.DB.prepare("CREATE TABLE IF NOT EXISTS home_post_keywords(post_id INTEGER NOT NULL,keyword TEXT NOT NULL,PRIMARY KEY(post_id,keyword))").run();
 await e.DB.prepare("CREATE TABLE IF NOT EXISTS classification_settings(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 1,library_enabled INTEGER NOT NULL DEFAULT 0,next_message_id INTEGER NOT NULL DEFAULT 1,last_message_id INTEGER NOT NULL DEFAULT 0)").run();
 try{await e.DB.prepare("ALTER TABLE classification_settings ADD COLUMN library_enabled INTEGER NOT NULL DEFAULT 0").run()}catch{}
 await e.DB.prepare("INSERT OR IGNORE INTO classification_settings(id) VALUES(1)").run();
 const n=await e.DB.prepare("SELECT COUNT(*) n FROM classification_categories").first();
 if(!Number(n?.n)){for(const [name,emoji,sort] of [["🎵 موسیقی","🎵",1],["📖 نقل‌قول","📖",2],["🖼 تصویر","🖼",3],["🎬 ویدیو","🎬",4],["💭 نوشته","💭",5],["🌅 Daily","🌅",6]])await e.DB.prepare("INSERT OR IGNORE INTO classification_categories(name,emoji,sort_order) VALUES(?,?,?)").bind(name,emoji,sort).run();}
};
const setting=async e=>e.DB.prepare("SELECT * FROM classification_settings WHERE id=1").first();
const children=async(e,parent)=>{let r;if(parent==null)r=await e.DB.prepare("SELECT * FROM classification_categories WHERE active=1 AND parent_id IS NULL ORDER BY sort_order,id").all();else r=await e.DB.prepare("SELECT * FROM classification_categories WHERE active=1 AND parent_id=? ORDER BY sort_order,id").bind(parent).all();return r.results||[]};
const pathRows=async(e,id)=>((await e.DB.prepare("SELECT pc.level,pc.category_id,c.name,c.parent_id FROM home_post_classification pc JOIN classification_categories c ON c.id=pc.category_id WHERE pc.post_id=? ORDER BY pc.level").bind(id).all()).results||[]);
const render=async(e,q)=>{
 await ensure(e);const s=await setting(e),id=Number(s.next_message_id||1),r=await e.DB.prepare("SELECT * FROM home_archive_posts WHERE message_id=?").bind(id).first(),p=await pathRows(e,id);
 const status=r?.status==="deleted"?"🔴 حذف‌شده":r?.status==="classified"?"🟢 طبقه‌بندی‌شده":"🟡 آماده بررسی";
 const path=p.length?p.map(x=>x.name).join(" → "):"هنوز مسیری ثبت نشده است";
 const text="⚙️ <b>موتور پیشرفته طبقه‌بندی</b>\n\n📌 پست #"+id+"\n🔗 <a href=\"https://t.me/"+HOME+"/"+id+"\">مشاهده پست</a>\n\nوضعیت: "+status+"\n\n<b>🗂 مسیر کتابخانه:</b>\n"+esc(path)+"\n\n📝 پیش‌فرض این است که پست وجود دارد؛ فقط اگر واقعاً حذف شده بود، «پست حذف شده» را بزن.";
 const kb=[[{text:"👀 مشاهده پست",url:"https://t.me/"+HOME+"/"+id}],[{text:"🗂 ساخت/ویرایش مسیر",callback_data:"ce_path:"+id},{text:"🌳 مدیریت ساختار",callback_data:"ce_tree"}],[{text:"🔑 کلیدواژه",callback_data:"ce_kw:"+id}],[{text:"❤️ صف پرونده‌های آینده",callback_data:"ce_future:"+id}],[{text:"❌ پست حذف شده",callback_data:"ce_deleted:"+id}],[{text:"◀️ قبلی",callback_data:"ce_prev:"+id},{text:"بعدی ▶️",callback_data:"ce_next:"+id}],[{text:s.enabled?"⏸ خاموش کردن موتور":"▶️ روشن کردن موتور",callback_data:"ce_toggle"}],[{text:s.library_enabled?"🔴 مخفی‌کردن کتابخانه از Start":"🟢 نمایش کتابخانه در Start",callback_data:"ce_library_toggle"}],[{text:"🔙 پنل مدیریت",callback_data:"panel"}]];
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text,parse_mode:"HTML",reply_markup:{inline_keyboard:kb}}));
};
const pathMenu=async(e,q,id,level)=>{
 const rows=await pathRows(e,id),current=rows.find(x=>Number(x.level)===level),parent=level===1?null:Number(rows.find(x=>Number(x.level)===level-1)?.category_id||0)||null,cs=await children(e,parent);
 const buttons=cs.map(x=>[{text:(Number(current?.category_id)===Number(x.id)?"✅ ":"")+x.name,callback_data:"ce_pick:"+id+":"+level+":"+x.id}]);
 if(level>1)buttons.push([{text:"⬅️ سطح قبل",callback_data:"ce_path:"+id+":"+(level-1)}]);
 buttons.push([{text:"➕ طبقه جدید",callback_data:"ce_newcat:"+id+":"+level+":"+(parent||0)}]);
 if(current)buttons.push([{text:"➕ افزودن سطح بعدی",callback_data:"ce_path:"+id+":"+(level+1)}]);
 buttons.push([{text:"✅ پایان طبقه‌بندی",callback_data:"ce_path_done:"+id}],[{text:"🔙 بازگشت",callback_data:"ce_back:"+id}]);
 const shown=rows.length?rows.map(x=>x.name).join(" → "):"هنوز انتخابی نشده";
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:"🗂 <b>مسیر کتابخانهٔ پست #"+id+"</b>\n\nمسیر فعلی: "+esc(shown)+"\n\n<b>سطح "+level+"</b> را انتخاب کن:",parse_mode:"HTML",reply_markup:{inline_keyboard:buttons}}));
};
const newCategoryPrompt=async(e,q,id,level,parent)=>{
 await e.DB.prepare("INSERT INTO sessions(user_id,step,channel,post_id,url,draft,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET step=excluded.step,channel=excluded.channel,post_id=excluded.post_id,url=excluded.url,draft=excluded.draft,updated_at=CURRENT_TIMESTAMP").bind(q.from.id,"CLASSIFY_NEWCAT",HOME,id,"https://t.me/"+HOME+"/"+id,JSON.stringify({level,parent:Number(parent)||null})).run();
 return out(await tg(e,"sendMessage",{chat_id:q.message.chat.id,text:"➕ نام طبقهٔ جدید برای سطح "+level+" را بفرست."}));
};
const keywordPrompt=async(e,q,id)=>{
 await e.DB.prepare("INSERT INTO sessions(user_id,step,channel,post_id,url,draft,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET step=excluded.step,channel=excluded.channel,post_id=excluded.post_id,url=excluded.url,draft=excluded.draft,updated_at=CURRENT_TIMESTAMP").bind(q.from.id,"CLASSIFY_KEYWORDS",HOME,id,"https://t.me/"+HOME+"/"+id,null).run();
 return out(await tg(e,"sendMessage",{chat_id:q.message.chat.id,text:"🔑 کلیدواژه‌ها را در یک پیام بنویس. با ویرگول یا خط جدید جدا کن."}));
};
const treeRoot=async(e,q)=>{
 const cs=await e.DB.prepare("SELECT * FROM classification_categories WHERE parent_id IS NULL ORDER BY sort_order,id").all();
 const rows=cs.results||[];
 const buttons=rows.map(c=>[{text:(c.active?"🟢 ":"🔴 ")+c.name,callback_data:"ce_tree_cat:"+c.id}]);
 buttons.push([{text:"➕ طبقه اصلی جدید",callback_data:"ce_tree_new:0"}],[{text:"🔙 موتور طبقه‌بندی",callback_data:"classification_engine"}]);
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:"🌳 <b>مدیریت ساختار کتابخانه</b>\n\nطبقه‌های اصلی کتابخانه را می‌بینی. برای مدیریت هر شاخه وارد آن شو:",parse_mode:"HTML",reply_markup:{inline_keyboard:buttons}}));
};
const treeCat=async(e,q,cid)=>{
 const c=await e.DB.prepare("SELECT * FROM classification_categories WHERE id=?").bind(cid).first();if(!c)return treeRoot(e,q);
 const sub=(await e.DB.prepare("SELECT * FROM classification_categories WHERE parent_id=? ORDER BY sort_order,id").bind(cid).all()).results||[];
 const buttons=sub.map(x=>[{text:(x.active?"🟢 ":"🔴 ")+x.name,callback_data:"ce_tree_cat:"+x.id}]);
 buttons.push([{text:"➕ زیرطبقه جدید",callback_data:"ce_tree_new:"+cid}],[{text:"✏️ تغییر نام",callback_data:"ce_tree_rename:"+cid}],[{text:"↕️ تغییر ترتیب",callback_data:"ce_tree_order:"+cid}],[{text:c.active?"🔴 غیرفعال کردن":"🟢 فعال کردن",callback_data:"ce_tree_active:"+cid}]);
 if(c.parent_id!=null)buttons.push([{text:"⬆️ بازگشت به والد",callback_data:"ce_tree_cat:"+c.parent_id}]);else buttons.push([{text:"⬅️ فهرست طبقات اصلی",callback_data:"ce_tree"}]);
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:"🌳 <b>ساختار کتابخانه</b>\n\nمسیر: <b>"+esc(c.name)+"</b>\nوضعیت: "+(c.active?"🟢 فعال":"🔴 غیرفعال")+"\n\nزیرطبقه‌ها: "+(sub.length||"ندارد"),parse_mode:"HTML",reply_markup:{inline_keyboard:buttons}}));
};
const treePrompt=async(e,q,step,cid,draft={})=>{
 await e.DB.prepare("INSERT INTO sessions(user_id,step,channel,post_id,url,draft,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET step=excluded.step,channel=excluded.channel,post_id=excluded.post_id,url=excluded.url,draft=excluded.draft,updated_at=CURRENT_TIMESTAMP").bind(q.from.id,step,HOME,cid||0,"https://t.me/"+HOME+"/"+(cid||0),JSON.stringify(draft)).run();
 const text=step==="CLASSIFY_TREE_RENAME"?"✏️ نام جدید این طبقه را بفرست.":step==="CLASSIFY_TREE_ORDER"?"↕️ شمارهٔ جابه‌جایی را بفرست؛ مثلاً «1» برای یک خانه پایین‌تر و «-1» برای یک خانه بالاتر.":"➕ نام طبقهٔ جدید را بفرست.";
 return out(await tg(e,"sendMessage",{chat_id:q.message.chat.id,text}));
};
const treeOrder=async(e,q,cid)=>{
 const c=await e.DB.prepare("SELECT * FROM classification_categories WHERE id=?").bind(cid).first();if(!c)return treeRoot(e,q);
 const sib=(await e.DB.prepare("SELECT id,name,sort_order FROM classification_categories WHERE parent_id IS ? ORDER BY sort_order,id").bind(c.parent_id).all()).results||[];
 const buttons=sib.map(x=>[{text:(Number(x.id)===Number(cid)?"➡️ ":"")+x.name,callback_data:"ce_tree_orderpick:"+cid+":"+x.id}]);
 buttons.push([{text:"🔙 بازگشت",callback_data:"ce_tree_cat:"+cid}]);
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:"↕️ <b>ترتیب زیرشاخه‌ها</b>\n\nیک طبقه را انتخاب کن؛ بعد آن را یک خانه بالا یا پایین می‌بریم.",parse_mode:"HTML",reply_markup:{inline_keyboard:buttons}}));
};
const publicTree=async(e,q,parent)=>{
 const cs=await children(e,parent),buttons=cs.map(c=>[{text:c.name,callback_data:"home_cat:"+c.id}]);
 buttons.push([{text:"🔙 منوی اصلی",callback_data:"public_start"}]);
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:"🗂 <b>کتابخانه Home</b>\n\nیک شاخه را انتخاب کن:",parse_mode:"HTML",reply_markup:{inline_keyboard:buttons}}));
};
const publicCategory=async(e,q,cid)=>{
 const c=await e.DB.prepare("SELECT * FROM classification_categories WHERE id=? AND active=1").bind(cid).first();if(!c)return out({ok:true});
 const sub=await children(e,cid),posts=(await e.DB.prepare("SELECT p.message_id,p.url FROM home_archive_posts p JOIN home_post_classification pc ON pc.post_id=p.message_id WHERE pc.category_id=? AND p.status!='deleted' ORDER BY p.message_id DESC LIMIT 30").bind(cid).all()).results||[];
 const buttons=sub.map(x=>[{text:x.name,callback_data:"home_cat:"+x.id}]);buttons.push(...posts.map(x=>[{text:"📌 پست #"+x.message_id,url:x.url}]));
 buttons.push([{text:"🔙 بازگشت",callback_data:c.parent_id==null?"home_categories":"home_cat:"+c.parent_id}]);
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:"🗂 <b>"+esc(c.name)+"</b>\n\n"+(sub.length?"شاخه‌ها و پست‌های این بخش:":"پست‌های این بخش:"),parse_mode:"HTML",reply_markup:{inline_keyboard:buttons}}));
};
export default{async fetch(req,e){
 let u;try{u=await req.clone().json()}catch{return out({ok:true})}
 const q=u.callback_query,m=u.message,id=q?.from?.id||m?.from?.id,d=String(q?.data||"");await ensure(e);
 if(q&&!admin(e,id)&&(d==="home_categories"||d.startsWith("home_cat:"))){const s=await setting(e);if(!Number(s.library_enabled))return out(await tg(e,"answerCallbackQuery",{callback_query_id:q.id,text:"کتابخانه فعلاً فعال نیست."}));await tg(e,"answerCallbackQuery",{callback_query_id:q.id});if(d==="home_categories")return publicTree(e,q,null);return publicCategory(e,q,Number(d.split(":")[1]));}
 if(!admin(e,id))return out({ok:true});
 if(m){const s=await e.DB.prepare("SELECT * FROM sessions WHERE user_id=?").bind(id).first();
  if(s?.step==="CLASSIFY_TREE_NEWCAT"){
   const name=String(m.text||"").trim();if(!name)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ نام طبقه را بفرست."}));
   let meta={};try{meta=JSON.parse(String(s.draft||"{}"))}catch{}
   const parent=Number(meta.parent)||null;
   const mx=await e.DB.prepare("SELECT COALESCE(MAX(sort_order),0) n FROM classification_categories WHERE parent_id IS ?").bind(parent).first();
   try{await e.DB.prepare("INSERT INTO classification_categories(name,parent_id,sort_order) VALUES(?,?,?)").bind(name,parent,Number(mx?.n||0)+1).run()}catch{return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ طبقه‌ای با این نام از قبل وجود دارد."}))}
   const c=await e.DB.prepare("SELECT id FROM classification_categories WHERE name=?").bind(name).first();
   await e.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
   return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"✅ طبقهٔ «"+esc(name)+"» ساخته شد.",reply_markup:{inline_keyboard:[[{text:"🌳 باز کردن ساختار",callback_data:"ce_tree_cat:"+c.id}]]}}));
  }
  if(s?.step==="CLASSIFY_TREE_RENAME"){
   const name=String(m.text||"").trim();if(!name)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ نام جدید را بفرست."}));
   let meta={};try{meta=JSON.parse(String(s.draft||"{}"))}catch{};const cid=Number(meta.category_id);
   try{await e.DB.prepare("UPDATE classification_categories SET name=? WHERE id=?").bind(name,cid).run()}catch{return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ طبقه‌ای با این نام از قبل وجود دارد."}))}
   await e.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
   return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"✅ نام طبقه تغییر کرد.",reply_markup:{inline_keyboard:[[{text:"🌳 باز کردن ساختار",callback_data:"ce_tree_cat:"+cid}]]}}));
  }
  if(s?.step==="CLASSIFY_TREE_ORDER"){
   const delta=Number(String(m.text||"").trim());let meta={};try{meta=JSON.parse(String(s.draft||"{}"))}catch{};const cid=Number(meta.category_id);
   if(!Number.isInteger(delta)||Math.abs(delta)>20||delta===0)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ یک عدد صحیح غیرصفر بفرست؛ مثلاً 1 یا -1."}));
   const c=await e.DB.prepare("SELECT * FROM classification_categories WHERE id=?").bind(cid).first();if(!c)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ طبقه پیدا نشد."}));
   const sib=(await e.DB.prepare("SELECT id,sort_order FROM classification_categories WHERE parent_id IS ? ORDER BY sort_order,id").bind(c.parent_id).all()).results||[];
   const idx=sib.findIndex(x=>Number(x.id)===cid),to=Math.max(0,Math.min(sib.length-1,idx+delta));
   const [moved]=sib.splice(idx,1);sib.splice(to,0,moved);
   for(let i=0;i<sib.length;i++)await e.DB.prepare("UPDATE classification_categories SET sort_order=? WHERE id=?").bind(i+1,sib[i].id).run();
   await e.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
   return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"✅ ترتیب اصلاح شد.",reply_markup:{inline_keyboard:[[{text:"🌳 باز کردن ساختار",callback_data:"ce_tree_cat:"+cid}]]}}));
  }
  if(s?.step==="CLASSIFY_NEWCAT"){const name=String(m.text||"").trim();if(!name)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ نام طبقه را بفرست."}));let meta={};try{meta=JSON.parse(String(s.draft||"{}"))}catch{}await e.DB.prepare("INSERT INTO classification_categories(name,parent_id,sort_order) VALUES(?,?,99)").bind(name,Number(meta.parent)||null).run();const c=await e.DB.prepare("SELECT id FROM classification_categories WHERE name=?").bind(name).first();await e.DB.prepare("INSERT OR REPLACE INTO home_post_classification(post_id,level,category_id) VALUES(?,?,?)").bind(Number(s.post_id),Number(meta.level||1),Number(c.id)).run();await e.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"✅ طبقهٔ «"+esc(name)+"» ثبت شد.",reply_markup:{inline_keyboard:[[{text:"🗂 ادامه مسیر",callback_data:"ce_path:"+s.post_id+":"+meta.level}]]}}));}
  if(s?.step==="CLASSIFY_KEYWORDS"){const words=String(m.text||"").split(/[,،\n]/).map(x=>x.trim()).filter(Boolean);await e.DB.prepare("DELETE FROM home_post_keywords WHERE post_id=?").bind(Number(s.post_id)).run();for(const w of [...new Set(words)])await e.DB.prepare("INSERT OR IGNORE INTO home_post_keywords(post_id,keyword) VALUES(?,?)").bind(Number(s.post_id),w).run();await e.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();await e.DB.prepare("INSERT OR REPLACE INTO home_archive_posts(message_id,channel,url,status,updated_at) VALUES(?,?,?,'classified',CURRENT_TIMESTAMP)").bind(Number(s.post_id),HOME,"https://t.me/"+HOME+"/"+s.post_id).run();await e.DB.prepare("UPDATE classification_settings SET last_message_id=?,next_message_id=? WHERE id=1").bind(Number(s.post_id),Number(s.post_id)+1).run();return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"✅ "+words.length+" کلیدواژه ذخیره شد.\n\n📌 پست #"+(Number(s.post_id)+1)+" آمادهٔ بررسی است.",reply_markup:{inline_keyboard:[[{text:"▶️ رفتن به پست بعدی",callback_data:"ce_continue"}],[{text:"⚙️ باز کردن موتور",callback_data:"classification_engine"}]]}}));}
  return out({ok:true});
 }
 await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
 if(d==="classification_engine"||d==="ce_continue")return render(e,q);
 if(d==="ce_tree")return treeRoot(e,q);
 if(d.startsWith("ce_tree_cat:"))return treeCat(e,q,Number(d.split(":")[1]));
 if(d.startsWith("ce_tree_new:"))return treePrompt(e,q,"CLASSIFY_TREE_NEWCAT",Number(d.split(":")[1])||null,{parent:Number(d.split(":")[1])||null});
 if(d.startsWith("ce_tree_rename:"))return treePrompt(e,q,"CLASSIFY_TREE_RENAME",Number(d.split(":")[1]),{category_id:Number(d.split(":")[1])});
 if(d.startsWith("ce_tree_order:"))return treeOrder(e,q,Number(d.split(":")[1]));
 if(d.startsWith("ce_tree_active:")){
  const cid=Number(d.split(":")[1]),c=await e.DB.prepare("SELECT active FROM classification_categories WHERE id=?").bind(cid).first();
  await e.DB.prepare("UPDATE classification_categories SET active=? WHERE id=?").bind(Number(c?.active)?0:1,cid).run();
  return treeCat(e,q,cid);
 }
 if(d.startsWith("ce_tree_orderpick:"))return treePrompt(e,q,"CLASSIFY_TREE_ORDER",Number(d.split(":")[1]),{category_id:Number(d.split(":")[1])});

 if(d==="ce_toggle"){const s=await setting(e);await e.DB.prepare("UPDATE classification_settings SET enabled=? WHERE id=1").bind(s.enabled?0:1).run();return render(e,q);}
 if(d==="ce_library_toggle"){const s=await setting(e);await e.DB.prepare("UPDATE classification_settings SET library_enabled=? WHERE id=1").bind(s.library_enabled?0:1).run();return render(e,q);}
 if(d.startsWith("ce_path:")){const a=d.split(":");return pathMenu(e,q,Number(a[1]),Number(a[2]||1));}
 if(d.startsWith("ce_pick:")){const [,pid,level,cid]=d.split(":").map(Number);const parent=Number(level)>1?await e.DB.prepare("SELECT category_id FROM home_post_classification WHERE post_id=? AND level=?").bind(pid,level-1).first():null;const cat=await e.DB.prepare("SELECT parent_id FROM classification_categories WHERE id=?").bind(cid).first();if(Number(level)>1&&(!parent||Number(parent.category_id)!==Number(cat?.parent_id)))return pathMenu(e,q,pid,level);await e.DB.prepare("DELETE FROM home_post_classification WHERE post_id=? AND level>=?").bind(pid,level).run();await e.DB.prepare("INSERT INTO home_post_classification(post_id,level,category_id) VALUES(?,?,?)").bind(pid,level,cid).run();return pathMenu(e,q,pid,level);}
 if(d.startsWith("ce_path_done:"))return keywordPrompt(e,q,Number(d.split(":")[1]));
 if(d.startsWith("ce_newcat:")){const a=d.split(":");return newCategoryPrompt(e,q,Number(a[1]),Number(a[2]||1),Number(a[3]||0));}
 if(d.startsWith("ce_kw:"))return keywordPrompt(e,q,Number(d.split(":")[1]));
 if(d.startsWith("ce_deleted:")){const n=Number(d.split(":")[1]);await e.DB.prepare("INSERT OR REPLACE INTO home_archive_posts(message_id,channel,url,status,updated_at) VALUES(?,?,?,'deleted',CURRENT_TIMESTAMP)").bind(n,HOME,"https://t.me/"+HOME+"/"+n).run();await e.DB.prepare("DELETE FROM home_post_classification WHERE post_id=?").bind(n).run();await e.DB.prepare("UPDATE classification_settings SET last_message_id=?,next_message_id=? WHERE id=1").bind(n,n+1).run();return render(e,q);}
 if(d.startsWith("ce_future:")){const n=Number(d.split(":")[1]);await e.DB.prepare("INSERT OR REPLACE INTO home_archive_posts(message_id,channel,url,status,future_dossier,updated_at) VALUES(?,?,?,'pending',1,CURRENT_TIMESTAMP)").bind(n,HOME,"https://t.me/"+HOME+"/"+n).run();return render(e,q);}
 if(d.startsWith("ce_next:")){const n=Number(d.split(":")[1])+1;await e.DB.prepare("UPDATE classification_settings SET next_message_id=? WHERE id=1").bind(n).run();return render(e,q);}
 if(d.startsWith("ce_prev:")){const n=Math.max(1,Number(d.split(":")[1])-1);await e.DB.prepare("UPDATE classification_settings SET next_message_id=? WHERE id=1").bind(n).run();return render(e,q);}
 if(d.startsWith("ce_back:"))return render(e,q);
 return out({ok:true});
}};
