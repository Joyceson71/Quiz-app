-- ============================================
-- Technical Quiz Competition Platform
-- Complete Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ADMINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. ROOMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE NOT NULL,
  room_name TEXT NOT NULL,
  created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended')),
  quiz_start_time TIMESTAMPTZ,
  quiz_end_time TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  max_participants INTEGER NOT NULL DEFAULT 300,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  announcement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON public.rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);

-- ============================================
-- 3. QUESTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  marks INTEGER NOT NULL DEFAULT 1,
  question_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_order ON public.questions(question_order);

-- ============================================
-- 4. PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  register_no TEXT NOT NULL,
  student_name TEXT NOT NULL,
  department TEXT NOT NULL,
  section TEXT NOT NULL,
  participant_code TEXT UNIQUE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_marks INTEGER NOT NULL DEFAULT 20,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  rank INTEGER,
  submission_time TIMESTAMPTZ,
  has_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'in_quiz', 'submitted', 'disqualified')),
  question_order JSONB, -- Stores randomized question order for this participant
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate register numbers in the same room
  UNIQUE(room_id, register_no)
);

CREATE INDEX IF NOT EXISTS idx_participants_room_id ON public.participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_auth_user ON public.participants(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_participants_status ON public.participants(status);
CREATE INDEX IF NOT EXISTS idx_participants_score ON public.participants(score DESC);
CREATE INDEX IF NOT EXISTS idx_participants_room_score ON public.participants(room_id, score DESC, submission_time ASC);

-- ============================================
-- 5. ROOM_QUESTIONS TABLE (Junction for randomization)
-- ============================================
CREATE TABLE IF NOT EXISTS public.room_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(room_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_room_questions_room ON public.room_questions(room_id);
CREATE INDEX IF NOT EXISTS idx_room_questions_order ON public.room_questions(room_id, display_order);

-- ============================================
-- 6. ANSWERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  selected_answer TEXT CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One answer per question per participant
  UNIQUE(participant_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_participant ON public.answers(participant_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_room ON public.answers(room_id);

-- ============================================
-- 7. VIOLATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL CHECK (violation_type IN (
    'tab_switch',
    'fullscreen_exit',
    'copy_attempt',
    'paste_attempt',
    'cut_attempt',
    'right_click',
    'devtools_attempt',
    'auto_submit_tab_switch',
    'auto_submit_fullscreen'
  )),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violations_participant ON public.violations(participant_id);
CREATE INDEX IF NOT EXISTS idx_violations_room ON public.violations(room_id);
CREATE INDEX IF NOT EXISTS idx_violations_type ON public.violations(violation_type);

-- ============================================
-- 8. ACTIVITY_LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login',
    'join_room',
    'quiz_start',
    'answer_saved',
    'quiz_submit',
    'tab_switch',
    'fullscreen_exit',
    'fullscreen_enter',
    'page_refresh',
    'disconnected',
    'reconnected'
  )),
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_participant ON public.activity_logs(participant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_room ON public.activity_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON public.activity_logs(event_type);

-- ============================================
-- Enable Realtime for key tables
-- ============================================
-- ============================================
-- Enable Realtime for key tables
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rooms') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'answers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'violations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.violations;
  END IF;
END $$;

-- ============================================
-- Create a view that hides correct answers from students
-- ============================================
CREATE OR REPLACE VIEW public.questions_safe AS
SELECT 
  id,
  question,
  option_a,
  option_b,
  option_c,
  option_d,
  marks,
  question_order
FROM public.questions;

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'Medium',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.admins(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
