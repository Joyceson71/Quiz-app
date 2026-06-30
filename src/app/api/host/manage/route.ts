import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Verify the host token for a room. Returns 401 if invalid.
 */
async function verifyToken(supabase: ReturnType<typeof createServiceClient>, roomId: string, token: string) {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .eq('host_token', token)
    .single();

  if (error || !room) return null;
  return room;
}

/**
 * GET /api/host/manage?room_id=X&token=Y
 *
 * Returns full room data + participant stats for the host dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room_id');
    const token = searchParams.get('token');

    if (!roomId || !token) {
      return NextResponse.json({ error: 'room_id and token are required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const room = await verifyToken(supabase, roomId, token);
    if (!room) {
      return NextResponse.json({ error: 'Invalid host token' }, { status: 401 });
    }

    // Fetch participants with stats
    const { data: participants } = await supabase
      .from('participants')
      .select('id, student_name, register_no, department, section, has_submitted, score, percentage, rank, status, is_online, submission_time')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    const total = participants?.length || 0;
    const submitted = participants?.filter(p => p.has_submitted).length || 0;
    const online = participants?.filter(p => p.is_online).length || 0;

    return NextResponse.json({
      room,
      participants: participants || [],
      stats: { total, submitted, online },
    });

  } catch (error) {
    console.error('Host manage GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/host/manage
 *
 * Actions: start | end | announce
 * Body: { room_id, token, action, announcement? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room_id, token, action, announcement } = body;

    if (!room_id || !token || !action) {
      return NextResponse.json({ error: 'room_id, token, and action are required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const room = await verifyToken(supabase, room_id, token);
    if (!room) {
      return NextResponse.json({ error: 'Invalid host token' }, { status: 401 });
    }

    if (action === 'start') {
      if (room.status !== 'waiting') {
        return NextResponse.json({ error: 'Room is not in waiting status' }, { status: 400 });
      }
      const now = new Date().toISOString();
      const endTime = new Date(Date.now() + room.duration_minutes * 60 * 1000).toISOString();

      const { data: updatedRoom, error } = await supabase
        .from('rooms')
        .update({ status: 'active', quiz_start_time: now, quiz_end_time: endTime })
        .eq('id', room_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ room: updatedRoom, message: 'Quiz started!' });
    }

    if (action === 'end') {
      if (room.status === 'ended') {
        return NextResponse.json({ error: 'Room already ended' }, { status: 400 });
      }

      const { data: updatedRoom, error } = await supabase
        .from('rooms')
        .update({ status: 'ended' })
        .eq('id', room_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ room: updatedRoom, message: 'Quiz ended!' });
    }

    if (action === 'announce') {
      const { data: updatedRoom, error } = await supabase
        .from('rooms')
        .update({ announcement: announcement || null })
        .eq('id', room_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ room: updatedRoom, message: 'Announcement updated!' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('Host manage POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
