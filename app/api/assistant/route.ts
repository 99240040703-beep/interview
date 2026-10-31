import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSessionUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Please sign in to use SkillPath AI.', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        error: 'The AI provider is not configured yet. Add OPENAI_API_KEY to the Render service environment variables, then redeploy.',
        code: 'AI_NOT_CONFIGURED',
      }, { status: 503 });
    }

    const body = await req.json();
    const mode = body?.mode === 'education' ? 'education' : 'general';
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages: ChatMessage[] = rawMessages
      .filter((item: any) => (item?.role === 'user' || item?.role === 'assistant') && typeof item?.content === 'string')
      .slice(-20)
      .map((item: any) => ({ role: item.role, content: item.content.trim().slice(0, 6000) }))
      .filter((item: ChatMessage) => item.content.length > 0);

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'Enter a question before sending.' }, { status: 400 });
    }

    const systemPrompt = mode === 'education'
      ? 'You are SkillPath AI, a patient expert tutor. Teach any academic or technical subject clearly. Start with a simple explanation, then build step by step. Use examples, equations, small code examples, analogies, and short summaries when useful. For problem solving, show the reasoning and method, not only the final answer. Adapt to the learner level. If the user asks about a non-education topic, answer it normally. Be accurate and say when something is uncertain.'
      : 'You are SkillPath AI, a capable, friendly general-purpose assistant. Answer questions across education, science, technology, programming, writing, careers, daily life, and other appropriate topics. Give useful detail, clear structure, examples, and practical next steps. Do not pretend to have browsed the live web or performed actions you have not done. Be honest about uncertainty.';

    const client = new OpenAI({ apiKey });
    const stream = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0.5,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (typeof content === 'string' && content.length) controller.enqueue(encoder.encode(content));
          }
        } catch (error) {
          console.error('SkillPath AI stream error', error);
          controller.enqueue(encoder.encode('\n\n[The response was interrupted. Please try again.]'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('SkillPath AI request error', error);
    return NextResponse.json({ error: 'SkillPath AI could not answer right now. Please try again.' }, { status: 503 });
  }
}
