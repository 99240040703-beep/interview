import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { topicById } from '@/lib/skillpath-catalog';

export const dynamic = 'force-dynamic';

const LANGUAGES: Record<string, { language: string; file: string }> = {
  JavaScript: { language: 'javascript', file: 'main.js' },
  TypeScript: { language: 'typescript', file: 'main.ts' },
  Python: { language: 'python', file: 'main.py' },
  Java: { language: 'java', file: 'Main.java' },
  'C++': { language: 'c++', file: 'main.cpp' },
  C: { language: 'c', file: 'main.c' },
  'C#': { language: 'csharp', file: 'main.cs' },
  Go: { language: 'go', file: 'main.go' },
  Rust: { language: 'rust', file: 'main.rs' },
  PHP: { language: 'php', file: 'main.php' },
  Ruby: { language: 'ruby', file: 'main.rb' },
  Kotlin: { language: 'kotlin', file: 'main.kt' },
  Swift: { language: 'swift', file: 'main.swift' }
};

type Runtime = { language: string; file: string };

async function execute(runtime: Runtime, code: string, stdin: string) {
  const apiKey = process.env.CODE_RUNNER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Code runner is not configured. Add CODE_RUNNER_API_KEY to the Render environment, then redeploy.');
  }

  const baseUrl = (process.env.CODE_RUNNER_BASE_URL?.trim() || 'https://api.onlinecompiler.io/api/v2/piston').replace(/\/+$/, '');
  const response = await fetch(baseUrl + '/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The provider expects the API key as the raw Authorization value.
      Authorization: apiKey
    },
    body: JSON.stringify({
      language: runtime.language,
      version: '*',
      files: [{ name: runtime.file, content: code }],
      stdin,
      args: [],
      compile_timeout: 10000,
      run_timeout: 5000,
      run_memory_limit: 128000000
    }),
    signal: AbortSignal.timeout(20000)
  });

  const raw = await response.text();
  let result: any = {};
  try { result = raw ? JSON.parse(raw) : {}; } catch { result = { message: raw.slice(0, 500) }; }

  if (!response.ok) {
    const providerMessage = String(result.message || result.error || '').slice(0, 400);
    if (response.status === 401 || response.status === 403) {
      throw new Error('Code runner API key is invalid or not authorized. Check CODE_RUNNER_API_KEY in Render.');
    }
    if (response.status === 429) throw new Error('Code runner rate limit reached. Wait a moment and try again.');
    throw new Error(providerMessage || 'Code execution provider returned HTTP ' + response.status + '.');
  }

  const compile = result.compile || null;
  const run = result.run || {};
  return {
    stdout: String(run.stdout || ''),
    stderr: String(compile?.stderr || run.stderr || ''),
    exitCode: typeof run.code === 'number' ? run.code : null,
    compileFailed: Boolean(compile && typeof compile.code === 'number' && compile.code !== 0),
    signal: run.signal || null
  };
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  try {
    const body = await req.json();
    const language = LANGUAGES[String(body.language || '')];
    const code = String(body.code || '');
    const stdin = String(body.stdin || '');

    if (!language) return NextResponse.json({ error: 'This language is not enabled in the coding runner yet.' }, { status: 400 });
    if (!code.trim() || code.length > 20000) return NextResponse.json({ error: 'Code is required and must be under 20 KB.' }, { status: 400 });
    if (stdin.length > 5000) return NextResponse.json({ error: 'Input must be under 5 KB.' }, { status: 400 });

    if (body.checkpoint === true) {
      const courseId = String(body.courseId || '');
      const topicId = String(body.topicId || '');
      if (!topicById(courseId, topicId)) return NextResponse.json({ error: 'Invalid course checkpoint.' }, { status: 400 });

      const cases = [{ input: '2 3\n', expected: '5' }, { input: '-4 9\n', expected: '5' }];
      const results = [];
      for (const test of cases) {
        const out = await execute(language, code, test.input);
        const passed = !out.compileFailed && out.exitCode === 0 && out.stdout.trim() === test.expected;
        results.push({ input: test.input.trim(), expected: test.expected, actual: out.stdout.trim(), passed, stderr: out.stderr, exitCode: out.exitCode });
        if (out.compileFailed) break;
      }
      const passed = results.length === cases.length && results.every(x => x.passed);
      await db.practiceAttempt.create({
        data: { userId, type: 'skillpath-checkpoint', topic: courseId + ':' + topicId, score: results.filter(x => x.passed).length, total: cases.length }
      });
      return NextResponse.json({
        passed,
        passedCount: results.filter(x => x.passed).length,
        total: cases.length,
        tests: results,
        message: passed ? 'All hidden checkpoint tests passed. The next lesson can now be unlocked.' : 'Some test cases failed. Fix your code and submit again.',
        provider: 'OnlineCompiler'
      });
    }

    const out = await execute(language, code, stdin);
    return NextResponse.json({ success: !out.compileFailed && out.exitCode === 0, ...out, executed: true, provider: 'OnlineCompiler' });
  } catch (e: any) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    const message = timeout ? 'Code execution timed out. Limit your program to a short-running solution.' : String(e?.message || 'Could not execute code. Please try again.');
    const status = message.includes('not configured') ? 503 : 502;
    return NextResponse.json({ error: message, executed: false }, { status });
  }
}
