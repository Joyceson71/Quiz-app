import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST - Submit the quiz
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { participant_id, room_id, auto_submit_reason } = body;

    if (!participant_id || !room_id) {
      return NextResponse.json(
        { error: 'participant_id and room_id are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verify participant hasn't submitted yet
    const { data: participant } = await supabase
      .from('participants')
      .select('has_submitted')
      .eq('id', participant_id)
      .single();

    if (participant?.has_submitted) {
      // Get existing results
      const { data: existingResult } = await supabase
        .from('participants')
        .select('score, percentage, rank, total_marks, submission_time')
        .eq('id', participant_id)
        .single();

      return NextResponse.json({
        result: existingResult,
        message: 'Quiz was already submitted',
        already_submitted: true,
      });
    }

    // Use server-side function to calculate score and submit
    const { data: result, error } = await supabase.rpc('submit_quiz', {
      target_participant_id: participant_id,
    });

    if (error) {
      console.error('Submit quiz error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log submission
    await supabase.from('activity_logs').insert({
      participant_id,
      room_id,
      event_type: 'quiz_submit',
      event_data: {
        auto_submit: !!auto_submit_reason,
        reason: auto_submit_reason || 'manual_submit',
        score: result?.[0]?.final_score,
      },
    });

    // If auto-submitted due to violation, log it
    if (auto_submit_reason) {
      await supabase.from('violations').insert({
        participant_id,
        room_id,
        violation_type: auto_submit_reason,
        description: `Auto-submitted: ${auto_submit_reason}`,
      });
    }

    return NextResponse.json({
      result: result?.[0] || null,
      message: auto_submit_reason
        ? 'Quiz auto-submitted due to violations'
        : 'Quiz submitted successfully!',
      already_submitted: false,
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
