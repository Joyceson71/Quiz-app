import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST - Save an individual answer (auto-save)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { participant_id, question_id, room_id, selected_answer } = body;

    if (!participant_id || !question_id || !room_id || !selected_answer) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verify participant hasn't submitted yet
    const { data: participant } = await supabase
      .from('participants')
      .select('has_submitted, status')
      .eq('id', participant_id)
      .single();

    if (participant?.has_submitted) {
      return NextResponse.json(
        { error: 'Quiz already submitted' },
        { status: 400 }
      );
    }

    // Get the correct answer — check shared questions first, then custom_questions (for host rooms)
    const { data: question } = await supabase
      .from('questions')
      .select('correct_answer')
      .eq('id', question_id)
      .single();

    let correctAnswer = question?.correct_answer;

    if (!correctAnswer) {
      // Host room — look up in custom_questions
      const { data: customQ } = await supabase
        .from('custom_questions')
        .select('correct_answer')
        .eq('id', question_id)
        .single();
      correctAnswer = customQ?.correct_answer;
    }

    const isCorrect = correctAnswer === selected_answer;

    // Upsert answer (insert or update if exists)
    const { data: answer, error } = await supabase
      .from('answers')
      .upsert(
        {
          participant_id,
          question_id,
          room_id,
          selected_answer,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        },
        {
          onConflict: 'participant_id,question_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Save answer error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      participant_id,
      room_id,
      event_type: 'answer_saved',
      event_data: { question_id, selected_answer },
    });

    return NextResponse.json({ answer, is_correct: isCorrect });
  } catch (error) {
    console.error('Save answer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
