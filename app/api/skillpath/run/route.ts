import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { topicById } from '@/lib/skillpath-catalog';
export const dynamic='force-dynamic';
const LANGUAGES:Record<string,{language:string;file:string}>={
 JavaScript:{language:'javascript',file:'main.js'},TypeScript:{language:'typescript',file:'main.ts'},
 Python:{language:'python',file:'main.py'},Java:{language:'java',file:'Main.java'},
 'C++':{language:'c++',file:'main.cpp'},C:{language:'c',file:'main.c'},
 'C#':{language:'csharp',file:'main.cs'},Go:{language:'go',file:'main.go'},Rust:{language:'rust',file:'main.rs'},
 PHP:{language:'php',file:'main.php'},Ruby:{language:'ruby',file:'main.rb'},
 Kotlin:{language:'kotlin',file:'main.kt'},Swift:{language:'swift',file:'main.swift'}
};
async function execute(language:{language:string;file:string},code:string,stdin:string){
 const response=await fetch('https://emkc.org/api/v2/piston/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:language.language,version:'*',files:[{name:language.file,content:code}],stdin,args:[],compile_timeout:10000,run_timeout:5000,run_memory_limit:128000000}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Execution provider returned HTTP '+response.status);
 const result=await response.json(),compile=result.compile||null,run=result.run||{};
 return {stdout:String(run.stdout||''),stderr:String(compile?.stderr||run.stderr||''),exitCode:typeof run.code==='number'?run.code:null,compileFailed:Boolean(compile?.code||compile?.stderr)};
}
export async function POST(req:Request){
 const userId=await getSessionUserId();if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 try{
  const body=await req.json(),language=LANGUAGES[String(body.language||'')],code=String(body.code||''),stdin=String(body.stdin||'');
  if(!language)return NextResponse.json({error:'This language is not enabled in the coding runner yet.'},{status:400});
  if(!code.trim()||code.length>20000)return NextResponse.json({error:'Code is required and must be under 20 KB.'},{status:400});
  if(stdin.length>5000)return NextResponse.json({error:'Input must be under 5 KB.'},{status:400});
  if(body.checkpoint===true){
   const courseId=String(body.courseId||''),topicId=String(body.topicId||'');
   if(!topicById(courseId,topicId))return NextResponse.json({error:'Invalid course checkpoint.'},{status:400});
   const cases=[{input:'2 3\n',expected:'5'},{input:'-4 9\n',expected:'5'}];
   const results=[];
   for(const test of cases){
    const out=await execute(language,code,test.input);
    const passed=!out.compileFailed&&out.exitCode===0&&out.stdout.trim()===test.expected;
    results.push({input:test.input.trim(),expected:test.expected,actual:out.stdout.trim(),passed,stderr:out.stderr,exitCode:out.exitCode});
    if(out.compileFailed)break;
   }
   const passed=results.length===cases.length&&results.every(x=>x.passed);
   await db.practiceAttempt.create({data:{userId,type:'skillpath-checkpoint',topic:courseId+':'+topicId,score:results.filter(x=>x.passed).length,total:cases.length}});
   return NextResponse.json({passed,passedCount:results.filter(x=>x.passed).length,total:cases.length,tests:results,message:passed?'All hidden checkpoint tests passed. The next lesson can now be unlocked.':'Some test cases failed. Fix your code and submit again.',provider:'Piston sandbox'});
  }
  const out=await execute(language,code,stdin);
  return NextResponse.json({success:!out.compileFailed&&out.exitCode===0,...out,executed:true,provider:'Piston sandbox'});
 }catch(e:any){const timeout=e?.name==='TimeoutError'||e?.name==='AbortError';return NextResponse.json({error:timeout?'Execution timed out. Limit your program to a short-running solution.':String(e?.message||'Could not execute code. Please try again.'),executed:false},{status:502});}
}
