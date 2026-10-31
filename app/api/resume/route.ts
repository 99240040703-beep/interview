import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const skillGroups: Record<string, string[]> = {
  Languages: ['javascript','typescript','python','java','c++','c#','c','go','rust','php','ruby','kotlin','swift'],
  'Frontend': ['html','css','react','next.js','angular','vue','tailwind','bootstrap'],
  Backend: ['node.js','express','fastapi','django','spring','asp.net','rest api','graphql'],
  Database: ['sql','postgresql','mysql','mongodb','redis','firebase','prisma'],
  'Cloud & DevOps': ['aws','azure','gcp','docker','kubernetes','linux','git','github actions','ci/cd'],
  'Data & AI': ['machine learning','deep learning','pandas','numpy','tensorflow','pytorch','power bi','tableau'],
  'Core CS': ['data structures','algorithms','oops','object oriented programming','operating systems','computer networks','dbms']
};
const allSkills = [...new Set(Object.values(skillGroups).flat())];
const actionVerbs = ['built','developed','designed','implemented','created','led','managed','optimized','improved','automated','delivered','launched','engineered','deployed','analyzed','reduced','increased','collaborated','integrated','tested','maintained','architected','streamlined'];
const sectionPatterns: {name:string; aliases:string[]; weight:number; advice:string}[] = [
  {name:'Professional Summary',aliases:['summary','profile','objective','professional summary','career objective'],weight:8,advice:'Add a 2–3 line summary tailored to the role, highlighting your strongest skills and direction.'},
  {name:'Technical Skills',aliases:['skills','technical skills','technologies','core competencies'],weight:15,advice:'Group skills by category and list only technologies you can confidently discuss.'},
  {name:'Work Experience',aliases:['experience','work experience','employment','professional experience','internship'],weight:20,advice:'Describe each role with action verbs, your contribution, tools used and measurable outcomes.'},
  {name:'Projects',aliases:['projects','academic projects','personal projects','selected projects'],weight:18,advice:'Add 2–4 relevant projects with a short problem statement, your implementation, stack and a result or demo link.'},
  {name:'Education',aliases:['education','academic background','qualification'],weight:12,advice:'Include degree, institution, location and expected/completed graduation date.'},
  {name:'Certifications',aliases:['certifications','certificates','licenses'],weight:7,advice:'Add relevant certifications with issuer and completion date. Skip unrelated certificates.'},
  {name:'Achievements',aliases:['achievements','awards','honors','accomplishments'],weight:7,advice:'Include awards, competition results, publications or meaningful leadership outcomes.'},
  {name:'Additional Information',aliases:['activities','leadership','volunteering','languages','interests'],weight:5,advice:'Include relevant leadership, volunteering, languages or community contributions.'}
];
function hasHeading(text:string, aliases:string[]) {
  return aliases.some((a) => new RegExp('(^|\\n|\\s)' + a.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&') + '(\\s|:|$)', 'i').test(text));
}
function analyze(text:string, targetRole:string) {
  const lower=text.toLowerCase();
  const wordCount=(text.match(/\\b[\\w+#.-]+\\b/g)||[]).length;
  const found=allSkills.filter(s=>new RegExp('(^|[^a-z0-9+#.])'+s.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'([^a-z0-9+#.]|$)','i').test(text));
  const groups=Object.entries(skillGroups).map(([name,items])=>({name,skills:found.filter(s=>items.includes(s))})).filter(g=>g.skills.length);
  const sections=sectionPatterns.map(s=>({name:s.name,present:hasHeading(text,s.aliases),weight:s.weight,advice:s.advice}));
  const present=sections.filter(s=>s.present);
  const missing=sections.filter(s=>!s.present);
  const email= /[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i.test(text);
  const phone=/(?:\\+?\\d[\\d\\s().-]{7,}\\d)/.test(text);
  const linkedin=/linkedin\\.com\\/in\\//i.test(text);
  const github=/github\\.com\\//i.test(text);
  const portfolio=/(portfolio|behance\\.net|\w+\\.dev|vercel\\.app)/i.test(text);
  const quantified=(text.match(/\\b\\d+(?:\\.\\d+)?\\s?(?:%|percent|x|k|m|users|customers|projects|hours|days|weeks|months)\\b/gi)||[]).length;
  const bullets=(text.match(/^\\s*(?:[-*•▪]|\\d+[.)])\\s+/gm)||[]).length;
  const actionCount=actionVerbs.filter(v=>new RegExp('\\b'+v+'\\b','i').test(text)).length;
  const longLines=text.split(/\\r?\\n/).filter(line=>line.trim().length>220).length;
  const dates=/(19|20)\\d{2}/.test(text);
  const atsChecks=[
    {name:'Email address',passed:email,detail:email?'Contact email detected':'Add a professional email address'},
    {name:'Phone number',passed:phone,detail:phone?'Phone number detected':'Add a reachable phone number with country code'},
    {name:'LinkedIn profile',passed:linkedin,detail:linkedin?'LinkedIn URL detected':'Add your LinkedIn profile URL'},
    {name:'GitHub / code portfolio',passed:github||portfolio,detail:github||portfolio?'Portfolio or GitHub link detected':'Add GitHub or a portfolio link if relevant'},
    {name:'Clear section headings',passed:present.length>=4,detail:present.length>=4?'Multiple standard resume sections detected':'Use clear headings such as Education, Skills, Projects and Experience'},
    {name:'Readable bullet points',passed:bullets>=3,detail:bullets>=3?'Bullet-point formatting detected':'Use concise bullet points instead of long paragraphs'},
    {name:'Dates / timeline',passed:dates,detail:dates?'Year/date information detected':'Include dates for education, internships and employment'},
    {name:'Concise line length',passed:longLines<=3,detail:longLines<=3?'Most lines are concise':'Break very long lines into shorter achievement bullets'}
  ];
  const roleTerms:Record<string,string[]> = {
    'software engineer':['data structures','algorithms','oops','git','api','testing','sql'],
    'frontend developer':['html','css','javascript','typescript','react','responsive','accessibility'],
    'backend developer':['node.js','python','java','api','sql','database','authentication'],
    'data analyst':['sql','python','excel','power bi','tableau','statistics','pandas'],
    'data scientist':['python','sql','machine learning','statistics','pandas','numpy','tensorflow'],
    'full stack developer':['html','css','javascript','react','node.js','api','sql'],
    'devops engineer':['linux','docker','kubernetes','aws','ci/cd','git','monitoring'],
    'android developer':['kotlin','java','android','api','firebase','git']
  };
  const roleKey=Object.keys(roleTerms).find(k=>targetRole.toLowerCase().includes(k))||'';
  const roleKeywords=roleKey?roleTerms[roleKey]:[];
  const matchedRole=roleKeywords.filter(k=>lower.includes(k));
  const missingRole=roleKeywords.filter(k=>!lower.includes(k));
  const sectionScore=sections.reduce((sum,s)=>sum+(s.present?s.weight:0),0);
  const atsScore=Math.round(atsChecks.filter(c=>c.passed).length/atsChecks.length*100);
  const contentScore=Math.min(100,Math.round((Math.min(found.length,12)/12)*35+(Math.min(quantified,5)/5)*30+(Math.min(actionCount,8)/8)*20+(Math.min(bullets,8)/8)*15));
  const lengthScore=wordCount>=250&&wordCount<=900?100:wordCount<250?Math.round(wordCount/250*100):Math.max(45,100-(wordCount-900)/20);
  const score=Math.round(sectionScore*.35+atsScore*.25+contentScore*.3+lengthScore*.1);
  const recommendations:string[]=[];
  if(!email||!phone) recommendations.push('Complete your contact information with a professional email and phone number.');
  missing.slice(0,4).forEach(s=>recommendations.push(s.advice));
  if(quantified<2) recommendations.push('Quantify at least two achievements: show percentages, time saved, users served, performance gains or project scale.');
  if(actionCount<4) recommendations.push('Start bullets with strong action verbs such as Built, Automated, Optimized, Delivered or Led.');
  if(found.length<5) recommendations.push('Add a focused technical-skills section containing relevant tools you have actually used.');
  if(wordCount<250) recommendations.push('Your resume looks short. Add relevant project details, internship responsibilities and outcomes.');
  if(wordCount>900) recommendations.push('Consider reducing repetition and keeping the resume concise (often one page for students and early-career applicants).');
  if(targetRole&&roleKeywords.length&&missingRole.length) recommendations.push('For '+targetRole+', consider demonstrating these relevant keywords where truthful: '+missingRole.join(', ')+'.');
  const experienceLines=text.split(/\\r?\\n/).filter(l=>/\\b(built|developed|designed|implemented|managed|led|worked|intern|engineer|developer|analyst)\\b/i.test(l));
  const projectLines=text.split(/\\r?\\n/).filter(l=>/\\b(project|application|website|system|platform|app|dashboard)\\b/i.test(l));
  return {
    score,skills:found,skillGroups:groups,wordCount,
    metrics:{sectionScore,atsScore,contentScore,lengthScore,quantifiedAchievements:quantified,bulletPoints:bullets,actionVerbs:actionCount,sectionsFound:present.length,totalSections:sections.length},
    sections,atsChecks,
    contact:{email,phone,linkedin,githubOrPortfolio:github||portfolio},
    roleMatch:{targetRole,applicable:roleKeywords.length>0,matched:matchedRole,missing:missingRole},
    contentReview:{experienceEvidence:experienceLines.slice(0,5),projectEvidence:projectLines.slice(0,5),longLines},
    recommendations,
    feedback:score>=80?'Strong foundation. Polish role alignment and verify every achievement is specific and accurate.':score>=60?'Good starting point. Address the priority improvements below before applying.':'Several important resume elements need attention. Work through the recommendations and analyze again.'
  };
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const form=await req.formData();
    const file=form.get('file');
    const pasted=String(form.get('text')||'');
    const targetRole=String(form.get('targetRole')||'').trim().slice(0,100);
    let fileName='Pasted resume';
    let text=pasted;
    if(file instanceof File){
      fileName=file.name;
      if(file.size>5*1024*1024) return NextResponse.json({error:'File is too large. Please upload a file smaller than 5 MB.'},{status:413});
      const lowerName=file.name.toLowerCase();
      const buffer=Buffer.from(await file.arrayBuffer());
      if(lowerName.endsWith('.pdf')){
        // @ts-expect-error pdf-parse has no declaration for its internal parser entrypoint.
        const pdfModule=await import('pdf-parse/lib/pdf-parse.js');
        const pdfParse=pdfModule.default as (input:Buffer)=>Promise<{text:string}>;
        text=(await pdfParse(buffer)).text;
      } else if(lowerName.endsWith('.docx')){
        const mammoth=await import('mammoth');
        text=(await mammoth.extractRawText({buffer})).value;
      } else if(lowerName.endsWith('.txt')||lowerName.endsWith('.text')){
        text=buffer.toString('utf8');
      } else return NextResponse.json({error:'Unsupported file type. Please upload PDF, DOCX or TXT.'},{status:400});
    }
    text=text.trim();
    if(text.length<40) return NextResponse.json({error:'Could not extract enough text. Use a text-based PDF/DOCX or paste your resume text.'},{status:400});
    const result=analyze(text,targetRole);
    const resume=await db.resume.create({data:{userId,fileName,extracted:text.slice(0,20000),score:result.score,feedback:result.feedback}});
    return NextResponse.json({...resume,...result});
  } catch(error) {
    console.error('Resume analysis error:',error);
    return NextResponse.json({error:'Resume analysis failed. Try a standard text-based PDF or DOCX.'},{status:500});
  }
}
