import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('room_id');
    const participantId = searchParams.get('participant_id');

    if (!roomId || !participantId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify participant has submitted
    const { data: participant, error: pError } = await supabase
      .from('participants')
      .select('has_submitted')
      .eq('id', participantId)
      .eq('room_id', roomId)
      .single();

    if (pError || !participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    if (!participant.has_submitted) {
      return NextResponse.json({ error: 'Review is only available after submission' }, { status: 403 });
    }

    // Get answers
    const { data: answers, error: aError } = await supabase
      .from('answers')
      .select('question_id, selected_answer, is_correct')
      .eq('participant_id', participantId);

    if (aError) throw aError;

    // Get questions
    const { data: roomQuestions, error: rqError } = await supabase
      .from('room_questions')
      .select(`
        question_id,
        questions (
          id,
          question,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer,
          marks
        )
      `)
      .eq('room_id', roomId);

    if (rqError) throw rqError;

    // Combine
    const reviewData = roomQuestions.map((rq: any) => {
      const q = rq.questions;
      const answer = answers?.find((a) => a.question_id === q.id);
      return {
        id: q.id,
        question: q.question,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        marks: q.marks,
        selected_answer: answer?.selected_answer || null,
        is_correct: answer?.is_correct || false,
      };
    });

    return NextResponse.json({ review: reviewData });
  } catch (error: any) {
    console.error('Quiz review error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review data', details: error.message },
      { status: 500 }
    );
  }
}
