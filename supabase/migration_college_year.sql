ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS college_year TEXT NOT NULL DEFAULT 'Year 1';
