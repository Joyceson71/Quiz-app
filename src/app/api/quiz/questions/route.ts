import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room_id');
    const participantId = searchParams.get('participant_id');

    if (!roomId) {
      return NextResponse.json({ error: 'room_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get room questions with their display order
    const { data: roomQuestions, error: rqError } = await supabase
      .from('room_questions')
      .select('question_id, display_order')
      .eq('room_id', roomId)
      .order('display_order', { ascending: true });

    if (rqError || !roomQuestions?.length) {
      return NextResponse.json({ error: 'No questions found for this room' }, { status: 404 });
    }

    const questionIds = roomQuestions.map(rq => rq.question_id);

    // Get safe questions (without correct_answer)
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, question, option_a, option_b, option_c, option_d, marks, question_order')
      .in('id', questionIds);

    if (qError) {
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }

    // Sort questions by room's display order
    const orderMap = new Map(roomQuestions.map(rq => [rq.question_id, rq.display_order]));
    const sortedQuestions = questions?.sort(
      (a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0)
    );

    // Get existing answers for this participant (for resume)
    let existingAnswers: Record<string, string> = {};
    if (participantId) {
      const { data: answers } = await supabase
        .from('answers')
        .select('question_id, selected_answer')
        .eq('participant_id', participantId);

      if (answers) {
        existingAnswers = Object.fromEntries(
          answers.map(a => [a.question_id, a.selected_answer])
        );
      }
    }

    return NextResponse.json({
      questions: sortedQuestions,
      existing_answers: existingAnswers,
      total: sortedQuestions?.length || 0,
    });
  } catch (error) {
    console.error('Get questions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
