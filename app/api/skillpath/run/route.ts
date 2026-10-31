import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
export const dynamic='force-dynamic';
const LANGUAGES:Record<string,{language:string;file:string}>={JavaScript:{language:'javascript',file:'main.js'},Python:{language:'python',file:'main.py'},Java:{language:'java',file:'Main.java'},'C++':{language:'c++',file:'main.cpp'},C:{language:'c',file:'main.c'}};
export async function POST(req:Request){
 const userId=await getSessionUserId();if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 try{
  const body=await req.json(),language=LANGUAGES[String(body.language||'')],code=String(body.code||''),stdin=String(body.stdin||'');
  if(!language)return NextResponse.json({error:'Unsupported language.'},{status:400});
  if(!code.trim()||code.length>20000)return NextResponse.json({error:'Code is required and must be under 20 KB.'},{status:400});
  if(stdin.length>5000)return NextResponse.json({error:'Input must be under 5 KB.'},{status:400});
  const response=await fetch('https://emkc.org/api/v2/piston/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:language.language,version:'*',files:[{name:language.file,content:code}],stdin,args:[],compile_timeout:10000,run_timeout:5000,run_memory_limit:128000000}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return NextResponse.json({error:'The code execution service is temporarily unavailable.',detail:'Execution provider returned HTTP '+response.status},{status:502});
  const result=await response.json(),compile=result.compile||null,run=result.run||{};
  return NextResponse.json({success:!compile?.stderr&&!compile?.code&&run.code===0,stdout:String(run.stdout||''),stderr:String(compile?.stderr||run.stderr||''),exitCode:typeof run.code==='number'?run.code:null,signal:run.signal||null,executed:true,provider:'Piston sandbox'});
 }catch(e:any){const timeout=e?.name==='TimeoutError'||e?.name==='AbortError';return NextResponse.json({error:timeout?'Execution timed out. Limit your program to a short-running solution.':'Could not execute code. Please try again.',executed:false},{status:502});}
}
