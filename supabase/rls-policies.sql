-- ============================================
-- Row Level Security Policies
-- CSE & IT Quiz Competition Platform
-- ============================================

-- ============================================
-- ADMINS TABLE
-- ============================================
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Admins can read their own record
CREATE POLICY "admins_select_own" ON public.admins
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Service role can manage admins
CREATE POLICY "admins_service_all" ON public.admins
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- ROOMS TABLE
-- ============================================
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view rooms (for joining)
CREATE POLICY "rooms_select_all" ON public.rooms
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can create rooms
CREATE POLICY "rooms_insert_admin" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Only admins can update rooms
CREATE POLICY "rooms_update_admin" ON public.rooms
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Only admins can delete rooms
CREATE POLICY "rooms_delete_admin" ON public.rooms
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
CREATE POLICY "rooms_service_all" ON public.rooms
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Allow anonymous users to view rooms (for joining)
CREATE POLICY "rooms_select_anon" ON public.rooms
  FOR SELECT TO anon
  USING (true);

-- ============================================
-- PARTICIPANTS TABLE
-- ============================================
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Participants can view others in same room (for leaderboard)
CREATE POLICY "participants_select_same_room" ON public.participants
  FOR SELECT TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM public.participants WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Admins can view all participants
CREATE POLICY "participants_select_admin" ON public.participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Participants can update their own record (for submission)
CREATE POLICY "participants_update_own" ON public.participants
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Service role full access (for registration)
CREATE POLICY "participants_service_all" ON public.participants
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- QUESTIONS TABLE
-- ============================================
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with questions
CREATE POLICY "questions_admin_all" ON public.questions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
CREATE POLICY "questions_service_all" ON public.questions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Students should use questions_safe view instead
-- No direct SELECT policy for students on questions table

-- ============================================
-- ROOM_QUESTIONS TABLE
-- ============================================
ALTER TABLE public.room_questions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view room questions
CREATE POLICY "room_questions_select_auth" ON public.room_questions
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage room questions
CREATE POLICY "room_questions_admin_all" ON public.room_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
CREATE POLICY "room_questions_service_all" ON public.room_questions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- ANSWERS TABLE
-- ============================================
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Students can insert/update their own answers
CREATE POLICY "answers_upsert_own" ON public.answers
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "answers_update_own" ON public.answers
  FOR UPDATE TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
  );

-- Students can view their own answers
CREATE POLICY "answers_select_own" ON public.answers
  FOR SELECT TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Admins can view all answers
CREATE POLICY "answers_admin_select" ON public.answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
CREATE POLICY "answers_service_all" ON public.answers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- VIOLATIONS TABLE
-- ============================================
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

-- Students can insert violations (logged by anti-cheat)
CREATE POLICY "violations_insert_own" ON public.violations
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
  );

-- Students can view their own violations
CREATE POLICY "violations_select_own" ON public.violations
  FOR SELECT TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Admins can view all violations
CREATE POLICY "violations_admin_select" ON public.violations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
CREATE POLICY "violations_service_all" ON public.violations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- ACTIVITY_LOGS TABLE
-- ============================================
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Students can insert their own logs
CREATE POLICY "activity_logs_insert_own" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
  );

-- Admins can view all logs
CREATE POLICY "activity_logs_admin_select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
CREATE POLICY "activity_logs_service_all" ON public.activity_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
