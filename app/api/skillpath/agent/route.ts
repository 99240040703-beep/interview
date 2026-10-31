import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { COURSES, courseById, topicById } from '@/lib/skillpath-catalog';

export const dynamic = 'force-dynamic';

const allowedModes = new Set(['teach', 'study-plan', 'code', 'debug', 'quiz', 'project', 'suggest']);
const clampText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Sign in to use your SkillPath Learning Agent.' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: 'The AI provider is not configured. Add OPENAI_API_KEY in the SkillPath Render environment.' }, { status: 503 });

  try {
    const body = await req.json();
    const courseId = clampText(body.courseId, 80);
    const topicId = clampText(body.topicId, 120);
    const mode = clampText(body.mode, 40);
    const message = clampText(body.message, 5000);
    const language = clampText(body.language, 40) || 'Python';
    const code = clampText(body.code, 20000);
    const history = Array.isArray(body.history) ? body.history.slice(-8).map((m: any) => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: clampText(m?.content, 3000)
    })).filter((m: any) => m.content) : [];

    if (!allowedModes.has(mode)) return NextResponse.json({ error: 'Choose a valid learning-agent mode.' }, { status: 400 });
    if (!message && !['study-plan', 'suggest'].includes(mode)) return NextResponse.json({ error: 'Enter a question or task for the learning agent.' }, { status: 400 });

    const course = courseById(courseId);
    if (!course) return NextResponse.json({ error: 'Choose a valid SkillPath course.' }, { status: 400 });
    const found = topicId ? topicById(courseId, topicId) : null;
    if (topicId && !found) return NextResponse.json({ error: 'The selected topic does not belong to this course.' }, { status: 400 });

    const progress = await db.moduleProgress.findMany({
      where: { userId, moduleId: { startsWith: 'skillpath:' + courseId + ':' } },
      orderBy: { updatedAt: 'desc' }
    });
    const attempts = await db.practiceAttempt.findMany({
      where: { userId, type: { in: ['skillpath-assessment', 'skillpath-checkpoint'] } },
      orderBy: { createdAt: 'desc' },
      take: 12
    });
    const completedIds = new Set(progress.filter(p => p.completed && p.examPassed).map(p => p.moduleId));
    const allTopics = course.modules.flatMap((module: any) => module.topics.map((topic: any) => ({
      id: topic.id, title: topic.title, module: module.title,
      completed: completedIds.has('skillpath:' + courseId + ':' + topic.id)
    })));
    const completedCount = allTopics.filter((t: any) => t.completed).length;
    const nextTopic = allTopics.find((t: any) => !t.completed);

    const modeInstructions: Record<string, string> = {
      teach: 'Teach the selected topic from first principles. Use a clear definition, analogy, detailed explanation, worked example, practical use, common mistakes, and a short check-for-understanding question. Adapt to a beginner unless the student says otherwise.',
      'study-plan': 'Create a complete course roadmap from the student current progress to course completion. Break it into ordered modules, daily or weekly milestones, concepts, practical exercises, revision and a capstone. Be realistic and specific.',
      code: 'Act as a coding mentor. Solve the requested task in the selected language. Explain the algorithm before code, provide complete runnable code, sample input/output, edge cases, time and space complexity, and one practice variation.',
      debug: 'Debug the submitted code carefully. Identify the exact issue, explain why it happens, provide corrected complete code in the selected language, and suggest tests. Never claim code was executed.',
      quiz: 'Create a short adaptive quiz for the selected topic: 5 questions with options, answer key and explanations. Mix conceptual and practical questions. Do not reveal answers before the questions.',
      project: 'Suggest a practical project connected to this course and topic. Include difficulty, features, prerequisites, architecture, tools, milestones, code structure, testing and extension ideas.',
      suggest: 'Analyze the course curriculum and student progress. Recommend the next best topic, what to revise, one coding task, one mini-project and a realistic next study session.'
    };

    const system = `You are SkillPath Learning Agent, a patient but rigorous personal instructor and coding mentor inside SkillPath.
Your job is to guide the student through the COMPLETE selected course, one topic at a time, from beginner to advanced.
Always be accurate, practical, encouraging and specific. Explain jargon. Never invent course completion or test results.
Use the provided curriculum and progress; do not recommend skipping unfinished prerequisites without explaining why.
When code is requested, provide complete code in the selected language, not pseudocode, and explain how to run it. Never claim code was run.
Use markdown in answer. Return valid JSON only with this schema:
{"answer":"string","code":"string or empty","language":"string","nextSteps":["string"],"suggestions":["string"],"checkpointQuestion":"string"}
For mode teach: deep lesson. study-plan: full roadmap. code/debug: code must be in code field. quiz: put quiz in answer. project: detailed project plan. suggest: actionable recommendations.
`;

    const payload = {
      course: { id: course.id, title: course.title, description: course.description, level: course.level },
      curriculum: course.modules.map((m: any) => ({ module: m.title, topics: m.topics.map((t: any) => t.title) })),
      selectedTopic: found ? { module: found.module.title, title: found.topic.title, objective: found.topic.objective, theory: found.topic.theory } : null,
      progress: { completed: completedCount, total: allTopics.length, nextTopic, topics: allTopics },
      recentResults: attempts.map(a => ({ type: a.type, topic: a.topic, score: a.score, total: a.total })),
      mode, language, studentMessage: message, submittedCode: code
    };

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      temperature: mode === 'quiz' ? 0.5 : 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system + '\nTask instructions: ' + modeInstructions[mode] },
        ...history,
        { role: 'user', content: JSON.stringify(payload) }
      ]
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(raw);
    return NextResponse.json({
      answer: String(result.answer || 'Let us work through this topic step by step.'),
      code: String(result.code || ''),
      language: String(result.language || language),
      nextSteps: Array.isArray(result.nextSteps) ? result.nextSteps.map(String).slice(0, 8) : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.map(String).slice(0, 8) : [],
      checkpointQuestion: String(result.checkpointQuestion || ''),
      provider: 'OpenAI',
      progress: { completed: completedCount, total: allTopics.length, percent: allTopics.length ? Math.round(completedCount / allTopics.length * 100) : 0 }
    });
  } catch (error: any) {
    console.error('SkillPath Learning Agent error:', error);
    const status = Number(error?.status || 0);
    if (status === 429 || error?.code === 'insufficient_quota') return NextResponse.json({ error: 'AI credits are exhausted. Add API billing or configure an available provider.' }, { status: 503 });
    return NextResponse.json({ error: 'The learning agent could not complete this request. Please try again.' }, { status: 503 });
  }
}
