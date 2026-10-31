'use client';

import { useEffect, useRef, useState } from 'react';

const quickPrompts = [
  'Explain a difficult topic simply',
  'Help me solve a coding problem',
  'Tell me about artificial intelligence',
  'Help me plan my studies',
];

export default function GlobalAIAssistant() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  async function ask(text = message) {
    const question = text.trim();
    if (!question || busy) return;
    setMessage(question);
    setBusy(true);
    setAnswer('');
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'general', messages: [{ role: 'user', content: question }] }),
      });
      if (!r.ok) { const data = await r.json(); setAnswer(data.error || 'AI could not answer right now.'); return; }
      setAnswer(await r.text() || 'AI could not answer right now.');
    } catch {
      setAnswer('The AI service is temporarily unavailable. You can still use the built-in learning tools.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && <button aria-label="Close AI assistant overlay" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1090, border: 0, background: 'rgba(15,23,42,.22)', backdropFilter: 'blur(3px)' }} />}

      <button onClick={() => setOpen(v => !v)} aria-label="Open AI learning assistant" title="Open AI AI Assistant" style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1100, width: 64, height: 64, border: '1px solid rgba(255,255,255,.75)', borderRadius: 20, cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#111827,#4f46e5,#0891b2)', boxShadow: '0 15px 40px rgba(79,70,229,.38)', fontSize: 25, fontWeight: 900 }}>{open ? '×' : '✦'}</button>

      {open && (
        <aside role="dialog" aria-label="AI Learning Assistant" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1095, width: 'min(450px, 100vw)', background: 'rgba(248,250,252,.98)', backdropFilter: 'blur(24px)', borderLeft: '1px solid #e2e8f0', boxShadow: '-24px 0 70px rgba(15,23,42,.18)', display: 'flex', flexDirection: 'column', animation: 'aiSlideIn .25s ease-out' }}>
          <style>{`@keyframes aiSlideIn{from{transform:translateX(100%);opacity:.6}to{transform:translateX(0);opacity:1}}@keyframes aiPulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>

          <div style={{ padding: '24px 21px 20px', color: '#fff', background: 'linear-gradient(135deg,#0f172a,#312e81 52%,#0369a1)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', right: -90, top: -105, background: 'rgba(255,255,255,.1)' }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 15, background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.22)', fontSize: 23 }}>🤖</div>
                <div><div style={{ fontSize: 11, letterSpacing: '.13em', fontWeight: 900, opacity: .72 }}>INTERVIEW AI</div><h2 style={{ margin: '4px 0 0', fontSize: 23 }}>Learning Assistant</h2><div style={{ fontSize: 11, marginTop: 4, opacity: .82 }}>● General-purpose AI companion</div></div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close assistant" style={{ border: 0, background: 'rgba(255,255,255,.12)', color: '#fff', width: 36, height: 36, borderRadius: 11, cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <p style={{ position: 'relative', margin: '15px 0 0', fontSize: 13, lineHeight: 1.6, opacity: .88 }}>Ask anything about education, science, technology, programming, careers, writing and everyday life.</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
            {!answer && !busy && <>
              <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 900, color: '#475569' }}>WHAT WOULD YOU LIKE TO ASK?</div>
              <div style={{ display: 'grid', gap: 9, marginBottom: 20 }}>
                {quickPrompts.map(prompt => <button key={prompt} onClick={() => ask(prompt)} style={{ textAlign: 'left', padding: '13px 14px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', color: '#334155', cursor: 'pointer', fontWeight: 750, boxShadow: '0 4px 14px rgba(15,23,42,.04)' }}>{prompt}<span style={{ float: 'right', color: '#6366f1', fontSize: 18 }}>→</span></button>)}
              </div>
              <div style={{ padding: 16, borderRadius: 17, background: 'linear-gradient(135deg,#eef2ff,#ecfeff)', border: '1px solid #dbeafe', color: '#334155', fontSize: 13, lineHeight: 1.65 }}><b>💡 Ask anything</b><br />For example: “I don't understand recursion”, “Fix this Java error”, “Give me 10 CSE interview questions”, or “Teach me SQL from basics.”</div>
            </>}

            {busy && <div style={{ padding: 18, borderRadius: 17, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 750 }}>✦ Thinking<span style={{ animation: 'aiPulse 1s infinite' }}>...</span><div style={{ marginTop: 8, fontSize: 12, fontWeight: 500 }}>Preparing a useful learning answer for you.</div></div>}

            {answer && <div><div style={{ fontSize: 11, fontWeight: 900, color: '#4f46e5', letterSpacing: '.1em', marginBottom: 9 }}>✦ AI LEARNING ANSWER</div><div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 17, boxShadow: '0 10px 28px rgba(15,23,42,.07)' }}><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, color: '#334155', fontSize: 14 }}>{answer}</div></div><button onClick={() => { setAnswer(''); setMessage(''); setTimeout(() => inputRef.current?.focus(), 50); }} style={{ marginTop: 12, border: 0, background: 'transparent', color: '#4f46e5', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>↻ Ask another question</button></div>}
          </div>

          <div style={{ padding: 15, borderTop: '1px solid #e2e8f0', background: 'rgba(255,255,255,.94)' }}>
            <textarea ref={inputRef} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder="Ask SkillPath AI anything..." maxLength={3000} rows={3} style={{ width: '100%', resize: 'none', padding: 14, border: '1px solid #cbd5e1', borderRadius: 15, outline: 'none', background: '#f8fafc', color: '#0f172a', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9, gap: 10 }}><span style={{ fontSize: 11, color: '#94a3b8' }}>Enter to send · Shift+Enter</span><button className="btn" onClick={() => ask()} disabled={busy || !message.trim()}>{busy ? 'Thinking…' : 'Ask AI ✨'}</button></div>
            <button onClick={() => { setAnswer(''); setMessage(''); }} style={{ marginTop: 9, border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Clear</button>
          </div>
        </aside>
      )}
    </>
  );
}
