-- ============================================
-- PostgreSQL Functions
-- Technical Quiz Competition Platform
-- ============================================

-- ============================================
-- Generate unique 6-character room code
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6-character alphanumeric code
    new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.rooms WHERE room_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Generate unique participant code
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_participant_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'QZ-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
    
    SELECT EXISTS(SELECT 1 FROM public.participants WHERE participant_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Calculate scores for all participants in a room
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_scores(target_room_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Update scores based on correct answers
  UPDATE public.participants p
  SET 
    score = (
      SELECT COALESCE(COUNT(*), 0)
      FROM public.answers a
      WHERE a.participant_id = p.id 
        AND a.is_correct = TRUE
    ),
    percentage = (
      SELECT COALESCE(
        ROUND((COUNT(*) FILTER (WHERE a.is_correct = TRUE)::DECIMAL / NULLIF(p.total_marks, 0)) * 100, 2),
        0
      )
      FROM public.answers a
      WHERE a.participant_id = p.id
    )
  WHERE p.room_id = target_room_id
    AND p.has_submitted = TRUE;

  -- Update ranks based on score (higher score = better rank, ties broken by submission time)
  WITH ranked AS (
    SELECT 
      id,
      RANK() OVER (
        ORDER BY score DESC, submission_time ASC
      ) as new_rank
    FROM public.participants
    WHERE room_id = target_room_id
      AND has_submitted = TRUE
  )
  UPDATE public.participants p
  SET rank = r.new_rank
  FROM ranked r
  WHERE p.id = r.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Submit quiz and calculate individual score
-- ============================================
CREATE OR REPLACE FUNCTION public.submit_quiz(target_participant_id UUID)
RETURNS TABLE(
  final_score INTEGER,
  final_percentage DECIMAL,
  final_rank INTEGER,
  total_questions INTEGER,
  correct_count INTEGER
) AS $$
DECLARE
  v_room_id UUID;
  v_score INTEGER;
  v_total INTEGER;
  v_percentage DECIMAL;
  v_rank INTEGER;
BEGIN
  -- Get room_id for this participant
  SELECT p.room_id, p.total_marks INTO v_room_id, v_total
  FROM public.participants p
  WHERE p.id = target_participant_id;

  -- Count correct answers
  SELECT COALESCE(COUNT(*), 0) INTO v_score
  FROM public.answers a
  WHERE a.participant_id = target_participant_id
    AND a.is_correct = TRUE;

  -- Calculate percentage
  v_percentage := ROUND((v_score::DECIMAL / NULLIF(v_total, 0)) * 100, 2);

  -- Update participant
  UPDATE public.participants
  SET 
    score = v_score,
    percentage = v_percentage,
    has_submitted = TRUE,
    status = 'submitted',
    submission_time = NOW()
  WHERE id = target_participant_id;

  -- Recalculate ranks for entire room
  WITH ranked AS (
    SELECT 
      p.id,
      RANK() OVER (
        ORDER BY p.score DESC, p.submission_time ASC
      ) as new_rank
    FROM public.participants p
    WHERE p.room_id = v_room_id
      AND p.has_submitted = TRUE
  )
  UPDATE public.participants p
  SET rank = r.new_rank
  FROM ranked r
  WHERE p.id = r.id;

  -- Get this participant's rank
  SELECT p.rank INTO v_rank
  FROM public.participants p
  WHERE p.id = target_participant_id;

  RETURN QUERY SELECT v_score, v_percentage, v_rank, v_total, v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Get leaderboard for a room
-- ============================================
CREATE OR REPLACE FUNCTION public.get_leaderboard(target_room_id UUID)
RETURNS TABLE(
  participant_id UUID,
  student_name TEXT,
  department TEXT,
  section TEXT,
  score INTEGER,
  percentage DECIMAL,
  rank INTEGER,
  submission_time TIMESTAMPTZ,
  register_no TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as participant_id,
    p.student_name,
    p.department,
    p.section,
    p.score,
    p.percentage,
    p.rank,
    p.submission_time,
    p.register_no
  FROM public.participants p
  WHERE p.room_id = target_room_id
    AND p.has_submitted = TRUE
  ORDER BY p.score DESC, p.submission_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Assign randomized questions to a room
-- ============================================
CREATE OR REPLACE FUNCTION public.assign_questions_to_room(target_room_id UUID)
RETURNS VOID AS $$
DECLARE
  q RECORD;
  counter INTEGER := 1;
BEGIN
  -- Delete existing room questions
  DELETE FROM public.room_questions WHERE room_id = target_room_id;

  -- Insert all questions with randomized order
  FOR q IN 
    SELECT id FROM public.questions ORDER BY RANDOM()
  LOOP
    INSERT INTO public.room_questions (room_id, question_id, display_order)
    VALUES (target_room_id, q.id, counter);
    counter := counter + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Get room statistics
-- ============================================
CREATE OR REPLACE FUNCTION public.get_room_stats(target_room_id UUID)
RETURNS TABLE(
  total_participants BIGINT,
  active_participants BIGINT,
  submitted_participants BIGINT,
  disqualified_participants BIGINT,
  average_score DECIMAL,
  highest_score INTEGER,
  lowest_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_participants,
    COUNT(*) FILTER (WHERE p.status = 'in_quiz')::BIGINT as active_participants,
    COUNT(*) FILTER (WHERE p.has_submitted = TRUE)::BIGINT as submitted_participants,
    COUNT(*) FILTER (WHERE p.status = 'disqualified')::BIGINT as disqualified_participants,
    COALESCE(ROUND(AVG(p.score) FILTER (WHERE p.has_submitted = TRUE), 2), 0) as average_score,
    COALESCE(MAX(p.score) FILTER (WHERE p.has_submitted = TRUE), 0) as highest_score,
    COALESCE(MIN(p.score) FILTER (WHERE p.has_submitted = TRUE), 0) as lowest_score
  FROM public.participants p
  WHERE p.room_id = target_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Get question-wise accuracy
-- ============================================
CREATE OR REPLACE FUNCTION public.get_question_accuracy(target_room_id UUID)
RETURNS TABLE(
  question_id UUID,
  question_text TEXT,
  total_attempts BIGINT,
  correct_attempts BIGINT,
  accuracy_percentage DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id as question_id,
    q.question as question_text,
    COUNT(a.id)::BIGINT as total_attempts,
    COUNT(a.id) FILTER (WHERE a.is_correct = TRUE)::BIGINT as correct_attempts,
    COALESCE(
      ROUND(
        (COUNT(a.id) FILTER (WHERE a.is_correct = TRUE)::DECIMAL / NULLIF(COUNT(a.id), 0)) * 100, 
        2
      ), 
      0
    ) as accuracy_percentage
  FROM public.questions q
  LEFT JOIN public.answers a ON q.id = a.question_id AND a.room_id = target_room_id
  GROUP BY q.id, q.question
  ORDER BY q.question_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Get department-wise scores
-- ============================================
CREATE OR REPLACE FUNCTION public.get_department_scores(target_room_id UUID)
RETURNS TABLE(
  department TEXT,
  participant_count BIGINT,
  average_score DECIMAL,
  highest_score INTEGER,
  average_percentage DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.department,
    COUNT(*)::BIGINT as participant_count,
    ROUND(AVG(p.score), 2) as average_score,
    MAX(p.score) as highest_score,
    ROUND(AVG(p.percentage), 2) as average_percentage
  FROM public.participants p
  WHERE p.room_id = target_room_id
    AND p.has_submitted = TRUE
  GROUP BY p.department
  ORDER BY average_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
