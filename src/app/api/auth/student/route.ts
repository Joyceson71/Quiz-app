import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  
  const getErrorResponse = (genericMessage: string, error: any) => {
    console.error(`[Student Auth Error] ${genericMessage}:`, JSON.stringify(error, null, 2));
    const details = error?.message || JSON.stringify(error);
    return NextResponse.json(
      { error: isDev ? `${genericMessage}: ${details}` : genericMessage },
      { status: 500 }
    );
  };

  try {
    const body = await request.json();
    const { register_no, student_name, department, section, college_year, room_code } = body;

    // Validate required fields
    if (!register_no || !student_name || !department || !section || !college_year || !room_code) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedRegNo = register_no.trim().toUpperCase();
    const sanitizedName = student_name.trim();
    const sanitizedCode = room_code.trim().toUpperCase();

    // Use service client for database operations to bypass RLS
    const supabase = createServiceClient();
    
    // Use regular client for auth sign in so we don't downgrade the service client's privileges
    const authClient = await createClient();

    // Find the room by code
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', sanitizedCode)
      .single();

    if (roomError || !room) {
      if (roomError) console.error('[Room Fetch Error]:', JSON.stringify(roomError, null, 2));
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

    // Check participant limit
    const { count, error: countError } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);
      
    if (countError) {
      return getErrorResponse('Failed to check room capacity', countError);
    }

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
    const { data: existingParticipant, error: existingError } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', room.id)
      .eq('register_no', sanitizedRegNo)
      .single();

    if (existingError && existingError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      return getErrorResponse('Failed to check existing participant', existingError);
    }

    if (existingParticipant) {
      // RECONNECTION FLOW — sign in existing user and return session
      console.log(`[Reconnection] Attempting to reconnect participant: ${existingParticipant.id}`);
      
      const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('[Reconnection Sign-In Error]:', JSON.stringify(signInError, null, 2));
        
        // If sign-in fails (maybe password changed), try to update password and retry
        if (existingParticipant.auth_user_id) {
          console.log(`[Reconnection] Updating password for auth user: ${existingParticipant.auth_user_id}`);
          
          const { error: updateError } = await supabase.auth.admin.updateUserById(existingParticipant.auth_user_id, {
            password,
          });
          
          if (updateError) {
             return getErrorResponse('Failed to update auth user password', updateError);
          }
          
          const { data: retryData, error: retryError } = await authClient.auth.signInWithPassword({
            email,
            password,
          });
          
          if (retryError || !retryData.session) {
            return getErrorResponse('Failed to restore session after password update', retryError || { message: 'No session returned' });
          }

          // Log reconnection
          const { error: logError } = await supabase.from('activity_logs').insert({
            participant_id: existingParticipant.id,
            room_id: room.id,
            event_type: 'reconnected',
            event_data: { register_no: sanitizedRegNo },
          });
          
          if (logError) console.error('[Activity Log Error]:', JSON.stringify(logError, null, 2));

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
        return getErrorResponse('Failed to restore session. Auth user ID missing on participant.', { message: 'auth_user_id is null' });
      }

      if (!signInData.session) {
        return getErrorResponse('Failed to create session.', { message: 'No session returned on sign in' });
      }

      // Log reconnection
      const { error: logError } = await supabase.from('activity_logs').insert({
        participant_id: existingParticipant.id,
        room_id: room.id,
        event_type: 'reconnected',
        event_data: { register_no: sanitizedRegNo },
      });
      
      if (logError) console.error('[Activity Log Error]:', JSON.stringify(logError, null, 2));

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
    }

    // NEW REGISTRATION FLOW

    // Step 1: Create auth user with room-scoped email and deterministic password
    console.log(`[Registration] Creating auth user for ${sanitizedRegNo}`);
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
      console.error('[Auth User Creation Error]:', JSON.stringify(authError, null, 2));

      // If user already exists (edge case: participant record was deleted but auth user remains)
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        console.log(`[Registration Recovery] Auth user already exists. Attempting sign-in.`);
        
        const { data: existingAuthData, error: recoverySignInError } = await authClient.auth.signInWithPassword({
          email,
          password,
        });
        
        if (recoverySignInError) {
           return getErrorResponse('Recovery sign-in failed', recoverySignInError);
        }

        if (existingAuthData?.session) {
          // Create participant record for existing auth user
          const participantCode = `QZ-${sanitizedCode.slice(0, 2)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

          console.log(`[Registration Recovery] Inserting participant record`);
          const { data: participant, error: pError } = await supabase
            .from('participants')
            .insert({
              room_id: room.id,
              auth_user_id: existingAuthData.user?.id,
              register_no: sanitizedRegNo,
              student_name: sanitizedName,
              department,
              section,
              college_year,
              participant_code: participantCode,
              total_marks: 20,
            })
            .select()
            .single();

          if (pError) {
            return getErrorResponse('Participant creation error (recovery)', pError);
          }

          // Log activity
          const { error: logError } = await supabase.from('activity_logs').insert({
            participant_id: participant.id,
            room_id: room.id,
            event_type: 'login',
            event_data: { register_no: sanitizedRegNo, department, section, college_year },
          });
          
          if (logError) console.error('[Activity Log Error]:', JSON.stringify(logError, null, 2));

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
      }

      return getErrorResponse('Failed to create auth user', authError);
    }

    // Step 2: Sign in the newly created user to get a session
    console.log(`[Registration] Signing in newly created auth user: ${authData.user.id}`);
    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      console.error('[Sign-In Error]:', JSON.stringify(signInError || { message: 'No session' }, null, 2));
      // Cleanup: delete the auth user we just created
      await supabase.auth.admin.deleteUser(authData.user.id);
      return getErrorResponse('Failed to create session after auth user creation', signInError || { message: 'No session' });
    }

    // Step 3: Generate unique participant code
    const participantCode = `QZ-${sanitizedCode.slice(0, 2)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Step 4: Create participant record
    console.log(`[Registration] Inserting participant record for auth_user_id: ${authData.user.id}`);
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        room_id: room.id,
        auth_user_id: authData.user.id,
        register_no: sanitizedRegNo,
        student_name: sanitizedName,
        department,
        section,
        college_year,
        participant_code: participantCode,
        total_marks: 20,
        status: room.status === 'active' ? 'in_quiz' : 'joined',
      })
      .select()
      .single();

    if (participantError) {
      console.error('[Participant Creation Error]:', JSON.stringify(participantError, null, 2));
      // Cleanup auth user on failure
      await supabase.auth.admin.deleteUser(authData.user.id);
      return getErrorResponse('Failed to register participant record', participantError);
    }

    // Step 5: Log activity
    console.log(`[Registration] Inserting activity log for participant: ${participant.id}`);
    const { error: logError } = await supabase.from('activity_logs').insert({
      participant_id: participant.id,
      room_id: room.id,
      event_type: 'login',
      event_data: { register_no: sanitizedRegNo, department, section, college_year },
    });
    
    if (logError) console.error('[Activity Log Error]:', JSON.stringify(logError, null, 2));

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
    console.error('[Registration Unhandled Error]:', JSON.stringify(error, null, 2));
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      { error: isDev ? `Internal server error: ${(error as Error)?.message || JSON.stringify(error)}` : 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}
