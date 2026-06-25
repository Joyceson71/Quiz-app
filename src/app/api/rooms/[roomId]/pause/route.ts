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
      .select('status, is_paused')
      .eq('id', roomId)
      .single();

    if (fetchError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.status !== 'active') {
      return NextResponse.json({ error: 'Quiz is not active' }, { status: 400 });
    }

    if (room.is_paused) {
      return NextResponse.json({ error: 'Quiz is already paused' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('rooms')
      .update({
        is_paused: true,
        pause_time: new Date().toISOString(),
      })
      .eq('id', roomId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Pause quiz error:', error);
    return NextResponse.json(
      { error: 'Failed to pause quiz', details: error.message },
      { status: 500 }
    );
  }
}
