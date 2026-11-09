import {ensureLibraryUISettings,getLibraryUISettings,updateLibraryUISettings,resetLibraryUISettings,buildLibraryHomePreview,LIBRARY_UI_DEFAULTS,LIBRARY_UI_STYLE_FIELDS,LIBRARY_UI_LABEL_FIELDS} from "./library-ui-store.js";

const tg=async(e,m,b={})=>(await fetch("https://api.telegram.org/bot"+e.BOT_TOKEN+"/"+m,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const out=x=>new Response(JSON.stringify(x??{ok:true}),{status:200,headers:{"content-type":"application/json"}});
const admin=(e,id)=>String(e.ADMIN_ID||"").split(",").map(x=>x.trim()).filter(Boolean).includes(String(id));
const STYLES=["default","primary","success","danger","link"];
const STYLE_NAMES={default:"پیش‌فرض",primary:"اصلی",success:"سبز",danger:"قرمز",link:"لینکی"};
const LABEL_NAMES={
 browse:"دکمهٔ مرور شاخه‌ها",sort:"دکمهٔ تغییر ترتیب",appearance:"دکمهٔ تغییر ظاهر کتابخانه",search:"دکمهٔ جست‌وجو",favorites:"دکمهٔ علاقه‌مندی‌ها",
 hub_back:"بازگشت از صفحهٔ اصلی",tree_back:"بازگشت از فهرست شاخه‌ها",category_sort:"نحوهٔ نمایش در صفحهٔ دسته",
 category_back:"بازگشت از صفحهٔ دسته",add_favorites:"افزودن به علاقه‌مندی‌ها",save_selected:"ثبت منتخب‌ها",
 cancel_selected:"لغو انتخاب",favorites_back:"بازگشت از علاقه‌مندی‌ها",remove_favorite:"حذف از علاقه‌مندی‌ها",
 previous:"صفحهٔ قبل",next:"صفحهٔ بعد",previous_branches:"شاخه‌های قبل",next_branches:"شاخه‌های بعد"
};
const STYLE_NAMES_FA={browse:"مرور شاخه‌ها",sort:"تغییر ترتیب",appearance:"تغییر ظاهر",search:"جست‌وجو",favorites:"علاقه‌مندی‌ها",back:"بازگشت",category:"دکمه‌های شاخه‌ها",post:"دکمه‌های پست‌ها",action:"عملیات معمولی",success:"عملیات تأیید",danger:"عملیات حذف/لغو",pagination:"صفحه‌بندی"};
const STYLE_BINDINGS={browse:"browse",sort:"sort",appearance:"action",search:"search",favorites:"favorites",hub_back:"back",tree_back:"back",tree_sort:"sort",category_sort:"success",category:"category",post:"post",add_favorites:"danger",save_selected:"success",cancel_selected:"danger",favorites_back:"back",remove_favorite:"danger",previous:"pagination",next:"pagination",previous_branches:"pagination",next_branches:"pagination"};
const iconText=(key,s)=>String(s?.[key+"_text"]??LIBRARY_UI_DEFAULTS[key+"_text"]??"");
async function openSettings(e,q){
 const s=await getLibraryUISettings(e);
 const rows=[
  [{text:"✏️ متن صفحهٔ اصلی کتابخانه",callback_data:"libraryui_edit:hub_text",style:"primary"}],
  [{text:"✏️ متن فهرست شاخه‌ها",callback_data:"libraryui_edit:tree_text"}],
  [{text:"🔤 تغییر عنوان دکمه‌ها",callback_data:"libraryui_labels"}],
  [{text:"✏️ نام دکمهٔ تغییر ظاهر کتابخانه",callback_data:"libraryui_edit:appearance"}],
  [{text:"🎨 رنگ‌بندی دکمه‌ها",callback_data:"libraryui_styles"}],
  [{text:"👁 پیش‌نمایش کتابخانه",callback_data:"libraryui_preview",style:"success"}],
  [{text:"♻️ بازنشانی ظاهر کتابخانه",callback_data:"libraryui_reset",style:"danger"}],
  [{text:"🔙 بازگشت به پنل مدیریت",callback_data:"panel"}]
 ];
 const text="🎨 <b>شخصی‌سازی کتابخانه</b>\n\n"+
  "متن صفحهٔ اصلی و فهرست شاخه‌ها را با Rich HTML تلگرام ویرایش کن؛ نمونهٔ هایلایت: &lt;mark&gt;متن&lt;/mark&gt;، لینک روی متن: &lt;a href=&quot;https://example.com&quot;&gt;Home&lt;/a&gt;، تیتر، نقل‌قول و بخش‌های بازشونده هم پشتیبانی می‌شوند. شکست‌خط‌های معمولی (Enter) هم خودکار حفظ می‌شوند. دکمه‌ها داخل خود Rich Message قرار می‌گیرند.\n\n"+
  "<b>متن‌ها:</b>\n"+
  "صفحهٔ اصلی: "+(String(s.hub_text||"").trim()?"شخصی‌سازی‌شده":"پیش‌فرض")+"\n"+
  "فهرست شاخه‌ها: "+(String(s.tree_text||"").trim()?"شخصی‌سازی‌شده":"پیش‌فرض")+"\n\n"+
  "<b>نمونهٔ عنوان دکمه‌ها:</b>\n"+
  "مرور: "+esc(iconText("browse",s))+"\nجست‌وجو: "+esc(iconText("search",s))+"\nعلاقه‌مندی‌ها: "+esc(iconText("favorites",s));
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text,parse_mode:"HTML",reply_markup:{inline_keyboard:rows}}));
}
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
async function labelMenu(e,q){
 const s=await getLibraryUISettings(e),rows=[];
 for(const key of LIBRARY_UI_LABEL_FIELDS)rows.push([{text:(LABEL_NAMES[key]||key)+": "+String(s[key+"_text"]||"").slice(0,34),callback_data:"libraryui_edit:"+key}]);
 rows.push([{text:"🔙 بازگشت",callback_data:"libraryui_open"}]);
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:"🔤 <b>عنوان دکمه‌های کتابخانه</b>\n\nروی دکمه‌ای که می‌خواهی تغییر کند بزن و عنوان تازه را بفرست. می‌توانی ایموجی معمولی یا Custom Emoji را هم در ابتدای عنوان قرار بدهی.",parse_mode:"HTML",reply_markup:{inline_keyboard:rows}}));
}
async function styleMenu(e,q){
 const s=await getLibraryUISettings(e),rows=[];
 for(const key of LIBRARY_UI_STYLE_FIELDS)rows.push([{text:STYLE_NAMES_FA[key]+": "+STYLE_NAMES[s[key+"_style"]||"default"],callback_data:"libraryui_stylepick:"+key}]);
 rows.push([{text:"🔙 بازگشت",callback_data:"libraryui_open"}]);
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:"🎨 <b>رنگ‌بندی دکمه‌ها</b>\n\nدکمه‌های Rich Message می‌توانند پیش‌فرض، اصلی، سبز، قرمز یا لینک‌مانند باشند. برای هایلایت، از &lt;mark&gt;متن&lt;/mark&gt; و برای لینک از &lt;a href=&quot;...&quot;&gt;متن&lt;/a&gt; استفاده کن.",parse_mode:"HTML",reply_markup:{inline_keyboard:rows}}));
}
async function stylePicker(e,q,key){
 if(!LIBRARY_UI_STYLE_FIELDS.includes(key))return out({ok:true});
 const s=await getLibraryUISettings(e),current=s[key+"_style"]||"default";
 const rows=STYLES.map(style=>[{text:(style===current?"🟢 ":"⚪ ")+STYLE_NAMES[style],callback_data:"libraryui_style:"+key+":"+style}]);
 rows.push([{text:"🔙 بازگشت به رنگ‌بندی",callback_data:"libraryui_styles"}]);
 return out(await tg(e,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:"🎨 <b>"+STYLE_NAMES_FA[key]+"</b>\n\nرنگ دلخواه را انتخاب کن:",parse_mode:"HTML",reply_markup:{inline_keyboard:rows}}));
}
async function beginEdit(e,q,field){
 const allowed=["hub_text","tree_text",...LIBRARY_UI_LABEL_FIELDS];
 if(!allowed.includes(field))return out({ok:true});
 await e.DB.prepare("INSERT INTO bot_library_ui_sessions(user_id,field,created_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET field=excluded.field,created_at=CURRENT_TIMESTAMP").bind(q.from.id,field).run();
 const rich=field==="hub_text"||field==="tree_text";
 const hint=rich
  ?"کد Rich HTML را به‌صورت متن بفرست. نمونه: <mark>متن هایلایت‌شده</mark>، <a href='URL'>لینک روی واژه</a>، <h2>تیتر</h2>، <blockquote>نقل‌قول</blockquote> و <details><summary>بیشتر</summary>متن پنهان</details>. شکست‌خط‌هایی که با Enter می‌گذاری هم خودکار حفظ می‌شوند و نیازی به نوشتن <br> برای هر خط نیست. دکمه‌های کتابخانه خودکار زیر محتوا قرار می‌گیرند. برای بازگشت به پیش‌فرض /reset بفرست."
  :"عنوان تازهٔ "+(LABEL_NAMES[field]||"دکمه")+" را بفرست. حداکثر ۶۴ نویسه است؛ برای بازگشت به عنوان پیش‌فرض /reset بفرست.";
 return out(await tg(e,"sendMessage",{chat_id:q.message.chat.id,text:"✏️ "+hint,reply_markup:{force_reply:true,selective:true}}));
}
function buttonLabel(m){
 const raw=String(m?.text??m?.caption??""),entities=[...(Array.isArray(m?.entities)?m.entities:[]),...(Array.isArray(m?.caption_entities)?m.caption_entities:[])];
 const custom=entities.find(x=>x?.type==="custom_emoji"&&x?.custom_emoji_id);
 if(!custom)return {text:raw.trim(),icon:null};
 const start=Math.max(0,Number(custom.offset)||0),end=Math.max(start,start+(Number(custom.length)||0));
 return {text:(raw.slice(0,start)+raw.slice(end)).trim(),icon:String(custom.custom_emoji_id)};
}
export async function handleLibraryUIMessage(e,m){
 if(!admin(e,m?.from?.id))return null;
 await ensureLibraryUISettings(e);
 const session=await e.DB.prepare("SELECT field FROM bot_library_ui_sessions WHERE user_id=?").bind(m.from.id).first();
 if(!session?.field)return null;
 const field=String(session.field),raw=String(m.text??m.caption??""),trimmed=raw.trim();
 if(!trimmed)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ پیام خالی است؛ لطفاً متن را بفرست."}));
 const rich=field==="hub_text"||field==="tree_text";
 if(trimmed==="/reset"){
  const patch=rich?{[field]:null,[field.replace(/_text$/,"_entities")]:[],[field.replace(/_text$/,"_custom")]:false}:{[field+"_text"]:null,[field+"_icon_custom_emoji_id"]:null,[field+"_icon_custom_emoji_alt"]:null};
  await updateLibraryUISettings(e,patch);
  await e.DB.prepare("DELETE FROM bot_library_ui_sessions WHERE user_id=?").bind(m.from.id).run();
  return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"♻️ مقدار به حالت پیش‌فرض برگشت.",reply_markup:{inline_keyboard:[[{text:"🎨 بازگشت به تنظیمات کتابخانه",callback_data:"libraryui_open"}]]}}));
 }
 if(rich){
  if(new TextEncoder().encode(raw).length>32768)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ Rich Message حداکثر ۳۲٬۷۶۸ بایت UTF-8 است."}));
  await updateLibraryUISettings(e,{[field]:raw,[field.replace(/_text$/,"_entities")]:[],[field.replace(/_text$/,"_custom")]:true});
 }else{
  const label=buttonLabel(m),length=Array.from(label.text).length;
  if(!label.text||length>64)return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"❌ عنوان دکمه باید بین ۱ تا ۶۴ نویسه باشد."}));
  await updateLibraryUISettings(e,{[field+"_text"]:label.text,[field+"_icon_custom_emoji_id"]:label.icon,[field+"_icon_custom_emoji_alt"]:label.alt||null});
 }
 await e.DB.prepare("DELETE FROM bot_library_ui_sessions WHERE user_id=?").bind(m.from.id).run();
 return out(await tg(e,"sendMessage",{chat_id:m.chat.id,text:"✅ تغییر ذخیره شد.",reply_markup:{inline_keyboard:[[{text:"👁 پیش‌نمایش کتابخانه",callback_data:"libraryui_preview"}],[{text:"🎨 تنظیمات کتابخانه",callback_data:"libraryui_open"}]]}}));
}
export default {async fetch(req,e){
 let u;try{u=await req.clone().json()}catch{return out({ok:true})}
 const q=u?.callback_query,m=u?.message,id=q?.from?.id||m?.from?.id;
 if(!admin(e,id))return out({ok:true});
 await ensureLibraryUISettings(e);
 if(m)return handleLibraryUIMessage(e,m)||out({ok:true});
 if(!q)return out({ok:true});
 const d=String(q.data||"");
 if(q.id)await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
 if(d==="libraryui_open")return openSettings(e,q);
 if(d==="libraryui_labels")return labelMenu(e,q);
 if(d==="libraryui_styles")return styleMenu(e,q);
 if(d.startsWith("libraryui_edit:"))return beginEdit(e,q,d.slice("libraryui_edit:".length));
 if(d.startsWith("libraryui_stylepick:"))return stylePicker(e,q,d.slice("libraryui_stylepick:".length));
 if(d.startsWith("libraryui_style:")){
  const [,key,style]=d.split(":");
  if(!LIBRARY_UI_STYLE_FIELDS.includes(key)||!STYLES.includes(style))return out({ok:true});
  await updateLibraryUISettings(e,{[key+"_style"]:style});
  return stylePicker(e,q,key);
 }
 if(d==="libraryui_preview"){
  const s=await getLibraryUISettings(e),payload=buildLibraryHomePreview(s);
  const r=await tg(e,"sendRichMessage",{chat_id:q.message.chat.id,...payload});
  return out(r);
 }
 if(d==="libraryui_reset"){
  await resetLibraryUISettings(e);
  return openSettings(e,q);
 }
 return out({ok:true});
}};
