import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const supabase = createServiceClient();

    const { data: room, error: fetchError } = await supabase
      .from('rooms')
      .select('status, is_paused, pause_time, quiz_end_time')
      .eq('id', roomId)
      .single();

    if (fetchError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.status !== 'active') {
      return NextResponse.json({ error: 'Quiz is not active' }, { status: 400 });
    }

    if (!room.is_paused || !room.pause_time) {
      return NextResponse.json({ error: 'Quiz is not paused' }, { status: 400 });
    }

    // Calculate how much time passed while paused
    const pauseStart = new Date(room.pause_time).getTime();
    const now = new Date().getTime();
    const pauseDurationMs = now - pauseStart;

    // Extend the end time by the pause duration
    const currentEndTime = new Date(room.quiz_end_time).getTime();
    const newEndTime = new Date(currentEndTime + pauseDurationMs).toISOString();

    const { data, error } = await supabase
      .from('rooms')
      .update({
        is_paused: false,
        pause_time: null,
        quiz_end_time: newEndTime,
      })
      .eq('id', roomId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Resume quiz error:', error);
    return NextResponse.json(
      { error: 'Failed to resume quiz', details: error.message },
      { status: 500 }
    );
  }
}
