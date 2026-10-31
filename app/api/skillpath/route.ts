import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { COURSES, QUESTIONS, courseById, topicById } from '@/lib/skillpath-catalog';
export const dynamic='force-dynamic';
const aiClient=()=>process.env.OPENAI_API_KEY?.trim()?new OpenAI({apiKey:process.env.OPENAI_API_KEY.trim()}):null;
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
export async function GET(req:Request){
 const userId=await getSessionUserId();if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 const url=new URL(req.url),id=url.searchParams.get('course');
 const progress=await db.moduleProgress.findMany({where:{userId,moduleId:{startsWith:'skillpath:'}}});
 const attempts=await db.practiceAttempt.findMany({where:{userId,type:'skillpath-assessment'},orderBy:{createdAt:'desc'},take:30});
 const summaries=COURSES.map(c=>{const topics=c.modules.flatMap(m=>m.topics);const done=topics.filter(t=>progress.some(p=>p.moduleId==='skillpath:'+c.id+':'+t.id&&p.completed&&p.examPassed)).length;const a=attempts.find(x=>x.topic===c.id);return{id:c.id,title:c.title,category:c.category,level:c.level,description:c.description,topicCount:topics.length,completed:done,percent:topics.length?Math.round(done/topics.length*100):0,assessmentScore:a?Math.round(a.score/Math.max(a.total,1)*100):null};});
 if(id){const course=courseById(id);if(!course)return NextResponse.json({error:'Course not found.'},{status:404});return NextResponse.json({course,progress:progress.filter(p=>p.moduleId.startsWith('skillpath:'+id+':'))});}
 return NextResponse.json({courses:summaries,assessments:attempts.map(a=>({courseId:a.topic,score:Math.round(a.score/Math.max(a.total,1)*100)}))});
}
export async function POST(req:Request){
 const userId=await getSessionUserId();if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 try{
 const body=await req.json();
 if(body.action==='assessment'){
  const course=courseById(String(body.courseId||''));if(!course)return NextResponse.json({error:'Select a valid course.'},{status:400});
  const questions=QUESTIONS[course.id]||QUESTIONS['full-stack'];
  const answers=Array.isArray(body.answers)?body.answers.slice(0,5).map((x:unknown)=>String(x||'').slice(0,2000)):[];
  if(answers.length!==5||answers.some((x:string)=>x.trim().length<3))return NextResponse.json({error:'Answer all five questions.'},{status:400});
  let result:any=null;const ai=aiClient();
  if(ai){try{const r=await ai.chat.completions.create({model:process.env.OPENAI_MODEL?.trim()||'gpt-4o-mini',temperature:.1,response_format:{type:'json_object'},messages:[{role:'system',content:'Grade technical answers fairly and accept correct paraphrases. Return JSON only: {"score":0-100,"feedback":[{"score":0-100,"feedback":"specific feedback","expected":"key idea"}]}. Include exactly five feedback items.'},{role:'user',content:JSON.stringify({course:course.title,questions:questions.map((q,i)=>({question:q[0],answer:answers[i],expected:q[2]}))})}]});const p=JSON.parse(r.choices[0]?.message?.content||'{}');if(Array.isArray(p.feedback)&&p.feedback.length===5)result={score:clamp(Number(p.score)||0),feedback:p.feedback.map((f:any)=>({score:clamp(Number(f.score)||0),feedback:String(f.feedback||'Review the key concept.'),expected:String(f.expected||'') })),source:'openai'};}catch(e){console.error('AI assessment unavailable',e);}}
  if(!result){const feedback=questions.map((q,i)=>{const text=answers[i].toLowerCase(),matched=q[1].filter((w:string)=>text.includes(w)).length,score=clamp(matched/q[1].length*100);return{score,feedback:score>=60?'Several key ideas are present. Add an example for a stronger answer.':'Important concepts are missing. Review the explanation and try again.',expected:q[2]};});result={score:clamp(feedback.reduce((s:number,f:any)=>s+f.score,0)/5),feedback,source:'transparent-keyword-rubric'};}
  await db.practiceAttempt.create({data:{userId,type:'skillpath-assessment',topic:course.id,score:result.score,total:100}});
  return NextResponse.json({...result,level:result.score<40?'Beginner':result.score<75?'Intermediate':'Advanced',retryRequired:result.score<70,recommendations:[{id:course.id,title:course.title,reason:'Selected course, matched to your assessment.'},...COURSES.filter(c=>c.id!==course.id).slice(0,3).map(c=>({id:c.id,title:c.title,reason:'Related learning option.'}))]});
 }
 if(body.action==='lesson'){
  const found=topicById(String(body.courseId||''),String(body.topicId||''));if(!found)return NextResponse.json({error:'Topic not found.'},{status:404});
  const {course,module,topic}=found,ai=aiClient();
  if(ai){try{const r=await ai.chat.completions.create({model:process.env.OPENAI_MODEL?.trim()||'gpt-4o-mini',temperature:.3,response_format:{type:'json_object'},messages:[{role:'system',content:'You are an expert instructor. Create a complete, accurate beginner-friendly lesson. Return JSON with overview, learningObjectives array, sections array of {heading,explanation,example}, workedExample, code, codeExplanation, expectedOutput, commonMistakes array, practiceTask, quiz object {question,options array of exactly 4,answerIndex,explanation}, interviewQuestions array. Substantial theory and a worked example are required. For non-programming topics use formulas/procedures rather than forced code.'},{role:'user',content:'Course: '+course.title+'. Module: '+module.title+'. Topic: '+topic.title+'. Objective: '+topic.objective+'. Starter material: '+topic.theory.join(' ')}]});const lesson=JSON.parse(r.choices[0]?.message?.content||'{}');if(lesson.overview&&Array.isArray(lesson.sections)&&lesson.quiz?.options?.length===4){const correct=clamp(Number(lesson.quiz.answerIndex)||0);const options=[...lesson.quiz.options];[options[1],options[correct]]=[options[correct],options[1]];lesson.quiz.options=options;lesson.quiz.answerIndex=1;return NextResponse.json({lesson,source:'openai'});}}catch(e){console.error('Lesson generation unavailable',e);}}
  return NextResponse.json({source:'curated-fallback',lesson:{overview:topic.objective,learningObjectives:[topic.objective,'Explain the concept in your own words.','Apply the concept to a practical example.'],sections:topic.theory.map((explanation,i)=>({heading:['Core concept','How it works','When to use it','Common mistakes','Real-world application'][i],explanation,example:i===0?topic.example:''})),workedExample:topic.example,code:topic.example,codeExplanation:'Trace the example line by line, identify its input and output, and change one value to observe the behavior.',expectedOutput:topic.output,commonMistakes:['Skipping input validation and edge cases.','Copying code without tracing the data flow.','Not testing after changing the implementation.'],practiceTask:topic.exercise,quiz:{question:'Which approach best demonstrates understanding of '+topic.title+'?',options:['Memorize syntax without testing it.','Explain the concept, apply it to an example and test an edge case.','Copy code without understanding it.','Ignore errors and assume the result is correct.'],answerIndex:1,explanation:'Understanding means explaining the idea, applying it and checking behavior with tests.'},interviewQuestions:[topic.interview]}});
 }
 if(body.action==='complete'){
  const found=topicById(String(body.courseId||''),String(body.topicId||''));if(!found)return NextResponse.json({error:'Course or topic not found.'},{status:404});
  const all=found.course.modules.flatMap(m=>m.topics),index=all.findIndex(t=>t.id===found.topic.id),previous=all.slice(0,index);
  if(previous.length){const ids=previous.map(t=>'skillpath:'+found.course.id+':'+t.id),done=await db.moduleProgress.findMany({where:{userId,moduleId:{in:ids},completed:true,examPassed:true}});if(done.length!==previous.length)return NextResponse.json({error:'Complete the previous topic before unlocking this one.'},{status:409});}
  const quizScore=clamp(Number(body.quizScore)||0),practicePassed=body.practicePassed===true;if(Number(body.quizAnswer)!==1||quizScore<70||!practicePassed)return NextResponse.json({error:'Pass the quiz with at least 70% and complete the coding practice.'},{status:400});
  const moduleId='skillpath:'+found.course.id+':'+found.topic.id;
  const saved=await db.moduleProgress.upsert({where:{userId_moduleId:{userId,moduleId}},update:{department:'SKILLPATH',course:found.course.title,completed:true,examScore:quizScore,examPassed:true},create:{userId,department:'SKILLPATH',course:found.course.title,moduleId,completed:true,examScore:quizScore,examPassed:true}});
  return NextResponse.json({success:true,progress:saved,unlockedTopic:all[index+1]?{id:all[index+1].id,title:all[index+1].title}:null,courseCompleted:index===all.length-1});
 }
 return NextResponse.json({error:'Unknown action.'},{status:400});
 }catch(e){console.error('SkillPath API error',e);return NextResponse.json({error:'Unable to process this request.'},{status:500});}
}
