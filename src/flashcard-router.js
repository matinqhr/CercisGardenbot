import app from "./final-book-gate.js";
export default {async fetch(req,env,ctx){
  if(req.method!=="POST")return app.fetch(req,env,ctx);
  let u;try{u=await req.clone().json()}catch{return app.fetch(req,env,ctx)};
  const q=u?.callback_query,m=u?.message;
  if(q&&String(q.data||"")==="flash_mode_book"){
    const f=await import("./flashcard-gate.js");
    return f.default.fetch(req,env,ctx)
  }
  if(q&&(String(q.data||"")==="public_list:0:0"||String(q.data||"").startsWith("flashpub:"))){
    const f=await import("./flashcard-public-list-gate.js");
    return f.handle(env,q)
  }
  if(q&&String(q.data||"").startsWith("fedit:")){
    const f=await import("./flashcard-edit-gate.js");
    return f.handleCallback(env,q)
  }
  if(m?.from?.id){
    const s=await env.DB.prepare("SELECT step FROM sessions WHERE user_id=?").bind(m.from.id).first();
    if(["FLASH_EDIT_LINK","FC_EDIT_TITLE","FC_EDIT_CARD_NAME","FC_EDIT_CARD_CONTENT","FC_EDIT_ADD_NAME","FC_EDIT_ADD_CONTENT"].includes(s?.step)){
      const f=await import("./flashcard-edit-gate.js");
      return f.handleMessage(env,m)
    }
    if(s?.step&&String(s.step).startsWith("BOOK_")){
      const b=await import("./admin-book-gate-v2.js");
      return b.default.fetch(req,env,ctx)
    }
    if(["ADD_LINK","ADD_FORM","EDIT_LINK","EDIT_FORM","BROADCAST","BROADCAST_CONFIRM"].includes(s?.step)){
      const b=await import("./admin-book-gate-v2.js");
      return b.default.fetch(req,env,ctx)
    }
  }
  return app.fetch(req,env,ctx)
}};
