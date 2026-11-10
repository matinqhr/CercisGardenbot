const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const out=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const findFlashContext=q=>{const rows=q?.message?.reply_markup?.inline_keyboard||[];for(const row of rows)for(const b of row){const m=String(b?.callback_data||"").match(/^flash:(\d+):(\d+)$/);if(m)return{id:Number(m[1]),card:Number(m[2])}}return null};
const buttons=(page,total,ctx)=>{const rows=[],nav=[];if(page>1)nav.push({text:"‹",callback_data:`public_list:${page-1}`});if(page<total)nav.push({text:"›",callback_data:`public_list:${page+1}`});if(nav.length)rows.push(nav);rows.push([{text:"🌱 فهرست ریزپرونده‌ها",callback_data:"micro_list:1"}]);if(ctx?.id)rows.push([{text:"🗂️ بازگشت به فهرست فلش‌کارت‌ها",callback_data:`flash_index:${ctx.id}:${ctx.card||1}`}]);rows.push([{text:"🔙 منوی اصلی",callback_data:"public_start"}]);return{inline_keyboard:rows};};
const render=async(e,chatId,messageId,page,ctx)=>{const rows=(await e.DB.prepare("SELECT t.id,t.url,t.title,(SELECT json_group_array(url) FROM (SELECT t.url AS url,0 AS link_no UNION ALL SELECT l.url,l.link_no FROM track_links l WHERE l.track_id=t.id AND l.url<>t.url ORDER BY link_no)) AS urls FROM tracks t ORDER BY t.id DESC").all()).results||[];const size=15;const total=Math.max(1,Math.ceil(rows.length/size));const p=Math.min(Math.max(Number.isInteger(page)?page:1,1),total);const items=rows.slice((p-1)*size,p*size);let text="📜 <b>فهرست پرونده‌های ثبت‌شده</b>\n\n";if(!items.length)text+="هنوز هیچ پرونده‌ای ثبت نشده است.";else for(let i=0;i<items.length;i++){const r=items[i],number=rows.length-((p-1)*size+i);let urls=[];try{urls=JSON.parse(String(r.urls||"[]"))}catch{urls=[]}if(!Array.isArray(urls)||!urls.length)urls=[r.url];urls=urls.map(u=>String(u||"").replace(/%0A/gi," ").trim()).filter(Boolean);text+=`${number}. ${r.title?`🏷️ <b>${esc(r.title)}</b>`:`پرونده #${r.id}`}\n${urls.map((u,j)=>`🔗 <a href="${esc(u)}">${j===0?"مشاهده پست مرتبط":`مشاهده پست مرتبط ${j+1}`}</a>`).join("\n")}\n\n`}text+=`<i>صفحه ${p} از ${total}</i>`;const reply_markup=buttons(p,total,ctx);if(messageId){const edited=await tg(e,"editMessageText",{chat_id:chatId,message_id:messageId,text,parse_mode:"HTML",reply_markup});if(edited?.ok||edited?.description?.includes("message is not modified"))return edited;console.error("[CERCIS_PUBLIC_LIST_EDIT_FAILED]",edited?.description||edited);return tg(e,"sendMessage",{chat_id:chatId,text,parse_mode:"HTML",reply_markup,disable_web_page_preview:true})}return tg(e,"sendMessage",{chat_id:chatId,text,parse_mode:"HTML",reply_markup,disable_web_page_preview:true})};

const pageFromCallback=d=>{if(d==="public_list"||d==="public_list:0:0")return 1;const m=d.match(/^public_list:(\d+)$/);return m?Number(m[1]):null;};
const MINI_PAGE_SIZE=10;
const miniIdsSql="SELECT post_id FROM home_post_overviews WHERE length(trim(COALESCE(overview,'')))>0 OR COALESCE(photo_file_id,'')<>'' UNION SELECT post_id FROM home_post_lyrics WHERE length(trim(COALESCE(lyrics,'')))>0";
const miniData=async(e,id)=>{
 const pid=Number(id);
 if(!Number.isSafeInteger(pid)||pid<1)return null;
 const post=await e.DB.prepare("SELECT title,url,status,title_emoji,title_emoji_id FROM home_archive_posts WHERE message_id=?").bind(pid).first();
 if(post?.status==="deleted")return null;
 const overview=await e.DB.prepare("SELECT overview,photo_file_id FROM home_post_overviews WHERE post_id=?").bind(pid).first();
 const lyric=await e.DB.prepare("SELECT lyrics FROM home_post_lyrics WHERE post_id=?").bind(pid).first();
 const overviewText=String(overview?.overview||"").trim(),lyrics=String(lyric?.lyrics||"").trim(),photo=String(overview?.photo_file_id||"");
 const hasOverview=Boolean(overviewText||photo),hasLyrics=Boolean(lyrics);
 if(!hasOverview&&!hasLyrics)return null;
 return{postId:pid,title:String(post?.title||"پست #"+pid),url:String(post?.url||"https://t.me/Arghavanplaylistt/"+pid),titleEmoji:String(post?.title_emoji||""),titleEmojiId:String(post?.title_emoji_id||""),overview:overviewText,photo,lyrics,hasOverview,hasLyrics};
};
const editOrSend=async(e,q,text,reply_markup)=>{
 const chatId=q.message?.chat?.id,messageId=q.message?.message_id;
 if(messageId){
  const edited=await tg(e,"editMessageText",{chat_id:chatId,message_id:messageId,text,parse_mode:"HTML",reply_markup,disable_web_page_preview:true});
  if(edited?.ok||String(edited?.description||"").includes("message is not modified"))return edited;
  console.error("[CERCIS_MICRO_EDIT_FAILED]",edited?.description||edited);
 }
 return tg(e,"sendMessage",{chat_id:chatId,text,parse_mode:"HTML",reply_markup,disable_web_page_preview:true});
};
const renderMicroList=async(e,q,page)=>{
 let count=0,rows=[],safePage=1,totalPages=1,offset=0;
 try{
  const cte="WITH mini_ids(post_id) AS ("+miniIdsSql+") ";
  const countRow=await e.DB.prepare(cte+"SELECT COUNT(*) n FROM mini_ids i LEFT JOIN home_archive_posts p ON p.message_id=i.post_id WHERE COALESCE(p.status,'pending')<>'deleted'").first();
  count=Number(countRow?.n||0);
  totalPages=Math.max(1,Math.ceil(count/MINI_PAGE_SIZE));
  safePage=Math.min(Math.max(Number(page)||1,1),totalPages);
  offset=(safePage-1)*MINI_PAGE_SIZE;
  rows=(await e.DB.prepare(cte+"SELECT i.post_id,COALESCE(NULLIF(p.title,''),'پست #'||i.post_id) title,COALESCE(NULLIF(p.url,''),'https://t.me/Arghavanplaylistt/'||i.post_id) url,COALESCE(p.title_emoji,'') title_emoji,COALESCE(p.title_emoji_id,'') title_emoji_id,CASE WHEN length(trim(COALESCE(o.overview,'')))>0 OR COALESCE(o.photo_file_id,'')<>'' THEN 1 ELSE 0 END has_overview,CASE WHEN length(trim(COALESCE(l.lyrics,'')))>0 THEN 1 ELSE 0 END has_lyrics FROM mini_ids i LEFT JOIN home_archive_posts p ON p.message_id=i.post_id LEFT JOIN home_post_overviews o ON o.post_id=i.post_id LEFT JOIN home_post_lyrics l ON l.post_id=i.post_id WHERE COALESCE(p.status,'pending')<>'deleted' ORDER BY i.post_id DESC LIMIT ? OFFSET ?").bind(MINI_PAGE_SIZE,offset).all()).results||[];
  const buttons=[],nav=[];
  if(safePage>1)nav.push({text:"‹",callback_data:"micro_list:"+(safePage-1)});
  if(safePage<totalPages)nav.push({text:"›",callback_data:"micro_list:"+(safePage+1)});
  if(nav.length)buttons.push(nav);
  for(const r of rows){
   let label=String(r.title||("پست #"+r.post_id));
   if(r.title_emoji&&!r.title_emoji_id)label=String(r.title_emoji)+" "+label;
   label=Array.from(label).slice(0,55).join("");
   buttons.push([{text:label,...(r.title_emoji_id?{icon_custom_emoji_id:String(r.title_emoji_id)}:{}),callback_data:"micro_dossier:"+Number(r.post_id)+":"+safePage}]);
  }
  buttons.push([{text:"📜 بازگشت به فهرست پرونده‌های ثبت‌شده",callback_data:"public_list:1"}]);
  buttons.push([{text:"🔙 منوی اصلی",callback_data:"public_start"}]);
  let text="🌱 <b>فهرست ریزپرونده‌ها</b>\n\nپست‌هایی که اطلاعات اجمالی یا متن ترانهٔ آن‌ها در سرسیس ثبت شده است.\n\n";
  if(!rows.length)text+="هنوز ریزپرونده‌ای ثبت نشده است.";
  else text+=rows.map((r,i)=>{const n=count-offset-i;const marks=[Number(r.has_overview)===1?"📝 اطلاعات اجمالی":"",Number(r.has_lyrics)===1?"🎼 متن ترانه":""].filter(Boolean).join("  ·  ");return n+". <a href=\""+esc(r.url)+"\">"+esc(r.title)+"</a>\n"+marks;}).join("\n\n");
  text+="\n\n<i>صفحه "+safePage+" از "+totalPages+" · "+count+" ریزپرونده</i>";
  return await editOrSend(e,q,text,{inline_keyboard:buttons});
 }catch(err){
  console.error("[CERCIS_MICRO_LIST]",err);
  return await editOrSend(e,q,"⚠️ فهرست ریزپرونده‌ها فعلاً در دسترس نیست.",{inline_keyboard:[[{text:"📜 بازگشت به فهرست پرونده‌ها",callback_data:"public_list:1"}]]});
 }
};
const renderMicroDossier=async(e,q,id,page=1)=>{
 const data=await miniData(e,id);
 if(!data)return await editOrSend(e,q,"❌ ریزپرونده‌ای برای این پست پیدا نشد.",{inline_keyboard:[[{text:"🌱 فهرست ریزپرونده‌ها",callback_data:"micro_list:"+page}]]});
 const rows=[];
 if(data.hasOverview)rows.push([{text:"📝 دریافت اطلاعات اجمالی",callback_data:"micro_overview:"+data.postId+":"+page}]);
 if(data.hasLyrics)rows.push([{text:"🎼 دریافت متن ترانه",callback_data:"micro_lyrics:"+data.postId+":"+page}]);
 rows.push([{text:"👀 مشاهده پست اصلی",url:data.url}]);
 rows.push([{text:"🔙 بازگشت به فهرست ریزپرونده‌ها",callback_data:"micro_list:"+page}]);
 return await editOrSend(e,q,"🌱 <b>"+esc(data.title)+"</b>\n\nاین ریزپرونده اطلاعات ثبت‌شدهٔ این پست را به‌صورت جداگانه در اختیارتان قرار می‌دهد.\n\n"+(data.hasOverview?"📝 اطلاعات اجمالی: ثبت شده":"")+(data.hasOverview&&data.hasLyrics?"\n":"")+(data.hasLyrics?"🎼 متن ترانه: ثبت شده":""),{inline_keyboard:rows});
};
const chunksOf=value=>{const chars=Array.from(String(value||"")),chunks=[];for(let i=0;i<chars.length;i+=3800)chunks.push(chars.slice(i,i+3800).join(""));return chunks;};
const sendMicroPart=async(e,q,id,kind,page=1)=>{
 const data=await miniData(e,id),chatId=q.message?.chat?.id;
 if(!data)return await tg(e,"sendMessage",{chat_id:chatId,text:"❌ این بخش از ریزپرونده در دسترس نیست."});
 const back={inline_keyboard:[[{text:"↩️ بازگشت به ریزپرونده",callback_data:"micro_dossier:"+data.postId+":"+page}],[{text:"👀 مشاهده پست اصلی",url:data.url}]]};
 if(kind==="overview"){
  if(data.photo){
   const photoResult=await tg(e,"sendPhoto",{chat_id:chatId,photo:data.photo,caption:"📝 تصویر اطلاعات اجمالی پست #"+data.postId,...(!data.overview?{reply_markup:back}:{})});
   if(!photoResult?.ok)console.error("[CERCIS_MICRO_PHOTO]",photoResult?.description||photoResult);
  }
  if(data.overview){
   const chunks=chunksOf("📝 اطلاعات اجمالی — "+data.title+"\n\n"+data.overview);
   for(let i=0;i<chunks.length;i++){
    const result=await tg(e,"sendMessage",{chat_id:chatId,text:chunks[i],...(i===chunks.length-1?{reply_markup:back}:{})});
    if(!result?.ok){console.error("[CERCIS_MICRO_OVERVIEW_SEND]",result?.description||result);break;}
   }
  }
 }else if(kind==="lyrics"){
  const chunks=chunksOf("🎼 متن ترانه — "+data.title+"\n\n"+data.lyrics);
  for(let i=0;i<chunks.length;i++){
   const result=await tg(e,"sendMessage",{chat_id:chatId,text:chunks[i],...(i===chunks.length-1?{reply_markup:back}:{})});
   if(!result?.ok){console.error("[CERCIS_MICRO_LYRICS_SEND]",result?.description||result);break;}
  }
 }
 return {ok:true};
};
const handleMicroCallback=async(e,q,d)=>{
 const p=d.split(":"),id=Number(p[1]),page=Math.max(1,Number(p[2])||1);
 await tg(e,"answerCallbackQuery",{callback_query_id:q.id});
 if(d==="micro_list"||d.startsWith("micro_list:"))return renderMicroList(e,q,Number(p[1])||1);
 if(d.startsWith("micro_dossier:"))return renderMicroDossier(e,q,id,page);
 if(d.startsWith("micro_overview:"))return sendMicroPart(e,q,id,"overview",page);
 if(d.startsWith("micro_lyrics:"))return sendMicroPart(e,q,id,"lyrics",page);
 return {ok:true};
};
export default{async fetch(req,e){let u;try{u=await req.clone().json()}catch{return out({ok:true})}const q=u?.callback_query,d=String(q?.data||"");if(!q)return out({ok:true});if(d==="micro_list"||d.startsWith("micro_"))return out(await handleMicroCallback(e,q,d));const page=pageFromCallback(d);if(page===null)return out({ok:true});if(q.id)await tg(e,"answerCallbackQuery",{callback_query_id:q.id});return out(await render(e,q.message?.chat?.id,q.message?.message_id,page,findFlashContext(q)))}};
