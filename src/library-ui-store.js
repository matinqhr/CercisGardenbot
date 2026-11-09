const DEFAULTS=Object.freeze({
  hub_text:"🗂 <b>کتابخانه Home</b>\n\nدر این بخش می‌توانی شاخه‌های آرشیو را مرور کنی، ترتیب نمایش را تغییر بدهی، در پست‌ها جست‌وجو کنی و پست‌های دلخواهت را در فهرست علاقه‌مندی‌ها نگه داری.",
  hub_entities:[],
  hub_custom:false,
  tree_text:"🗂 <b>شاخه‌های کتابخانه Home</b>\n\nیک شاخه را برای مرور پست‌ها انتخاب کن:",
  tree_entities:[],
  tree_custom:false,
  browse_text:"🗂 مرور شاخه‌های کتابخانه",
  sort_text:"⚙️ تغییر ترتیب نمایش",
  search_text:"🔎 جست‌وجو",
  favorites_text:"❤️ پست‌های پسندیده‌شده",
  hub_back_text:"🔙 منوی اصلی",
  tree_back_text:"🔙 بازگشت به کتابخانه",
  category_sort_text:"⚙️ نحوه نمایش",
  category_back_text:"🔙 بازگشت",
  add_favorites_text:"❤️ افزودن پست‌ها به فهرست علاقه‌مندی",
  save_selected_text:"✅ ثبت منتخب‌ها",
  cancel_selected_text:"✖️ لغو انتخاب",
  favorites_back_text:"🔙 بازگشت به کتابخانه",
  remove_favorite_text:"✖️",
  previous_text:"◀️ پست‌های قبل",
  next_text:"پست‌های بعد ▶️",
  no_categories_text:"هنوز شاخه‌ای ثبت نشده است",
  browse_style:"primary",
  sort_style:"default",
  search_style:"success",
  favorites_style:"default",
  back_style:"default",
  category_style:"default",
  post_style:"default",
  action_style:"default",
  success_style:"success",
  danger_style:"danger",
  pagination_style:"default"
});
const LABEL_BINDING={hub_sort:"sort"};
const STYLE_BINDING={
  browse:"browse",hub_sort:"sort",search:"search",favorites:"favorites",hub_back:"back",
  tree_sort:"sort",tree_back:"back",category:"category",post:"post",
  category_sort:"sort",category_back:"back",add_favorites:"action",
  save_selected:"success",cancel_selected:"danger",favorites_back:"back",
  remove_favorite:"danger",previous:"pagination",next:"pagination"
};
const ALLOWED_STYLES=new Set(["default","primary","success","danger","link"]);
let schemaPromise=null;
export async function ensureLibraryUISettings(e){
  if(!schemaPromise){
    schemaPromise=(async()=>{
      await e.DB.prepare("CREATE TABLE IF NOT EXISTS bot_library_ui_settings(id INTEGER PRIMARY KEY CHECK(id=1),settings_json TEXT NOT NULL DEFAULT '{}',updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
      await e.DB.prepare("INSERT OR IGNORE INTO bot_library_ui_settings(id,settings_json) VALUES(1,'{}')").run();
      await e.DB.prepare("CREATE TABLE IF NOT EXISTS bot_library_ui_sessions(user_id INTEGER PRIMARY KEY,field TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
    })().catch(err=>{schemaPromise=null;throw err;});
  }
  await schemaPromise;
}
export async function getLibraryUISettings(e){
  await ensureLibraryUISettings(e);
  const row=await e.DB.prepare("SELECT settings_json FROM bot_library_ui_settings WHERE id=1").first();
  let saved={};
  try{const parsed=JSON.parse(String(row?.settings_json||"{}"));if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))saved=parsed;}catch{}
  return {...DEFAULTS,...saved};
}
export async function updateLibraryUISettings(e,patch){
  const current=await getLibraryUISettings(e);
  const next={...current,...patch};
  await e.DB.prepare("UPDATE bot_library_ui_settings SET settings_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(JSON.stringify(next)).run();
  return next;
}
export async function resetLibraryUISettings(e){
  await ensureLibraryUISettings(e);
  await e.DB.prepare("UPDATE bot_library_ui_settings SET settings_json='{}',updated_at=CURRENT_TIMESTAMP WHERE id=1").run();
  return {...DEFAULTS};
}
export function libraryTextPayload(settings,key){
  const text=String(settings?.[key]??DEFAULTS[key]??"");
  if(settings?.[key.replace(/_text$/,"_custom")]){
    try{
      const parsed=JSON.parse(text);
      if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed)&&
        (typeof parsed.html==="string"||typeof parsed.markdown==="string"||Array.isArray(parsed.blocks)))
        return {rich_message:{...parsed,is_rtl:true}};
    }catch{}
  }
  return {rich_message:{html:text,is_rtl:true}};
}
const htmlEsc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
export function richButtonRows(rows=[]){
  return rows.map(row=>{
    const buttons=(Array.isArray(row)?row:[]).map(button=>{
      if(!button||typeof button!=="object")return "";
      const label=htmlEsc(button.text||"");
      const icon=button.icon_custom_emoji_id?
        '<tg-emoji emoji-id="'+htmlEsc(button.icon_custom_emoji_id)+'">'+htmlEsc(button.rich_custom_emoji_alt||"🌿")+'</tg-emoji>':"";
      const body=icon+label;
      const style=String(button.style||"");
      const styleAttr=style&&["primary","success","danger","link"].includes(style)&&!(style==="link"&&button.url)?' style="'+style+'"':"";
      if(button.callback_data!=null)return '<tg-button type="callback_data"'+styleAttr+' data="'+htmlEsc(button.callback_data)+'">'+body+'</tg-button>';
      if(button.url)return '<tg-button type="url"'+styleAttr+' url="'+htmlEsc(button.url)+'">'+body+'</tg-button>';
      if(button.switch_inline_query_current_chat!=null)return '<tg-button type="switch_inline_query_current_chat"'+styleAttr+' query="'+htmlEsc(button.switch_inline_query_current_chat)+'">'+body+'</tg-button>';
      if(button.switch_inline_query!=null)return '<tg-button type="switch_inline_query"'+styleAttr+' query="'+htmlEsc(button.switch_inline_query)+'">'+body+'</tg-button>';
      return "";
    }).filter(Boolean).join("");
    return buttons?'<tg-button-row align="center">'+buttons+'</tg-button-row>':"";
  }).filter(Boolean).join("\\n");
}
export function libraryButton(settings,key,extra={}){
  const labelKey=LABEL_BINDING[key]||key;
  const label=String(extra.text??settings?.[labelKey+"_text"]??DEFAULTS[labelKey+"_text"]??key).trim();
  const icon=settings?.[labelKey+"_icon_custom_emoji_id"];
  const styleKey=STYLE_BINDING[key]||key;
  const style=String(settings?.[styleKey+"_style"]??DEFAULTS[styleKey+"_style"]??"default");
  return {text:label,...(icon?{icon_custom_emoji_id:String(icon)}:{}),...(ALLOWED_STYLES.has(style)&&style!=="default"?{style}:{}),...extra};
}
export function styleLibraryButton(settings,styleKey,button){
  const style=String(settings?.[styleKey+"_style"]??DEFAULTS[styleKey+"_style"]??"default");
  return {...button,...(ALLOWED_STYLES.has(style)&&style!=="default"?{style}:{})};
}
export function buildLibraryHomePreview(settings){
  const rows=[
    [libraryButton(settings,"browse",{callback_data:"home_categories"})],
    [libraryButton(settings,"hub_sort",{callback_data:"home_sort_home"})],
    [libraryButton(settings,"search",{switch_inline_query_current_chat:""}) ,libraryButton(settings,"favorites",{callback_data:"favorites:0"})],
    [libraryButton(settings,"hub_back",{callback_data:"public_start"})]
  ];
  const rich=libraryTextPayload(settings,"hub_text");
  rich.rich_message.html=(String(rich.rich_message?.html||"")+richButtonRows(rows));
  return rich;
}
export const LIBRARY_UI_DEFAULTS=DEFAULTS;
export const LIBRARY_UI_STYLE_FIELDS=["browse","sort","search","favorites","back","category","post","action","success","danger","pagination"];
export const LIBRARY_UI_LABEL_FIELDS=[
  "browse","sort","search","favorites","hub_back","tree_back","category_sort","category_back",
  "add_favorites","save_selected","cancel_selected","favorites_back","remove_favorite","previous","next"
];
