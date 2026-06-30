-- ================================================
-- Migration: Self-Serve Host Rooms
-- Run this in your Supabase SQL Editor
-- ================================================

-- 1. Add host_token column to rooms (nullable — admin-created rooms won't have one)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_token TEXT;

-- 2. Add is_host_room flag so we know it's a self-serve room
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_host_room BOOLEAN DEFAULT FALSE;

-- 3. Create custom_questions table for host-uploaded questions
CREATE TABLE IF NOT EXISTS custom_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  option_a    TEXT NOT NULL,
  option_b    TEXT NOT NULL,
  option_c    TEXT NOT NULL,
  option_d    TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  marks       INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Index for fast lookups by room
CREATE INDEX IF NOT EXISTS idx_custom_questions_room_id ON custom_questions(room_id);

-- 5. RLS policies for custom_questions (service role bypasses these anyway)
ALTER TABLE custom_questions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read questions for a room they're participating in
CREATE POLICY "custom_questions_read" ON custom_questions
  FOR SELECT USING (true);

-- Only service role (API) can insert/update/delete
CREATE POLICY "custom_questions_service_insert" ON custom_questions
  FOR INSERT WITH CHECK (true);
