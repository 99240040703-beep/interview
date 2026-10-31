import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const skills = [
  'javascript',
  'typescript',
  'react',
  'next.js',
  'node.js',
  'python',
  'java',
  'sql',
  'postgresql',
  'git',
  'docker',
  'aws',
  'html',
  'css',
  'api',
  'data structures',
  'algorithms',
];

function analyze(text: string) {
  const lower = text.toLowerCase();

  const found = skills.filter((skill) => lower.includes(skill));

  const sections = [
    'experience',
    'education',
    'project',
    'projects',
    'skills',
    'summary',
    'contact',
  ].filter((section) => lower.includes(section));

  const uniqueSections = [...new Set(sections)];

  const score = Math.min(
    100,
    Math.round(
      (found.length / skills.length) * 55 +
        (uniqueSections.length / 6) * 35 +
        (text.length > 900 ? 10 : 0)
    )
  );

  const missing = [
    'summary',
    'education',
    'projects',
    'skills',
    'experience',
  ].filter((section) => !lower.includes(section));

  const feedback =
    `Matched skills: ${found.length}. ` +
    `Strong sections: ${uniqueSections.length}. ` +
    (missing.length
      ? `Consider adding: ${missing.join(', ')}.`
      : 'Core resume sections are present.');

  return {
    score,
    found,
    feedback,
  };
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const form = await req.formData();

    const file = form.get('file');
    const pasted = String(form.get('text') || '');

    let fileName = 'Pasted resume';
    let text = pasted;

    if (file instanceof File) {
      fileName = file.name;

      const lowerName = file.name.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      /*
       * IMPORTANT:
       * pdf-parse is dynamically imported here instead of being imported
       * at the top of the file. This prevents its test/debug bootstrap
       * from running during the Next.js build.
       */
      if (lowerName.endsWith('.pdf')) {
        // Import the parser implementation directly. pdf-parse@1.1.1's
        // package entrypoint runs a bundled test-file check in some Next.js
        // server bundles, which tries to read ./test/data/05-versions-space.pdf.
        // That fixture is not shipped in production deployments.
        // @ts-expect-error pdf-parse does not publish types for this internal entrypoint.
        const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
        const pdfParse = pdfModule.default as (input: Buffer) => Promise<{ text: string }>;

        const parsed = await pdfParse(buffer);
        text = parsed.text;
      } else if (lowerName.endsWith('.docx')) {
        const mammoth = await import('mammoth');

        const result = await mammoth.extractRawText({
          buffer,
        });

        text = result.value;
      } else if (
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.text')
      ) {
        text = buffer.toString('utf8');
      } else {
        return NextResponse.json(
          {
            error:
              'Unsupported file type. Please upload a PDF, DOCX, or TXT resume.',
          },
          { status: 400 }
        );
      }
    }

    text = text.trim();

    if (text.length < 40) {
      return NextResponse.json(
        {
          error:
            'Could not extract enough text. Upload a text-based PDF/DOCX or paste your resume text.',
        },
        { status: 400 }
      );
    }

    const result = analyze(text);

    const resume = await db.resume.create({
      data: {
        userId,
        fileName,
        extracted: text.slice(0, 20000),
        score: result.score,
        feedback: result.feedback,
      },
    });

    return NextResponse.json({
      ...resume,
      skills: result.found,
    });
  } catch (error) {
    console.error('Resume analysis error:', error);

    return NextResponse.json(
      {
        error:
          'Resume analysis failed. Try a standard text-based PDF or DOCX.',
      },
      { status: 500 }
    );
  }
}
