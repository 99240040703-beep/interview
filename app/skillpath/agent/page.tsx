'use client';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { COURSES } from '@/lib/skillpath-catalog';
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
const langs = ['Python','C','C++','Java','JavaScript','TypeScript','C#','Go','Rust','PHP','Ruby','Kotlin','Swift'];

export default function SkillPathAgentPage() {
  const [courseId,setCourseId] = useState('python');
  const [topicId,setTopicId] = useState('');
  const [mode,setMode] = useState('teach');
  const [language,setLanguage] = useState('Python');
  const [message,setMessage] = useState('');
  const [code,setCode] = useState('');
  const [stdin,setStdin] = useState('');
  const [answer,setAnswer] = useState('');
  const [history,setHistory] = useState<{role:'user'|'assistant';content:string}[]>([]);
  const [nextSteps,setNextSteps] = useState<string[]>([]);
  const [suggestions,setSuggestions] = useState<string[]>([]);
  const [busy,setBusy] = useState(false);
  const [running,setRunning] = useState(false);
  const [output,setOutput] = useState('');
  const [error,setError] = useState('');
  const course = useMemo(() => COURSES.find((c:any) => c.id === courseId),[courseId]);
  const topics = useMemo(() => course?.modules.flatMap((m:any) => m.topics.map((t:any) => ({...t,moduleTitle:m.title}))) || [],[course]);
  async function ask(action=mode, prompt=message) {
    setBusy(true); setError(''); setAnswer(''); setOutput('');
    try {
      const r = await fetch('/api/skillpath/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseId,topicId,mode:action,message:prompt,language,code,history:history.slice(-8)})});
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Agent request failed.');
      setAnswer(d.answer || ''); setNextSteps(d.nextSteps || []); setSuggestions(d.suggestions || []); setHistory([...history,{role:'user',content:prompt || 'Build my course plan / suggest next steps.'},{role:'assistant',content:d.answer || ''}].slice(-8));
      if(d.code) setCode(d.code); setMessage('');
    } catch(e:any) { setError(e.message || 'Could not contact the agent.'); }
    finally { setBusy(false); }
  }
  async function run() {
    setRunning(true); setOutput(''); setError('');
    try {
      const r = await fetch('/api/skillpath/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,code,stdin})});
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Execution failed.');
      setOutput((d.stdout || '(no output)') + (d.stderr ? '\n' + d.stderr : '') + '\nExit code: ' + d.exitCode);
    } catch(e:any) { setError(e.message || 'Execution failed.'); }
    finally { setRunning(false); }
  }
  return <div className="dashboard">
    <aside className="sidebar"><div className="side-title">SKILLPATH AI</div>
      { [['Dashboard','/dashboard'],['Courses','/skillpath'],['Learning Agent','/skillpath/agent'],['AI Tutor','/ai-coach'],['Practice','/practice']].map(([label,url]) => <a key={url} className={url==='/skillpath/agent'?'side-link active':'side-link'} href={url}>{label}</a>) }
    </aside>
    <main className="main">
      <div className="topline"><div><div className="eyebrow">PERSONAL COURSE MENTOR</div><h1 className="title">SkillPath Learning Agent</h1><p className="muted">Learn every topic, build a course plan, write code, debug it and get recommendations.</p></div><a className="btn secondary" href="/skillpath">Back to courses</a></div>
      <div className="grid" style={{gridTemplateColumns:'minmax(250px,.75fr) minmax(0,1.5fr)',marginTop:18}}>
        <section className="card"><h2>Learning setup</h2>
          <label className="field-label">Course<select value={courseId} onChange={e=>{setCourseId(e.target.value);setTopicId('');setAnswer('');}}>{COURSES.map((c:any)=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
          <label className="field-label">Topic<select value={topicId} onChange={e=>setTopicId(e.target.value)}><option value="">Whole course / next topic</option>{topics.map((t:any)=><option key={t.id} value={t.id}>{t.moduleTitle} · {t.title}</option>)}</select></label>
          <label className="field-label">Code language<select value={language} onChange={e=>setLanguage(e.target.value)}>{langs.map(l=><option key={l}>{l}</option>)}</select></label>
          <p className="field-label">Agent mode</p>
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr',gap:8}}>
            { [['teach','Teach'],['study-plan','Full course plan'],['code','Generate code'],['debug','Debug code'],['quiz','Quiz me'],['project','Project guide'],['suggest','Suggest next']].map(([v,l])=><button key={v} className={mode===v?'btn':'btn secondary'} onClick={()=>setMode(v)}>{l}</button>) }
          </div>
          <button className="btn secondary" style={{marginTop:12}} disabled={busy} onClick={()=>ask('study-plan','Build a complete roadmap for this course.')}>Build entire course roadmap</button>
          <button className="btn secondary" style={{marginTop:8}} disabled={busy} onClick={()=>ask('suggest','Review my progress and suggest the next best steps.')}>Suggest what to learn next</button>
        </section>
        <section className="card"><span className="pill">AI COURSE MENTOR</span><h2>{course?.title}</h2>
          <textarea rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ask: Teach me this topic with examples, then give me practice problems."/>
          <button className="btn" disabled={busy} onClick={()=>ask()}>{busy?'Preparing your lesson…':'Ask SkillPath Agent'}</button>
          {error && <p className="danger">{error}</p>}
          {answer && <div className="notice" style={{marginTop:14}}><h3>Agent response</h3><div style={{whiteSpace:'pre-wrap',lineHeight:1.7}}>{answer}</div></div>}
          {nextSteps.length>0 && <div className="notice"><h3>Next steps</h3>{nextSteps.map((s,i)=><p key={i}>{i+1}. {s}</p>)}</div>}
          {suggestions.length>0 && <div className="notice"><h3>Suggestions</h3>{suggestions.map((s,i)=><p key={i}>• {s}</p>)}</div>}
        </section>
      </div>
      <section className="card" style={{marginTop:18}}><h2>Code workspace</h2><p className="muted">Ask the agent to generate or debug code, edit it and run it in the existing sandbox.</p>
        <Editor height="380px" language={language==='C++'?'cpp':language.toLowerCase()} theme="vs-dark" value={code} onChange={v=>setCode(v||'')} options={{fontSize:14,minimap:{enabled:false},automaticLayout:true}}/>
        <label className="field-label">Program input<textarea rows={2} value={stdin} onChange={e=>setStdin(e.target.value)} placeholder="Enter stdin…" /></label>
        <button className="btn" disabled={running||!code.trim()} onClick={run}>{running?'Running…':'Run code'}</button>
        {output && <pre className="notice" style={{whiteSpace:'pre-wrap'}}>{output}</pre>}
      </section>
    </main>
  </div>;
}
