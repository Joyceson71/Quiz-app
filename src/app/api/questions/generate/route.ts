import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { department, subject, semester, difficulty, count } = await request.json();

    if (!subject || !count) {
      return NextResponse.json({ error: 'Subject and count are required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Return a mock response if no API key is configured
      const mockQuestions = Array.from({ length: count }).map((_, i) => ({
        question: `Sample AI Question ${i + 1} for ${subject} (${difficulty})`,
        option_a: 'Option A',
        option_b: 'Option B',
        option_c: 'Option C',
        option_d: 'Option D',
        correct_answer: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        marks: difficulty === 'Hard' ? 5 : difficulty === 'Medium' ? 3 : 1,
      }));

      return NextResponse.json({
        questions: mockQuestions,
        message: 'NOTE: These are mock questions. Configure GEMINI_API_KEY or OPENAI_API_KEY in .env.local to generate real questions.'
      });
    }

    // In a real implementation with the API key, you would call the respective AI SDK here
    // and parse the structured output into the required format.
    
    return NextResponse.json({ error: 'AI generation logic with API key is not yet fully implemented' }, { status: 501 });

  } catch (error: any) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions', details: error.message },
      { status: 500 }
    );
  }
}
