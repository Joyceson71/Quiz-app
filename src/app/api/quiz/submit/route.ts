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
      .select('has_submitted, student_name')
      .eq('id', participant_id)
      .single();

    if (participant?.has_submitted) {
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

    // Check if this is a host room with custom questions
    const { data: room } = await supabase
      .from('rooms')
      .select('is_host_room')
      .eq('id', room_id)
      .single();

    let result: {
      final_score: number;
      final_percentage: number;
      final_rank: number;
      total_questions: number;
      correct_count: number;
    } | null = null;

    if (room?.is_host_room) {
      // ── HOST ROOM: calculate score from custom_questions ──────────────────
      const { data: customQuestions } = await supabase
        .from('custom_questions')
        .select('id, correct_answer, marks')
        .eq('room_id', room_id);

      const { data: answers } = await supabase
        .from('answers')
        .select('question_id, selected_answer, is_correct')
        .eq('participant_id', participant_id);

      let score = 0;
      let totalMarks = 0;
      let correctCount = 0;

      for (const cq of customQuestions || []) {
        totalMarks += cq.marks;
        const ans = (answers || []).find(a => a.question_id === cq.id);
        if (ans?.selected_answer === cq.correct_answer) {
          score += cq.marks;
          correctCount++;
        }
      }

      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100 * 10) / 10 : 0;
      const submissionTime = new Date().toISOString();

      // Update participant record with score (preserve student_name!)
      await supabase
        .from('participants')
        .update({
          score,
          total_marks: totalMarks,
          percentage,
          has_submitted: true,
          status: 'submitted',
          submission_time: submissionTime,
        })
        .eq('id', participant_id);

      // Calculate rank: count participants with higher score (or same score but submitted earlier)
      const { data: submittedBefore } = await supabase
        .from('participants')
        .select('id')
        .eq('room_id', room_id)
        .eq('has_submitted', true)
        .or(`score.gt.${score},and(score.eq.${score},submission_time.lt.${submissionTime})`);

      const rank = (submittedBefore?.length ?? 0) + 1;

      await supabase
        .from('participants')
        .update({ rank })
        .eq('id', participant_id);

      result = {
        final_score: score,
        final_percentage: percentage,
        final_rank: rank,
        total_questions: customQuestions?.length ?? 0,
        correct_count: correctCount,
      };
    } else {
      // ── ADMIN ROOM: use the submit_quiz RPC ───────────────────────────────
      const { data: rpcResult, error } = await supabase.rpc('submit_quiz', {
        target_participant_id: participant_id,
      });

      if (error) {
        console.error('Submit quiz RPC error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result = rpcResult?.[0] ?? null;
    }

    // Log submission
    await supabase.from('activity_logs').insert({
      participant_id,
      room_id,
      event_type: 'quiz_submit',
      event_data: {
        auto_submit: !!auto_submit_reason,
        reason: auto_submit_reason || 'manual_submit',
        score: result?.final_score,
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
      result: result ?? null,
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
