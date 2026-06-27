-- Migration V2: Real-time features and advanced anti-cheat
-- Please run this script in your Supabase SQL Editor

-- 1. Add pause functionality to rooms
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pause_time TIMESTAMP WITH TIME ZONE;

-- 2. Add online tracking and anti-cheat fields to participants
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS browser_info TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 3. Add categorization to questions for AI generation and better organization
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS subject TEXT,  
ADD COLUMN IF NOT EXISTS semester TEXT;

-- 4. Create indexes to handle 300+ concurrent students efficiently
CREATE INDEX IF NOT EXISTS idx_participants_room_id_status ON public.participants(room_id, status);
CREATE INDEX IF NOT EXISTS idx_answers_participant_question ON public.answers(participant_id, question_id);
CREATE INDEX IF NOT EXISTS idx_participants_room_id_online ON public.participants(room_id, is_online);
