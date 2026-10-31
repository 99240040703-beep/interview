'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Course = { id: string; title: string; category: string; level: string; description: string };
type Module = { id: string; title: string; topics: { id: string; title: string; objective: string }[] };
type Message = { role: 'user' | 'assistant'; content: string };

export default function ProjectAIPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/skillpath').then(async r => {
      if (r.status === 401) throw new Error('Please sign in to open Project AI.');
      if (!r.ok) throw new Error('Could not load project list.');
      return r.json();
    }).then(data => {
      const list: Course[] = data.courses || [];
      setCourses(list);
      const requested = new URLSearchParams(window.location.search).get('course') || '';
      const initial = list.find(c => c.id === requested) || list[0];
      if (initial) setCourseId(initial.id);
    }).catch(e => setError(e.message || 'Could not load projects.')).finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => courses.find(c => c.id === courseId), [courses, courseId]);
  const [courseDetail, setCourseDetail] = useState<{ modules: Module[] } | null>(null);
  const modules = courseDetail?.modules || [];
  const selectedModule = modules.find(m => m.id === moduleId) || modules[0];
  const selectedTopic = selectedModule?.topics.find(t => t.id === topicId);

  useEffect(() => {
    if (!courseId) return;
    setMessages([]);
    setProvider('');
    setModuleId('');
    setTopicId('');
    setProjectName(courses.find(c => c.id === courseId)?.title || '');
    const key = 'skillpath-project-ai-' + courseId;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-40));
      }
    } catch { /* Ignore invalid local chat history. */ }
    fetch('/api/skillpath?course=' + encodeURIComponent(courseId))
      .then(r => r.ok ? r.json() : null)
      .then(data => setCourseDetail(data?.course || null));
  }, [courseId, courses]);

  useEffect(() => {
    if (courseId) localStorage.setItem('skillpath-project-ai-' + courseId, JSON.stringify(messages.slice(-40)));
  }, [courseId, messages]);

  function clearChat() {
    setMessages([]);
    setError('');
    setProvider('');
    if (courseId) localStorage.removeItem('skillpath-project-ai-' + courseId);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy || !selected) return;
    const next = [...messages, { role: 'user' as const, content: question }];
    setMessages(next);
    setInput('');
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/project-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          projectName: projectName.trim() || selected.title,
          moduleTitle: selectedModule?.title || '',
          topicTitle: selectedTopic?.title || '',
          messages: next,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessages(messages);
        setError(data.error || 'Project AI is temporarily unavailable.');
        return;
      }
      setProvider(data.provider || '');
      setMessages([...next, { role: 'assistant', content: data.answer }]);
    } catch {
      setMessages(messages);
      setError('Could not connect to Project AI. Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="empty">Loading your project workspaces…</div>;

  return <main className="container">
    <nav className="nav"><a className="brand" href="/dashboard">SKILLPATH AI</a><div className="navlinks"><a href="/skillpath">Courses & Coding</a><a href="/assistant">General AI</a><a href="/dashboard">Dashboard</a></div></nav>
    <div className="topline" style={{ marginTop: 24, alignItems: 'center' }}>
      <div><div className="eyebrow">DEDICATED PROJECT WORKSPACE</div><h1 className="title">Project AI</h1><p className="muted">A separate technical mentor for each course and project. Project conversations stay separate.</p></div>
      <span className="pill">PROJECT-SCOPED AI</span>
    </div>

    {error && !selected && <div className="notice" style={{ marginTop: 16 }}><p className="danger">{error}</p><a className="btn secondary" href="/login">Sign in</a></div>}

    {selected && <div className="grid" style={{ gridTemplateColumns: 'minmax(250px, 0.8fr) minmax(0, 1.8fr)', alignItems: 'start', marginTop: 18 }}>
      <aside className="card">
        <span className="pill">PROJECT SETTINGS</span>
        <h2 style={{ marginTop: 12 }}>Choose a project</h2>
        <label style={{ display: 'block', fontWeight: 700, marginTop: 12 }}>Project / course
          <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 7, padding: 11, border: '1px solid #cbd5e1', borderRadius: 9 }}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label style={{ display: 'block', fontWeight: 700, marginTop: 14 }}>Project name
          <input value={projectName} onChange={e => setProjectName(e.target.value)} maxLength={180} placeholder="Give this project a name" style={{ display: 'block', width: '100%', marginTop: 7, padding: 11, border: '1px solid #cbd5e1', borderRadius: 9 }} />
        </label>
        <label style={{ display: 'block', fontWeight: 700, marginTop: 14 }}>Module
          <select value={moduleId || selectedModule?.id || ''} onChange={e => { setModuleId(e.target.value); setTopicId(''); }} style={{ display: 'block', width: '100%', marginTop: 7, padding: 11, border: '1px solid #cbd5e1', borderRadius: 9 }}>
            <option value="">General project help</option>
            {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </label>
        {selectedModule && <label style={{ display: 'block', fontWeight: 700, marginTop: 14 }}>Topic
          <select value={topicId} onChange={e => setTopicId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 7, padding: 11, border: '1px solid #cbd5e1', borderRadius: 9 }}>
            <option value="">All topics</option>
            {selectedModule.topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>}
        <div className="notice" style={{ marginTop: 18 }}>
          <b>{selected.title}</b><p className="muted">{selected.description}</p><small className="muted">{selected.category} · {selected.level}</small>
        </div>
        <button className="btn secondary" style={{ marginTop: 12, width: '100%' }} onClick={clearChat}>Clear this project's chat</button>
      </aside>

      <section className="card" style={{ minHeight: 650, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 14 }}>
          <div><b>{projectName || selected.title} AI</b><div className="muted" style={{ fontSize: 12 }}>{selectedModule?.title || 'Project planning, building and debugging'}{selectedTopic ? ' · ' + selectedTopic.title : ''}</div></div>
          {provider && <span className="pill">{provider}</span>}
        </div>
        <div style={{ flex: 1, minHeight: 360, padding: '16px 2px', overflowY: 'auto' }}>
          {!messages.length && <div className="empty"><h2>Start building with your Project AI</h2><p>Ask for a project plan, architecture, components, wiring, code, error fixing, testing, report or viva preparation.</p><div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', marginTop: 18 }}>
            {['Create a complete project roadmap with milestones','List all components and explain each connection','Generate the starter code and explain how to run it','Help me debug an error in my project'].map(q => <button key={q} className="btn secondary" style={{ whiteSpace: 'normal', textAlign: 'left' }} onClick={() => setInput(q)}>{q}</button>)}
          </div></div>}
          {messages.map((m, i) => <div key={i} style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: m.role === 'user' ? '#eef2ff' : '#f8fafc', border: '1px solid #e2e8f0' }}><b>{m.role === 'user' ? 'You' : (projectName || selected.title) + ' AI'}</b><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 0 }}>{m.content}</p></div>)}
          {busy && <div className="notice">Project AI is preparing your answer…</div>}
        </div>
        {error && <div className="notice" style={{ marginBottom: 10 }}><p className="danger">{error}</p></div>}
        <form onSubmit={send} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={3} maxLength={5000} placeholder={'Ask ' + (projectName || selected.title) + ' AI anything about this project…'} style={{ width: '100%', padding: 13, border: '1px solid #cbd5e1', borderRadius: 12, resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 9, alignItems: 'center' }}><small className="muted">Project context is included with every question.</small><button className="btn" disabled={busy || !input.trim()}>{busy ? 'Thinking…' : 'Ask Project AI →'}</button></div>
        </form>
      </section>
    </div>}
    {!selected && !error && <div className="empty">No courses found. Open Courses & Coding to load your learning tracks.</div>}
  </main>;
}
