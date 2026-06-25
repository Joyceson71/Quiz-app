import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { room_code } = await request.json();
    if (!room_code) {
      return NextResponse.json(
        { error: "Room code is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const serviceRole = createServiceClient();

    // 1. Verify User Authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Fetch Student Profile
    const { data: profile, error: profileError } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("auth_user_id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Complete your profile first" },
        { status: 403 },
      );
    }

    // 3. Find Room
    const { data: room, error: roomError } = await serviceRole
      .from("rooms")
      .select("*")
      .eq("room_code", room_code.toUpperCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 404 });
    }

    if (room.is_locked) {
      return NextResponse.json(
        { error: "This room is currently locked" },
        { status: 403 },
      );
    }

    // 4. Check if already joined
    const { data: existingParticipant } = await supabase
      .from("participants")
      .select("*")
      .eq("room_id", room.id)
      .eq("auth_user_id", userId)
      .single();

    if (existingParticipant) {
      return NextResponse.json({
        participant: existingParticipant,
        room: room,
        isRejoining: true,
      });
    }

    // 5. Register new participant
    const participantCode = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();

    const { data: newParticipant, error: insertError } = await serviceRole
      .from("participants")
      .insert([
        {
          room_id: room.id,
          auth_user_id: userId,
          register_no: profile.register_no,
          student_name: profile.student_name,
          department: profile.department,
          section: profile.section,
          participant_code: participantCode,
          status: "joined",
          score: 0,
          percentage: 0,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Participant creation error:", insertError);
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "You have already joined this room with this register number.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Failed to join room" },
        { status: 500 },
      );
    }

    // Log Activity
    await serviceRole.from("activity_logs").insert([
      {
        room_id: room.id,
        action: "student_joined",
        details: {
          student_name: profile.student_name,
          register_no: profile.register_no,
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    return NextResponse.json({
      participant: newParticipant,
      room: room,
      isRejoining: false,
    });
  } catch (error: any) {
    console.error("Join API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
