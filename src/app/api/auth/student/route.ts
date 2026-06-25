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

    // Sanitize inputs
    const sanitizedRegNo = register_no.trim().toUpperCase();
    const sanitizedName = student_name.trim();
    const sanitizedCode = room_code.trim().toUpperCase();

    const supabase = createServiceClient();

    // Find the room by code
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', sanitizedCode)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Invalid room code. Please check and try again.' },
        { status: 404 }
      );
    }

    // Check room status — allow joins for 'waiting' and 'active' rooms
    if (room.status === 'ended') {
      return NextResponse.json(
        { error: 'This quiz has already ended.' },
        { status: 403 }
      );
    }

    // Only block if admin explicitly locked the room (not from quiz start auto-lock)
    // We differentiate: is_locked is ONLY set manually by admin, not by starting quiz
    // For now, we'll allow joins to active rooms unless admin explicitly locked

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

    // Generate room-scoped email to prevent collisions across rooms
    const emailSafeRegNo = sanitizedRegNo.toLowerCase().replace(/[^a-z0-9]/g, '');
    const roomPrefix = room.id.replace(/-/g, '').substring(0, 8);
    const email = `${emailSafeRegNo}_${roomPrefix}@quiz.local`;

    // Deterministic password (reproducible for reconnection after browser refresh)
    const password = `quiz_${sanitizedRegNo}_${room.room_code}_secret`;

    // Check for existing participant in this room with same register number
    const { data: existingParticipant } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', room.id)
      .eq('register_no', sanitizedRegNo)
      .single();

    if (existingParticipant) {
      // RECONNECTION FLOW — sign in existing user and return session
      try {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // If sign-in fails (maybe password changed), try to update password and retry
          if (existingParticipant.auth_user_id) {
            await supabase.auth.admin.updateUserById(existingParticipant.auth_user_id, {
              password,
            });
            const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (retryError || !retryData.session) {
              return NextResponse.json(
                { error: 'Failed to restore session. Please contact admin.' },
                { status: 500 }
              );
            }

            // Log reconnection
            await supabase.from('activity_logs').insert({
              participant_id: existingParticipant.id,
              room_id: room.id,
              event_type: 'reconnected',
              event_data: { register_no: sanitizedRegNo },
            });

            return NextResponse.json({
              participant: existingParticipant,
              room,
              session: {
                access_token: retryData.session.access_token,
                refresh_token: retryData.session.refresh_token,
              },
              message: 'Welcome back! Resuming your session.',
              isRejoining: true,
            });
          }
          return NextResponse.json(
            { error: 'Failed to restore session. Please contact admin.' },
            { status: 500 }
          );
        }

        if (!signInData.session) {
          return NextResponse.json(
            { error: 'Failed to create session.' },
            { status: 500 }
          );
        }

        // Log reconnection
        await supabase.from('activity_logs').insert({
          participant_id: existingParticipant.id,
          room_id: room.id,
          event_type: 'reconnected',
          event_data: { register_no: sanitizedRegNo },
        });

        return NextResponse.json({
          participant: existingParticipant,
          room,
          session: {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
          },
          message: 'Welcome back! Resuming your session.',
          isRejoining: true,
        });
      } catch (err) {
        console.error('Reconnection error:', err);
        return NextResponse.json(
          { error: 'Failed to restore session. Please try again.' },
          { status: 500 }
        );
      }
    }

    // NEW REGISTRATION FLOW

    // Step 1: Create auth user with room-scoped email and deterministic password
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        register_no: sanitizedRegNo,
        room_id: room.id,
        role: 'student',
      },
    });

    if (authError) {
      console.error('Auth user creation error:', authError);

      // If user already exists (edge case: participant record was deleted but auth user remains)
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        // Try to sign in with existing auth user
        try {
          const { data: existingAuthData } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (existingAuthData?.session) {
            // Create participant record for existing auth user
            const participantCode = `QZ-${sanitizedCode.slice(0, 2)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

            const { data: participant, error: pError } = await supabase
              .from('participants')
              .insert({
                room_id: room.id,
                auth_user_id: existingAuthData.user?.id,
                register_no: sanitizedRegNo,
                student_name: sanitizedName,
                department,
                section,
                participant_code: participantCode,
                total_marks: 20,
              })
              .select()
              .single();

            if (pError) {
              console.error('Participant creation error (recovery):', pError);
              return NextResponse.json(
                { error: 'Failed to register. This register number may already be in use.' },
                { status: 500 }
              );
            }

            // Log activity
            await supabase.from('activity_logs').insert({
              participant_id: participant.id,
              room_id: room.id,
              event_type: 'login',
              event_data: { register_no: sanitizedRegNo, department, section },
            });

            return NextResponse.json({
              participant,
              room,
              session: {
                access_token: existingAuthData.session.access_token,
                refresh_token: existingAuthData.session.refresh_token,
              },
              message: `Welcome, ${sanitizedName}! Your code: ${participantCode}`,
              isRejoining: false,
            });
          }
        } catch (recoveryErr) {
          console.error('Recovery sign-in failed:', recoveryErr);
        }
      }

      return NextResponse.json(
        { error: 'Failed to create session. Please try again.' },
        { status: 500 }
      );
    }

    // Step 2: Sign in the newly created user to get a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      console.error('Sign-in error:', signInError);
      // Cleanup: delete the auth user we just created
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to create session. Please try again.' },
        { status: 500 }
      );
    }

    // Step 3: Generate unique participant code
    const participantCode = `QZ-${sanitizedCode.slice(0, 2)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Step 4: Create participant record
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        room_id: room.id,
        auth_user_id: authData.user.id,
        register_no: sanitizedRegNo,
        student_name: sanitizedName,
        department,
        section,
        participant_code: participantCode,
        total_marks: 20,
        status: room.status === 'active' ? 'in_quiz' : 'joined',
      })
      .select()
      .single();

    if (participantError) {
      console.error('Participant creation error:', participantError);
      // Cleanup auth user on failure
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to register. Please try again.' },
        { status: 500 }
      );
    }

    // Step 5: Log activity
    await supabase.from('activity_logs').insert({
      participant_id: participant.id,
      room_id: room.id,
      event_type: 'login',
      event_data: { register_no: sanitizedRegNo, department, section },
    });

    return NextResponse.json({
      participant,
      room,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
      message: `Welcome, ${sanitizedName}! Your code: ${participantCode}`,
      isRejoining: false,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}
