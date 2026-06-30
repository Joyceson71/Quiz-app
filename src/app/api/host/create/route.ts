import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

interface HostQuestion {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  marks?: number;
}

/**
 * POST /api/host/create
 *
 * Public endpoint — no auth required.
 * Creates a self-serve room with host-supplied questions.
 * Returns the room + a secret host_token the creator must keep.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      room_name,
      duration_minutes = 20,
      max_participants = 100,
      questions,
    }: {
      room_name: string;
      duration_minutes: number;
      max_participants: number;
      questions: HostQuestion[];
    } = body;

    if (!room_name?.trim()) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    if (!Array.isArray(questions) || questions.length < 1) {
      return NextResponse.json({ error: 'At least 1 question is required' }, { status: 400 });
    }

    if (questions.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 questions allowed per room' }, { status: 400 });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question?.trim() || !q.option_a?.trim() || !q.option_b?.trim() || !q.option_c?.trim() || !q.option_d?.trim()) {
        return NextResponse.json({ error: `Question ${i + 1} is missing required fields` }, { status: 400 });
      }
      if (!['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
        return NextResponse.json({ error: `Question ${i + 1} has an invalid correct_answer (must be A, B, C, or D)` }, { status: 400 });
      }
    }

    const supabase = createServiceClient();

    // Generate unique room code
    const { data: codeData } = await supabase.rpc('generate_room_code');
    const roomCode = codeData || Math.random().toString(36).substring(2, 8).toUpperCase();

    // Generate a cryptographically secure host token
    const hostToken = crypto.randomBytes(32).toString('hex');

    // Create room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        room_name: room_name.trim(),
        duration_minutes,
        max_participants,
        status: 'waiting',
        host_token: hostToken,
        is_host_room: true,
      })
      .select()
      .single();

    if (roomError || !room) {
      console.error('Create host room error:', roomError);
      return NextResponse.json({ error: roomError?.message || 'Failed to create room' }, { status: 500 });
    }

    // Insert custom questions
    const questionRows = questions.map((q, i) => ({
      room_id: room.id,
      question: q.question.trim(),
      option_a: q.option_a.trim(),
      option_b: q.option_b.trim(),
      option_c: q.option_c.trim(),
      option_d: q.option_d.trim(),
      correct_answer: q.correct_answer,
      marks: q.marks || 1,
      display_order: i + 1,
    }));

    const { error: qError } = await supabase.from('custom_questions').insert(questionRows);
    if (qError) {
      // Rollback room on question insert failure
      await supabase.from('rooms').delete().eq('id', room.id);
      console.error('Insert custom questions error:', qError);
      return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 });
    }

    return NextResponse.json({
      room: { ...room, host_token: hostToken },
      host_token: hostToken,
      message: 'Room created successfully!',
    }, { status: 201 });

  } catch (error) {
    console.error('Host create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
