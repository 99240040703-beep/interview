'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
const STORAGE_KEY = 'skillpath-ai-chat-v1';
const suggestions = [
  'Explain photosynthesis in simple words',
  'Teach me Python from beginner to advanced',
  'Solve this mathematics problem step by step',
  'How can I prepare for a software engineering interview?',
  'What is artificial intelligence and how does it work?',
  'Help me write a professional email',
];

export default function AssistantPage() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'general' | 'education'>('general');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-60));
      }
    } catch { /* Ignore invalid local chat history. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)));
  }, [messages, ready]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text = input) {
    const question = text.trim();
    if (!question || busy) return;
    const next: Message[] = [...messages, { id: crypto.randomUUID(), role: 'user', content: question }];
    const assistantId = crypto.randomUUID();
    setMessages([...next, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setError('Please sign in first to use SkillPath AI.');
        } else {
          setError(data.error || 'AI service is unavailable. Please try again.');
        }
        setMessages(next);
        return;
      }
      if (!response.body) throw new Error('The AI response stream was empty.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages(current => current.map(item => item.id === assistantId ? { ...item, content: answer } : item));
      }
      answer += decoder.decode();
      setMessages(current => current.map(item => item.id === assistantId ? { ...item, content: answer || 'I could not generate a response. Please try again.' } : item));
    } catch {
      setError('Could not connect to the AI service. Check your connection and try again.');
      setMessages(current => current.filter(item => item.id !== assistantId));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function clearChat() {
    if (busy) return;
    setMessages([]);
    setError('');
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="side-title">SKILLPATH</div>
        {[
          ['Overview', '/dashboard'],
          ['AI Assistant', '/assistant'],
          ['Project AI', '/project-ai'],
          ['AI Tutor & Coach', '/ai-coach'],
          ['Courses & Coding', '/skillpath'],
          ['All learning', '/learn'],
          ['Practice', '/practice'],
          ['Mock Interview', '/mock-interview'],
          ['Resume Analyzer', '/resume'],
          ['Placement Readiness', '/placement'],
          ['My Notes', '/notes'],
        ].map(([label, url]) => <a key={url} className={`side-link ${pathname === url ? 'active' : ''}`} href={url}>{label}</a>)}
      </aside>

      <main className="main" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="topline" style={{ alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">YOUR AI WORKSPACE</div>
            <h1 className="title" style={{ marginBottom: 5 }}>SkillPath AI</h1>
            <p className="muted" style={{ margin: 0 }}>Ask anything. Learn anything. Keep exploring.</p>
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="pill">AI CHAT</span>
            <button className="btn secondary" onClick={clearChat} disabled={!messages.length || busy}>New chat</button>
          </div>
        </div>

        <section className="card" style={{ flex: 1, minHeight: 520, display: 'flex', flexDirection: 'column', marginTop: 18, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div><b>AI Assistant</b><div className="muted" style={{ fontSize: 12 }}>A general-purpose AI for your questions and ideas</div></div>
            <div style={{ display: 'flex', padding: 4, borderRadius: 12, background: '#f1f5f9', gap: 3 }}>
              <button onClick={() => setMode('general')} style={{ border: 0, borderRadius: 9, padding: '8px 12px', cursor: 'pointer', fontWeight: 750, color: mode === 'general' ? '#312e81' : '#64748b', background: mode === 'general' ? '#fff' : 'transparent', boxShadow: mode === 'general' ? '0 1px 4px #cbd5e1' : 'none' }}>General</button>
              <button onClick={() => setMode('education')} style={{ border: 0, borderRadius: 9, padding: '8px 12px', cursor: 'pointer', fontWeight: 750, color: mode === 'education' ? '#312e81' : '#64748b', background: mode === 'education' ? '#fff' : 'transparent', boxShadow: mode === 'education' ? '0 1px 4px #cbd5e1' : 'none' }}>Education</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '22px clamp(14px, 4vw, 42px)', minHeight: 360 }}>
            {!messages.length ? (
              <div style={{ maxWidth: 780, margin: '5vh auto 30px' }}>
                <div style={{ width: 58, height: 58, display: 'grid', placeItems: 'center', borderRadius: 19, background: 'linear-gradient(135deg,#312e81,#0284c7)', color: '#fff', fontSize: 28, boxShadow: '0 12px 28px #c7d2fe' }}>✦</div>
                <h2 style={{ fontSize: 'clamp(25px,4vw,36px)', margin: '20px 0 8px', letterSpacing: '-.04em' }}>What can I help you with?</h2>
                <p className="muted" style={{ lineHeight: 1.7, marginBottom: 24 }}>Ask a question about studies, technology, coding, careers, writing, science, or everyday topics. Switch to Education mode for step-by-step teaching.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 10 }}>
                  {suggestions.map(item => <button key={item} onClick={() => void send(item)} disabled={busy} style={{ textAlign: 'left', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', color: '#334155', cursor: 'pointer', lineHeight: 1.5, fontWeight: 650 }}>{item}<span style={{ float: 'right', color: '#6366f1' }}>↗</span></button>)}
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: 850, margin: '0 auto', display: 'grid', gap: 20 }}>
                {messages.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start', gap: 10, alignItems: 'flex-start' }}>
                    {item.role === 'assistant' && <div style={{ flex: '0 0 34px', height: 34, display: 'grid', placeItems: 'center', borderRadius: 11, color: '#fff', background: 'linear-gradient(135deg,#312e81,#0284c7)' }}>✦</div>}
                    <div style={{ maxWidth: 'min(88%,740px)', padding: '13px 16px', borderRadius: 17, background: item.role === 'user' ? '#eef2ff' : '#fff', border: '1px solid ' + (item.role === 'user' ? '#c7d2fe' : '#e2e8f0'), color: '#1e293b', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.75, fontSize: 14 }}>
                      {item.content || (busy && item.role === 'assistant' ? 'Thinking…' : '')}
                    </div>
                    {item.role === 'user' && <div style={{ flex: '0 0 34px', height: 34, display: 'grid', placeItems: 'center', borderRadius: 11, background: '#e2e8f0', color: '#334155', fontWeight: 800 }}>You</div>}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
            {error && <div role="alert" style={{ maxWidth: 850, margin: '12px auto', padding: 13, borderRadius: 12, background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa', fontSize: 13 }}>{error}{error.includes('sign in') && <> <a href="/login" style={{ fontWeight: 800, textDecoration: 'underline' }}>Sign in</a></>}</div>}
          </div>

          <form onSubmit={submit} style={{ padding: '14px clamp(12px, 3vw, 28px) 18px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
            <div style={{ maxWidth: 850, margin: '0 auto', border: '1px solid #cbd5e1', borderRadius: 17, padding: 10, boxShadow: '0 5px 20px rgba(15,23,42,.05)' }}>
              <textarea ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={mode === 'education' ? 'Ask a question or tell me what you want to learn…' : 'Message SkillPath AI…'} rows={2} maxLength={6000} style={{ display: 'block', width: '100%', border: 0, outline: 'none', resize: 'vertical', minHeight: 54, maxHeight: 180, padding: 8, color: '#0f172a', background: 'transparent', lineHeight: 1.6, font: 'inherit' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 4px 0' }}>
                <span className="muted" style={{ fontSize: 11 }}>{mode === 'education' ? 'Step-by-step tutor mode' : 'General assistant mode'} · Enter to send</span>
                <button className="btn" type="submit" disabled={busy || !input.trim()}>{busy ? 'Thinking…' : 'Send ✦'}</button>
              </div>
            </div>
            <p className="muted" style={{ textAlign: 'center', fontSize: 11, margin: '8px 0 0' }}>AI can make mistakes. Verify important information.</p>
          </form>
        </section>
      </main>
    </div>
  );
}
