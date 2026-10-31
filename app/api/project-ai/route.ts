import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSessionUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Sign in to use your Project AI.', code: 'AUTH_REQUIRED' }, { status: 401 });

  try {
    const body = await req.json();
    const projectName = clean(body?.projectName, 160);
    const description = clean(body?.description, 1800);
    const context = clean(body?.context, 5000);
    const messages: ChatMessage[] = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-16)
      .map((m: any) => ({ role: m.role, content: clean(m.content, 5000) }))
      .filter((m: ChatMessage) => m.content.length > 0);

    if (!projectName || !messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'A project name and question are required.' }, { status: 400 });
    }

    const systemPrompt = `You are the dedicated AI engineer, tutor and project guide for the user's "${projectName}" project inside SkillPath. Project description: ${description || 'A student learning and engineering project.'}
Current learning context: ${context || 'No specific lesson selected.'}
Your job is to stay focused on this project while still answering related general questions. Explain in clear student-friendly language. Help with requirements, architecture, step-by-step implementation, hardware and software selection, wiring, code generation, debugging, testing, documentation, diagrams described in text, viva questions and improvements. For hardware, explicitly state voltage/current compatibility, common ground, pin limitations and safety precautions; never invent a board pinout. For code, state language, dependencies and where each file belongs. Ask one concise clarification only when essential. If a request is unrelated, answer briefly and guide back to the project. Be honest about uncertainty and never claim to have tested hardware or deployed code. Do not claim live web research.`;

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    let answer = '';
    let provider = '';

    if (geminiKey) {
      const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
      const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.45, maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      const result: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Project AI Gemini error', response.status, result?.error?.status || result?.error?.message || 'Unknown provider error');
        if (!openaiKey) {
          const status = response.status === 429 ? 503 : 502;
          return NextResponse.json({ error: response.status === 429 ? 'Gemini API quota or rate limit reached. Check your Google AI Studio API usage and billing.' : 'Gemini could not answer. Check the Gemini API key and model setting in Render.', code: 'GEMINI_REQUEST_FAILED' }, { status });
        }
      } else {
        answer = (result?.candidates?.[0]?.content?.parts || []).map((p: any) => typeof p.text === 'string' ? p.text : '').join('').trim();
        if (answer) provider = 'Gemini';
      }
    }

    if (!answer && openaiKey) {
      try {
        const client = new OpenAI({ apiKey: openaiKey });
        const completion = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
          temperature: 0.45,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        });
        answer = completion.choices[0]?.message?.content?.trim() || '';
        if (answer) provider = 'OpenAI';
      } catch (error: any) {
        console.error('Project AI OpenAI error', error?.status, error?.code || error?.message);
        if (!geminiKey) {
          if (error?.status === 429 || error?.code === 'insufficient_quota') {
            return NextResponse.json({ error: 'OpenAI API credits are exhausted. Add Gemini API key in Render or add OpenAI API credits.', code: 'AI_QUOTA_EXHAUSTED' }, { status: 503 });
          }
          return NextResponse.json({ error: 'The AI provider could not answer. Check the provider key and usage limits in Render.', code: 'AI_PROVIDER_ERROR' }, { status: 503 });
        }
      }
    }

    if (!answer) return NextResponse.json({ error: 'No AI provider is ready. Add GEMINI_API_KEY in the Render environment variables, then redeploy.', code: 'AI_NOT_CONFIGURED' }, { status: 503 });
    return NextResponse.json({ answer, provider });
  } catch (error: any) {
    console.error('Project AI request failed', error?.name || 'Error', error?.message || '');
    return NextResponse.json({ error: error?.name === 'TimeoutError' ? 'The AI took too long to respond. Please try again.' : 'Project AI is temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
