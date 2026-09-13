const tg=async(e,m,b={})=>(await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)})).json();
const json=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});

const START_TEXT=`🌳 <b>Cercis Garden</b>\n\nکتابخانه‌ای از اطلاعات پست‌های <a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a>.\n\nلینک یا خودِ پستی را که از <a href="https://t.me/Arghavanplaylistt">𝐇𝐨𝐦𝐞</a> دریافت کرده‌اید برای من ارسال کنید.`;
const START_KEYBOARD={inline_keyboard:[
  [{text:"📚 راهنما",callback_data:"help"}],
  [{text:"ℹ️ درباره ربات",url:"https://telegra.ph/Cercis-08-27"}],
  [{text:"📜 فهرست پست‌های ثبت‌شده",callback_data:"public_list"}]
]};

function telegramUpdate(u){return u&&typeof u==="object"?u:null}
function message(u){return u?.message||null}
function callback(u){return u?.callback_query||null}

async function start(e,m){
  return json(await tg(e,"sendMessage",{
    chat_id:m?.chat?.id,
    text:START_TEXT,
    parse_mode:"HTML",
    reply_markup:START_KEYBOARD
  }))
}

export default{
  async fetch(req,e,ctx){
    if(req.method!=="POST")return new Response("Cercis Garden v2",{status:200});
    let u;
    try{u=telegramUpdate(await req.json())}catch{return new Response("ok",{status:200})}
    const m=message(u);
    if(String(m?.text||"").trim()==="/start")return start(e,m);
    // v2 routing will be migrated here in isolated stages.
    // Until migration is complete, preserve the existing behavior.
    return import("../forward-router.js").then(x=>x.default.fetch(req,e,ctx));
  }
};
