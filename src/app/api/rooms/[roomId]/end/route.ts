import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST - End the quiz for a room
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const supabase = createServiceClient();

    // Auto-submit for all participants who haven't submitted
    const { data: unsubmitted } = await supabase
      .from('participants')
      .select('id')
      .eq('room_id', roomId)
      .eq('has_submitted', false);

    if (unsubmitted && unsubmitted.length > 0) {
      for (const p of unsubmitted) {
        await supabase.rpc('submit_quiz', { target_participant_id: p.id });
      }
    }

    // Calculate final scores and ranks
    await supabase.rpc('calculate_scores', { target_room_id: roomId });

    // Update room status
    const { data: room, error } = await supabase
      .from('rooms')
      .update({
        status: 'ended',
        quiz_end_time: new Date().toISOString(),
      })
      .eq('id', roomId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      room,
      message: 'Quiz ended successfully!',
    });
  } catch (error) {
    console.error('End quiz error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
