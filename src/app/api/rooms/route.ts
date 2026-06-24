import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET - List all rooms
export async function GET() {
  try {
    const supabase = createServiceClient();
    
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*, participants(count)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('List rooms error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room_name, duration_minutes = 20, max_participants = 300 } = body;

    if (!room_name) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Generate unique room code
    const { data: codeData } = await supabase.rpc('generate_room_code');
    const roomCode = codeData || Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create room
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        room_name,
        duration_minutes,
        max_participants,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      console.error('Create room error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Assign randomized questions to this room
    await supabase.rpc('assign_questions_to_room', { target_room_id: room.id });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
