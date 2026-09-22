export type RemoteQuestion = { id:string; text:string; options:string[]; correctAnswers:number[]; xp:number; difficulty?:'easy'|'medium'|'hard'; hasCases?:boolean };
declare global {
  interface Window {
    Telegram?: { WebApp?: { initData:string; ready:()=>void } };
  }
}
export function telegramInitData(): string { return window.Telegram?.WebApp?.initData || ""; }
export function telegramReady(): void { window.Telegram?.WebApp?.ready?.(); }
async function request(path:string,init?:RequestInit):Promise<Response>{
  const headers=new Headers(init?.headers);
  headers.set("x-telegram-init-data",telegramInitData());
  return fetch(path,{...init,headers});
}
export async function fetchQuizQuestions():Promise<RemoteQuestion[]>{
  const r=await request("/api/quiz/questions");
  if(!r.ok)throw new Error("quiz questions unavailable");
  const b=await r.json();
  return Array.isArray(b?.questions)?b.questions:[];
}
export async function receiveQuizCases(questionId:string):Promise<number>{
  const r=await request("/api/quiz/case",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({questionId})});
  if(!r.ok)throw new Error("case delivery failed");
  const b=await r.json();
  return Number(b?.received)||0;
}
