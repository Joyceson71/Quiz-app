import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { register_no, student_name, department, section, room_code } = body;

    // Validate required fields
    if (!register_no || !student_name || !department || !section || !room_code) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Find the room by code
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', room_code.toUpperCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Invalid room code' },
        { status: 404 }
      );
    }

    // Check room status
    if (room.is_locked) {
      return NextResponse.json(
        { error: 'Room is locked. No new participants allowed.' },
        { status: 403 }
      );
    }

    if (room.status === 'ended') {
      return NextResponse.json(
        { error: 'Quiz has already ended.' },
        { status: 403 }
      );
    }

    // Check participant limit
    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (count !== null && count >= room.max_participants) {
      return NextResponse.json(
        { error: `Room is full. Maximum ${room.max_participants} participants allowed.` },
        { status: 403 }
      );
    }

    // Check for duplicate register number in same room
    const { data: existingParticipant } = await supabase
      .from('participants')
      .select('id, participant_code, auth_user_id')
      .eq('room_id', room.id)
      .eq('register_no', register_no)
      .single();

    if (existingParticipant) {
      // Return existing session if they're re-joining
      return NextResponse.json({
        participant: existingParticipant,
        room,
        message: 'Welcome back! Resuming your session.',
        isRejoining: true,
      });
    }

    // Create anonymous auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `${register_no.toLowerCase().replace(/[^a-z0-9]/g, '')}@quiz.local`,
      password: `quiz_${register_no}_${Date.now()}`,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Failed to create session. Please try again.' },
        { status: 500 }
      );
    }

    // Generate participant code
    const participantCode = `QZ-${room_code.slice(0, 2)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Create participant record
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        room_id: room.id,
        auth_user_id: authData.user.id,
        register_no: register_no.toUpperCase(),
        student_name,
        department,
        section,
        participant_code: participantCode,
        total_marks: 20,
      })
      .select()
      .single();

    if (participantError) {
      console.error('Participant error:', participantError);
      // Cleanup auth user on failure
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to register. Please try again.' },
        { status: 500 }
      );
    }

    // Sign in the user to get a session
    const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: `${register_no.toLowerCase().replace(/[^a-z0-9]/g, '')}@quiz.local`,
    });

    // Log activity
    await supabase.from('activity_logs').insert({
      participant_id: participant.id,
      room_id: room.id,
      event_type: 'login',
      event_data: { register_no, department, section },
    });

    return NextResponse.json({
      participant,
      room,
      auth_user_id: authData.user.id,
      email: `${register_no.toLowerCase().replace(/[^a-z0-9]/g, '')}@quiz.local`,
      password: `quiz_${register_no}_${Date.now()}`,
      message: 'Registration successful!',
      isRejoining: false,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
