import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; participantId: string }> }
) {
  try {
    const { roomId, participantId } = await params;
    const supabase = createServiceClient();

    // Verify room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get participant to optionally remove auth user too
    const { data: participant } = await supabase
      .from('participants')
      .select('auth_user_id')
      .eq('id', participantId)
      .single();

    // Delete participant record
    const { error: deleteError } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId)
      .eq('room_id', roomId);

    if (deleteError) {
      throw deleteError;
    }

    // Attempt to delete auth user as well to prevent rejoining issues
    if (participant?.auth_user_id) {
      await supabase.auth.admin.deleteUser(participant.auth_user_id).catch(() => {});
    }

    return NextResponse.json({ message: 'Participant removed successfully' });
  } catch (error: any) {
    console.error('Remove participant error:', error);
    return NextResponse.json(
      { error: 'Failed to remove participant', details: error.message },
      { status: 500 }
    );
  }
}

// Disable/Kick a participant (force submit)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; participantId: string }> }
) {
  try {
    const { roomId, participantId } = await params;
    const supabase = createServiceClient();

    // Update participant to submitted status
    const { error: updateError } = await supabase
      .from('participants')
      .update({
        has_submitted: true,
        submission_time: new Date().toISOString(),
        status: 'kicked'
      })
      .eq('id', participantId)
      .eq('room_id', roomId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ message: 'Participant disabled successfully' });
  } catch (error: any) {
    console.error('Disable participant error:', error);
    return NextResponse.json(
      { error: 'Failed to disable participant', details: error.message },
      { status: 500 }
    );
  }
}
