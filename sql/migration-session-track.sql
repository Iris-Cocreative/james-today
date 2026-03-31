-- Add track column for vertical positioning on timeline
ALTER TABLE time_sessions ADD COLUMN IF NOT EXISTS track integer DEFAULT 0;
