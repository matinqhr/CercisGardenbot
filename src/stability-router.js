import app from "./fix-router.js";
export default{async fetch(req,e,ctx){return app.fetch(req,e,ctx)}};