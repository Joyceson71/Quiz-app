import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

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
      .select('room_name, room_code, created_at, duration_minutes')
      .eq('id', roomId)
      .single();

    // Get participants
    const { data: participants } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .order('rank', { ascending: true, nullsFirst: false });

    // Get violations summary
    const { data: violations } = await supabase
      .from('violations')
      .select('participant_id, violation_type')
      .eq('room_id', roomId);

    // Count violations per participant
    const violationCounts: Record<string, number> = {};
    violations?.forEach(v => {
      violationCounts[v.participant_id] = (violationCounts[v.participant_id] || 0) + 1;
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Results sheet
    const resultsData = (participants || []).map(p => ({
      'Rank': p.rank || 'N/A',
      'Register No': p.register_no,
      'Name': p.student_name,
      'Department': p.department,
      'Section': p.section,
      'Score': p.score,
      'Total': p.total_marks,
      'Percentage': `${p.percentage}%`,
      'Status': p.has_submitted ? 'Submitted' : p.status,
      'Violations': violationCounts[p.id] || 0,
      'Submission Time': p.submission_time
        ? new Date(p.submission_time).toLocaleString('en-IN')
        : 'N/A',
    }));

    const ws1 = XLSX.utils.json_to_sheet(resultsData);
    
    // Set column widths
    ws1['!cols'] = [
      { wch: 6 },  // Rank
      { wch: 15 }, // Register No
      { wch: 25 }, // Name
      { wch: 12 }, // Department
      { wch: 8 },  // Section
      { wch: 6 },  // Score
      { wch: 6 },  // Total
      { wch: 10 }, // Percentage
      { wch: 12 }, // Status
      { wch: 10 }, // Violations
      { wch: 22 }, // Submission Time
    ];
    
    XLSX.utils.book_append_sheet(wb, ws1, 'Results');

    // Summary sheet
    const submitted = participants?.filter(p => p.has_submitted) || [];
    const avgScore = submitted.length > 0
      ? (submitted.reduce((sum, p) => sum + p.score, 0) / submitted.length).toFixed(2)
      : '0';

    const summaryData = [
      { 'Metric': 'Quiz Name', 'Value': room?.room_name || '' },
      { 'Metric': 'Room Code', 'Value': room?.room_code || '' },
      { 'Metric': 'Duration', 'Value': `${room?.duration_minutes || 20} minutes` },
      { 'Metric': 'Total Participants', 'Value': participants?.length || 0 },
      { 'Metric': 'Submitted', 'Value': submitted.length },
      { 'Metric': 'Average Score', 'Value': avgScore },
      { 'Metric': 'Highest Score', 'Value': submitted.length > 0 ? Math.max(...submitted.map(p => p.score)) : 0 },
      { 'Metric': 'Lowest Score', 'Value': submitted.length > 0 ? Math.min(...submitted.map(p => p.score)) : 0 },
      { 'Metric': 'Export Date', 'Value': new Date().toLocaleString('en-IN') },
    ];

    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    ws2['!cols'] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="quiz_results_${room?.room_code || roomId}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export Excel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
