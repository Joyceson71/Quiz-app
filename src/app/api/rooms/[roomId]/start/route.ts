import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST - Start the quiz for a room
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const supabase = createServiceClient();

    // Get current room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.status === 'active') {
      return NextResponse.json({ error: 'Quiz is already active' }, { status: 400 });
    }

    if (room.status === 'ended') {
      return NextResponse.json({ error: 'Quiz has already ended' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const endTime = new Date(Date.now() + room.duration_minutes * 60 * 1000).toISOString();

    // Update room status
    // Note: We do NOT set is_locked here. That is only for admin manual lock.
    // Students should be able to join active rooms.
    const { data: updatedRoom, error: updateError } = await supabase
      .from('rooms')
      .update({
        status: 'active',
        quiz_start_time: now,
        quiz_end_time: endTime,
      })
      .eq('id', roomId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update all participants to in_quiz
    await supabase
      .from('participants')
      .update({ status: 'in_quiz' })
      .eq('room_id', roomId)
      .eq('status', 'joined');

    return NextResponse.json({ 
      room: updatedRoom,
      message: 'Quiz started successfully!',
    });
  } catch (error) {
    console.error('Start quiz error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
