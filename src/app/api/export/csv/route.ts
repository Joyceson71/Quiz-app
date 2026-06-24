import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room_id');

    if (!roomId) {
      return NextResponse.json({ error: 'room_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get room info
    const { data: room } = await supabase
      .from('rooms')
      .select('room_name, room_code')
      .eq('id', roomId)
      .single();

    // Get participants with their violations
    const { data: participants, error } = await supabase
      .from('participants')
      .select('register_no, student_name, department, section, score, percentage, rank, submission_time, has_submitted, status')
      .eq('room_id', roomId)
      .order('rank', { ascending: true, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build CSV
    const headers = [
      'Rank',
      'Register No',
      'Name',
      'Department',
      'Section',
      'Score',
      'Percentage',
      'Status',
      'Submission Time',
    ];

    const rows = (participants || []).map((p) => [
      p.rank || 'N/A',
      p.register_no,
      p.student_name,
      p.department,
      p.section,
      p.score,
      `${p.percentage}%`,
      p.has_submitted ? 'Submitted' : p.status,
      p.submission_time ? new Date(p.submission_time).toLocaleString('en-IN') : 'N/A',
    ]);

    const csvContent = [
      `Quiz: ${room?.room_name || 'Unknown'} (${room?.room_code || ''})`,
      `Exported: ${new Date().toLocaleString('en-IN')}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="quiz_results_${room?.room_code || roomId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export CSV error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
