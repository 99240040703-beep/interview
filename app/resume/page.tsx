'use client';
import { useState, type ReactNode } from 'react';

type Analysis = {
  id:string; score:number; skills:string[]; skillGroups:{name:string;skills:string[]}[];
  wordCount:number; feedback:string; recommendations:string[];
  metrics:{sectionScore:number;atsScore:number;contentScore:number;lengthScore:number;quantifiedAchievements:number;bulletPoints:number;actionVerbs:number;sectionsFound:number;totalSections:number};
  sections:{name:string;present:boolean;weight:number;advice:string}[];
  atsChecks:{name:string;passed:boolean;detail:string}[];
  contact:{email:boolean;phone:boolean;linkedin:boolean;githubOrPortfolio:boolean};
  roleMatch:{targetRole:string;applicable:boolean;matched:string[];missing:string[]};
  contentReview:{experienceEvidence:string[];projectEvidence:string[];longLines:number};
};
function Meter({value}:{value:number}){return <div className="progress"><span style={{width:value+'%'}}/></div>}
function Panel({title,children,sub}:{title:string;children:ReactNode;sub?:string}){return <section className="card" style={{marginTop:18}}><h2 style={{fontSize:19,margin:'0 0 6px'}}>{title}</h2>{sub&&<p className="muted" style={{marginTop:0}}>{sub}</p>}{children}</section>}
export default function Resume(){
  const [file,setFile]=useState<File|null>(null);
  const [text,setText]=useState('');
  const [targetRole,setTargetRole]=useState('Software Engineer');
  const [result,setResult]=useState<Analysis|null>(null);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  async function analyze(){
    if(!file&&!text.trim()){setMsg('Choose a PDF/DOCX/TXT file or paste your resume.');return;}
    setBusy(true);setMsg('Extracting resume and checking ATS, sections, skills and achievements…');setResult(null);
    try{
      const form=new FormData();if(file)form.append('file',file);if(text.trim())form.append('text',text);form.append('targetRole',targetRole);
      const response=await fetch('/api/resume',{method:'POST',body:form});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Analysis failed.');
      setResult(data);setMsg('Detailed resume report generated and saved.');
    }catch(error){setMsg(error instanceof Error?error.message:'Could not analyze this resume.');}
    finally{setBusy(false);}
  }
  return <main className="container">
    <nav className="nav"><b className="brand">INTERVIEW</b><div className="navlinks"><a href="/dashboard">Dashboard</a><a href="/placement">Readiness</a></div></nav>
    <div style={{maxWidth:1000,margin:'34px auto'}}>
      <div className="eyebrow">Career toolkit · ATS & career review</div>
      <h1 className="title">Resume Analyzer</h1>
      <p className="muted" style={{lineHeight:1.7,maxWidth:780}}>Get a structured review of resume quality, ATS readability, section completeness, technical skills, measurable achievements and role-specific keywords. The report is based on the text extracted from your resume.</p>
      <div className="card" style={{marginTop:20}}>
        <h2 style={{marginTop:0}}>1. Add your resume</h2>
        <label style={{display:'block',fontWeight:750,marginBottom:8}}>Target job role</label>
        <input value={targetRole} onChange={e=>setTargetRole(e.target.value)} placeholder="e.g. Frontend Developer, Data Analyst" style={{width:'100%',padding:12,border:'1px solid #ccd3dd',borderRadius:10,marginBottom:16}}/>
        <label style={{display:'block',fontWeight:750,marginBottom:8}}>Upload file (PDF, DOCX or TXT · max 5 MB)</label>
        <input type="file" accept=".pdf,.docx,.txt" onChange={e=>setFile(e.target.files?.[0]||null)} style={{display:'block',marginBottom:18}}/>
        {file&&<p className="muted" style={{fontSize:13}}>Selected: {file.name} · {(file.size/1024).toFixed(0)} KB</p>}
        <div style={{textAlign:'center',color:'#667085',fontWeight:700,margin:'12px 0'}}>OR</div>
        <label style={{display:'block',fontWeight:750,marginBottom:8}}>Paste resume text</label>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Paste the full resume text here…" style={{width:'100%',minHeight:180,padding:13,border:'1px solid #ccd3dd',borderRadius:10,resize:'vertical'}}/>
        <button className="btn" disabled={busy} onClick={analyze} style={{marginTop:16}}>{busy?'Analyzing resume…':'Generate detailed report'}</button>
        {msg&&<p className="toast" role="status">{msg}</p>}
      </div>
      {result&&<>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'end',gap:12,flexWrap:'wrap',marginTop:30}}>
          <div><div className="eyebrow">Your analysis report</div><h2 style={{fontSize:27,margin:'5px 0'}}>Resume health overview</h2><p className="muted" style={{margin:0}}>{result.wordCount} words · {result.metrics.sectionsFound}/{result.metrics.totalSections} sections detected · Role: {targetRole||'General review'}</p></div>
          <button className="btn secondary" onClick={()=>window.print()}>Print / Save as PDF</button>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',marginTop:16}}>
          <div className="card"><span className="muted">Overall score</span><div className="score-ring">{result.score}<small style={{fontSize:16}}>/100</small></div><Meter value={result.score}/><p className="muted" style={{fontSize:13}}>{result.feedback}</p></div>
          {[
            ['ATS readiness',result.metrics.atsScore],['Content strength',result.metrics.contentScore],['Section coverage',result.metrics.sectionScore],['Length & structure',result.metrics.lengthScore]
          ].map(([label,value])=><div className="card" key={label}><span className="muted">{label}</span><div className="score-ring">{value}<small style={{fontSize:16}}>/100</small></div><Meter value={Number(value)}/></div>)}
        </div>
        <Panel title="2. ATS compatibility checklist" sub="Basic text-based checks that help identify common resume parsing issues. This is not a guarantee of passing any employer's ATS.">
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
            {result.atsChecks.map(c=><div key={c.name} style={{padding:'12px 0',borderBottom:'1px solid #edf0f4'}}><b style={{color:c.passed?'#067647':'#b54708'}}>{c.passed?'✓':'!'} {c.name}</b><div className="muted" style={{fontSize:13,marginTop:4}}>{c.detail}</div></div>)}
          </div>
        </Panel>
        <Panel title="3. Section-by-section review" sub="Detected sections and what to improve.">
          <div className="list">{result.sections.map(s=><div className="list-row" key={s.name} style={{alignItems:'start',gap:15}}><div><b>{s.present?'✓':'○'} {s.name}</b><div className="muted" style={{fontSize:13,marginTop:5}}>{s.present?'Section heading detected. Review its content for relevance and evidence.':s.advice}</div></div><span className="pill" style={{background:s.present?'#dcfce7':'#fff4e5',color:s.present?'#166534':'#9a3412'}}>{s.present?'Found':'Missing'} · {s.weight} pts</span></div>)}</div>
        </Panel>
        <Panel title="4. Technical skills detected" sub="Only include technologies you have genuinely used and can explain in an interview.">
          {result.skillGroups.length?result.skillGroups.map(g=><div key={g.name} style={{marginBottom:14}}><b>{g.name}</b><div className="actions" style={{marginTop:8}}>{g.skills.map(s=><span className="pill" key={s}>{s}</span>)}</div></div>):<p className="muted">No known technical skills were detected. Add a clearly labeled skills section.</p>}
          <p className="muted" style={{fontSize:13}}>Detected {result.skills.length} skills from the analyzer's current keyword library.</p>
        </Panel>
        <Panel title="5. Target-role keyword match" sub={result.roleMatch.applicable?'Compare your resume with common keywords for this role. Add missing terms only when they accurately describe your experience.':'No preset keyword profile for this role yet. The general resume checks are still available.'}>
          {result.roleMatch.applicable&&<><p><b>{result.roleMatch.matched.length}</b> matching keywords · <b>{result.roleMatch.missing.length}</b> not detected</p><div className="actions">{result.roleMatch.matched.map(s=><span className="pill" key={s}>{s} ✓</span>)}{result.roleMatch.missing.map(s=><span className="pill" key={s} style={{background:'#fff4e5',color:'#9a3412'}}>{s} · missing</span>)}</div></>}
        </Panel>
        <Panel title="6. Experience & project evidence" sub="Potential lines identified by keyword scanning. Confirm these are real accomplishments and rewrite them with context and outcomes.">
          <h3 style={{fontSize:15}}>Experience-related lines</h3>{result.contentReview.experienceEvidence.length?result.contentReview.experienceEvidence.map((line,i)=><p className="notice" key={i}>{line}</p>):<p className="muted">No obvious experience-related lines detected. Add internship, work or relevant practical experience if available.</p>}
          <h3 style={{fontSize:15,marginTop:18}}>Project-related lines</h3>{result.contentReview.projectEvidence.length?result.contentReview.projectEvidence.map((line,i)=><p className="notice" key={i}>{line}</p>):<p className="muted">No obvious project-related lines detected. Add project names, technologies, your role and outcomes.</p>}
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',marginTop:16}}>
            {[['Bullet points',result.metrics.bulletPoints],['Action verbs',result.metrics.actionVerbs],['Quantified achievements',result.metrics.quantifiedAchievements],['Long lines',result.contentReview.longLines]].map(([k,v])=><div className="card" key={k}><span className="muted">{k}</span><div className="score-ring">{v}</div></div>)}
          </div>
        </Panel>
        <Panel title="7. Priority improvement plan" sub="Work through these suggestions, update your resume and analyze it again.">
          {result.recommendations.length?<ol style={{paddingLeft:22,lineHeight:1.8}}>{result.recommendations.map((r,i)=><li key={i} style={{padding:'5px 0'}}>{r}</li>)}</ol>:<p className="success">No major checklist gaps were detected. Proofread carefully and tailor the resume to each vacancy.</p>}
        </Panel>
        <p className="muted" style={{fontSize:12,margin:'18px 4px'}}>Scoring is a rule-based guidance estimate, not an employer ATS score or hiring prediction. It cannot verify whether claims are true, and image-only/scanned PDFs may not extract correctly.</p>
      </>}
    </div>
  </main>;
}
