import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room_id');
    const participantId = searchParams.get('participant_id');

    if (!roomId) {
      return NextResponse.json({ error: 'room_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get room questions with their display order
    const { data: roomQuestions, error: rqError } = await supabase
      .from('room_questions')
      .select('question_id, display_order')
      .eq('room_id', roomId)
      .order('display_order', { ascending: true });

    if (rqError || !roomQuestions?.length) {
      // Check if this room uses custom_questions (host-created room)
      const { data: customQuestions, error: cqError } = await supabase
        .from('custom_questions')
        .select('id, question, option_a, option_b, option_c, option_d, marks, display_order')
        .eq('room_id', roomId)
        .order('display_order', { ascending: true });

      if (cqError || !customQuestions?.length) {
        return NextResponse.json({ error: 'No questions found for this room' }, { status: 404 });
      }

      // Determine or persist question order for this participant
      let finalOrder: string[] = customQuestions.map(q => q.id);

      if (participantId) {
        const { data: participantData } = await supabase
          .from('participants')
          .select('question_order')
          .eq('id', participantId)
          .single();

        if (participantData?.question_order && Array.isArray(participantData.question_order) && participantData.question_order.length > 0) {
          finalOrder = participantData.question_order;
        } else {
          const shuffled = [...finalOrder].sort(() => Math.random() - 0.5);
          finalOrder = shuffled;
          await supabase.from('participants').update({ question_order: shuffled }).eq('id', participantId);
        }
      }

      const sortedCustom = [...customQuestions].sort((a, b) => {
        const ia = finalOrder.indexOf(a.id);
        const ib = finalOrder.indexOf(b.id);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      // Get existing answers
      let existingAnswers: Record<string, string> = {};
      if (participantId) {
        const { data: answers } = await supabase
          .from('answers')
          .select('question_id, selected_answer')
          .eq('participant_id', participantId);
        if (answers) {
          existingAnswers = Object.fromEntries(answers.map(a => [a.question_id, a.selected_answer]));
        }
      }

      return NextResponse.json({
        questions: sortedCustom,
        existing_answers: existingAnswers,
        total: sortedCustom.length,
      });
    }

    const questionIds = roomQuestions.map(rq => rq.question_id);

    // Get safe questions (without correct_answer)
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, question, option_a, option_b, option_c, option_d, marks, question_order')
      .in('id', questionIds);

    if (qError) {
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }

    let finalOrder: string[] = [];
    
    if (participantId) {
      // Check if participant already has a saved question order
      const { data: participantData } = await supabase
        .from('participants')
        .select('question_order')
        .eq('id', participantId)
        .single();
        
      if (participantData?.question_order && Array.isArray(participantData.question_order) && participantData.question_order.length > 0) {
        finalOrder = participantData.question_order;
      } else {
        // Generate a new shuffled order
        const shuffledIds = [...questionIds].sort(() => Math.random() - 0.5);
        finalOrder = shuffledIds;
        
        // Save to DB
        await supabase
          .from('participants')
          .update({ question_order: shuffledIds })
          .eq('id', participantId);
      }
    } else {
      // Fallback to room's display order if no participant (e.g. preview)
      finalOrder = [...questionIds].sort((a, b) => {
        const orderA = roomQuestions.find(rq => rq.question_id === a)?.display_order || 0;
        const orderB = roomQuestions.find(rq => rq.question_id === b)?.display_order || 0;
        return orderA - orderB;
      });
    }

    // Sort questions by the final order
    const sortedQuestions = questions?.sort((a, b) => {
      const indexA = finalOrder.indexOf(a.id);
      const indexB = finalOrder.indexOf(b.id);
      
      // Handle edge cases where a question might not be in the order array
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    // Get existing answers for this participant (for resume)
    let existingAnswers: Record<string, string> = {};
    if (participantId) {
      const { data: answers } = await supabase
        .from('answers')
        .select('question_id, selected_answer')
        .eq('participant_id', participantId);

      if (answers) {
        existingAnswers = Object.fromEntries(
          answers.map(a => [a.question_id, a.selected_answer])
        );
      }
    }

    return NextResponse.json({
      questions: sortedQuestions,
      existing_answers: existingAnswers,
      total: sortedQuestions?.length || 0,
    });
  } catch (error) {
    console.error('Get questions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
