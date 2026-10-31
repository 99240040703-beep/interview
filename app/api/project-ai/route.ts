import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSessionUserId } from '@/lib/auth';
import { courseById } from '@/lib/skillpath-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Message = { role: 'user' | 'assistant'; content: string };

function buildSystemPrompt(course: any, moduleTitle: string, topicTitle: string, projectName: string) {
  return `You are Project AI, a dedicated technical mentor assigned ONLY to this student's selected project workspace.
Project: ${projectName || course.title}
Learning track: ${course.title} (${course.category})
Description: ${course.description}
Current module: ${moduleTitle || 'Not selected'}
Current topic: ${topicTitle || 'Not selected'}

Help the student plan, build, understand, debug, test, document and present this project. Adapt to their level and explain in clear, practical steps. For software projects, provide architecture, folder structure, complete code when requested, setup commands, API/database design, debugging steps, tests and deployment guidance. For electronics/IoT projects, provide component lists, pin-by-pin wiring tables, power and voltage cautions, firmware, serial debugging and verification steps. For data/AI projects, explain datasets, preprocessing, models, evaluation and reproducible workflows. For academic projects, help with abstract, objectives, methodology, diagrams, results and viva questions.

Keep answers specific to the selected project. Ask one focused question only when essential details are missing. Never claim code was run, hardware tested, files changed, or deployment completed unless that actually happened. Do not invent component pinouts or electrical ratings; flag uncertainty and safety risks. If the student asks an unrelated general question, answer briefly and guide them back to the project when appropriate. Use headings and numbered steps for implementation. `;
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Sign in to use Project AI.', code: 'AUTH_REQUIRED' }, { status: 401 });

  try {
    const body = await req.json();
    const courseId = String(body?.courseId || '').slice(0, 100);
    const course = courseById(courseId);
    if (!course) return NextResponse.json({ error: 'Choose a valid project or learning track.' }, { status: 400 });

    const requestedModule = String(body?.moduleTitle || '').slice(0, 180);
    const requestedTopic = String(body?.topicTitle || '').slice(0, 180);
    const matchedModule = course.modules.find((m: any) => m.title === requestedModule);
    const matchedTopic = matchedModule?.topics.find((t: any) => t.title === requestedTopic);
    const moduleTitle = matchedModule?.title || '';
    const topicTitle = matchedTopic?.title || '';
    const projectName = String(body?.projectName || course.title).slice(0, 180);
    const messages: Message[] = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-16)
      .map((m: any) => ({ role: m.role, content: m.content.trim().slice(0, 5000) }))
      .filter((m: Message) => m.content.length > 0);

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'Type a project question first.' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(course, moduleTitle, topicTitle, projectName);
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    if (geminiKey) {
      const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Project AI Gemini error', response.status, data?.error?.message || 'unknown');
        const detail = response.status === 429
          ? 'Gemini rate limit or quota reached. Check your Google AI Studio quota.'
          : response.status === 400 || response.status === 404
            ? 'Gemini rejected the model or request. Check GEMINI_MODEL and your API key.'
            : 'Gemini could not answer. Check the Gemini API key and provider status.';
        return NextResponse.json({ error: detail, code: 'AI_PROVIDER_ERROR' }, { status: 503 });
      }
      const answer = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim();
      if (!answer) return NextResponse.json({ error: 'Gemini returned an empty answer. Please try again.' }, { status: 503 });
      return NextResponse.json({ answer, provider: 'Gemini' });
    }

    if (openaiKey) {
      try {
        const client = new OpenAI({ apiKey: openaiKey });
        const result = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
          temperature: 0.4,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        });
        const answer = result.choices[0]?.message?.content;
        if (typeof answer === 'string' && answer.trim()) return NextResponse.json({ answer: answer.trim(), provider: 'OpenAI' });
      } catch (error: any) {
        console.error('Project AI OpenAI error', error?.status, error?.code || error?.message);
        if (error?.status === 429 || error?.code === 'insufficient_quota') {
          return NextResponse.json({ error: 'OpenAI API quota is exhausted. Add API credits or configure GEMINI_API_KEY in Render.', code: 'AI_QUOTA_EXHAUSTED' }, { status: 503 });
        }
      }
    }

    return NextResponse.json({
      error: 'Project AI is not configured. Add GEMINI_API_KEY to the Render service environment variables, then redeploy. Keep the key private.',
      code: 'AI_NOT_CONFIGURED',
    }, { status: 503 });
  } catch (error: any) {
    console.error('Project AI request failed', error?.message || error);
    return NextResponse.json({ error: 'Project AI could not process this question. Please try again.' }, { status: 503 });
  }
}
