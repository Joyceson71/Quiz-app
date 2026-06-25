import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { minutes } = body;

    if (!minutes || typeof minutes !== 'number') {
      return NextResponse.json({ error: 'Valid minutes value is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: room, error: fetchError } = await supabase
      .from('rooms')
      .select('status, quiz_end_time, duration_minutes')
      .eq('id', roomId)
      .single();

    if (fetchError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.status !== 'active') {
      return NextResponse.json({ error: 'Can only change timer for active quizzes' }, { status: 400 });
    }

    // Extend or reduce the end time
    const currentEndTime = new Date(room.quiz_end_time).getTime();
    const additionalMs = minutes * 60 * 1000;
    const newEndTime = new Date(currentEndTime + additionalMs).toISOString();
    const newDuration = room.duration_minutes + minutes;

    const { data, error } = await supabase
      .from('rooms')
      .update({
        quiz_end_time: newEndTime,
        duration_minutes: newDuration > 0 ? newDuration : room.duration_minutes,
      })
      .eq('id', roomId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      message: `Timer ${minutes > 0 ? 'extended' : 'reduced'} by ${Math.abs(minutes)} minutes`,
      room: data
    });
  } catch (error: any) {
    console.error('Timer change error:', error);
    return NextResponse.json(
      { error: 'Failed to change timer', details: error.message },
      { status: 500 }
    );
  }
}
