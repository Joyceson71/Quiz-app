import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST - Log a violation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { participant_id, room_id, violation_type, description } = body;

    if (!participant_id || !room_id || !violation_type) {
      return NextResponse.json(
        { error: 'participant_id, room_id, and violation_type are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('violations')
      .insert({
        participant_id,
        room_id,
        violation_type,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ violation: data });
  } catch (error) {
    console.error('Log violation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get violations for a room
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room_id');
    const participantId = searchParams.get('participant_id');

    const supabase = createServiceClient();

    let query = supabase
      .from('violations')
      .select('*, participants(student_name, register_no)')
      .order('created_at', { ascending: false });

    if (roomId) query = query.eq('room_id', roomId);
    if (participantId) query = query.eq('participant_id', participantId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ violations: data });
  } catch (error) {
    console.error('Get violations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
