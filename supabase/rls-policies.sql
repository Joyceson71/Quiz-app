-- ============================================
-- Row Level Security Policies
-- Technical Quiz Competition Platform
-- ============================================

-- ============================================
-- ADMINS TABLE
-- ============================================
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Admins can read their own record
DROP POLICY IF EXISTS "admins_select_own" ON public.admins;
CREATE POLICY "admins_select_own" ON public.admins
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Service role can manage admins
DROP POLICY IF EXISTS "admins_service_all" ON public.admins;
CREATE POLICY "admins_service_all" ON public.admins
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- ROOMS TABLE
-- ============================================
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view rooms (for joining)
DROP POLICY IF EXISTS "rooms_select_all" ON public.rooms;
CREATE POLICY "rooms_select_all" ON public.rooms
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can create rooms
DROP POLICY IF EXISTS "rooms_insert_admin" ON public.rooms;
CREATE POLICY "rooms_insert_admin" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Only admins can update rooms
DROP POLICY IF EXISTS "rooms_update_admin" ON public.rooms;
CREATE POLICY "rooms_update_admin" ON public.rooms
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Only admins can delete rooms
DROP POLICY IF EXISTS "rooms_delete_admin" ON public.rooms;
CREATE POLICY "rooms_delete_admin" ON public.rooms
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
DROP POLICY IF EXISTS "rooms_service_all" ON public.rooms;
CREATE POLICY "rooms_service_all" ON public.rooms
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Allow anonymous users to view rooms (for joining)
DROP POLICY IF EXISTS "rooms_select_anon" ON public.rooms;
CREATE POLICY "rooms_select_anon" ON public.rooms
  FOR SELECT TO anon
  USING (true);

-- ============================================
-- PARTICIPANTS TABLE
-- ============================================
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Participants can view others in same room (for leaderboard)
DROP POLICY IF EXISTS "participants_select_same_room" ON public.participants;
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
DROP POLICY IF EXISTS "participants_select_admin" ON public.participants;
CREATE POLICY "participants_select_admin" ON public.participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Participants can update their own record (for submission)
DROP POLICY IF EXISTS "participants_update_own" ON public.participants;
CREATE POLICY "participants_update_own" ON public.participants
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Service role full access (for registration)
DROP POLICY IF EXISTS "participants_service_all" ON public.participants;
CREATE POLICY "participants_service_all" ON public.participants
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- QUESTIONS TABLE
-- ============================================
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with questions
DROP POLICY IF EXISTS "questions_admin_all" ON public.questions;
CREATE POLICY "questions_admin_all" ON public.questions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
DROP POLICY IF EXISTS "questions_service_all" ON public.questions;
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
DROP POLICY IF EXISTS "room_questions_select_auth" ON public.room_questions;
CREATE POLICY "room_questions_select_auth" ON public.room_questions
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage room questions
DROP POLICY IF EXISTS "room_questions_admin_all" ON public.room_questions;
CREATE POLICY "room_questions_admin_all" ON public.room_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
DROP POLICY IF EXISTS "room_questions_service_all" ON public.room_questions;
CREATE POLICY "room_questions_service_all" ON public.room_questions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- ANSWERS TABLE
-- ============================================
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Students can insert/update their own answers
DROP POLICY IF EXISTS "answers_upsert_own" ON public.answers;
CREATE POLICY "answers_upsert_own" ON public.answers
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "answers_update_own" ON public.answers;
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
DROP POLICY IF EXISTS "answers_select_own" ON public.answers;
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
DROP POLICY IF EXISTS "answers_admin_select" ON public.answers;
CREATE POLICY "answers_admin_select" ON public.answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
DROP POLICY IF EXISTS "answers_service_all" ON public.answers;
CREATE POLICY "answers_service_all" ON public.answers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- VIOLATIONS TABLE
-- ============================================
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

-- Students can insert violations (logged by anti-cheat)
DROP POLICY IF EXISTS "violations_insert_own" ON public.violations;
CREATE POLICY "violations_insert_own" ON public.violations
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
  );

-- Students can view their own violations
DROP POLICY IF EXISTS "violations_select_own" ON public.violations;
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
DROP POLICY IF EXISTS "violations_admin_select" ON public.violations;
CREATE POLICY "violations_admin_select" ON public.violations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
DROP POLICY IF EXISTS "violations_service_all" ON public.violations;
CREATE POLICY "violations_service_all" ON public.violations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- ACTIVITY_LOGS TABLE
-- ============================================
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Students can insert their own logs
DROP POLICY IF EXISTS "activity_logs_insert_own" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_own" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM public.participants WHERE auth_user_id = auth.uid()
    )
  );

-- Admins can view all logs
DROP POLICY IF EXISTS "activity_logs_admin_select" ON public.activity_logs;
CREATE POLICY "activity_logs_admin_select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
  );

-- Service role full access
DROP POLICY IF EXISTS "activity_logs_service_all" ON public.activity_logs;
CREATE POLICY "activity_logs_service_all" ON public.activity_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
