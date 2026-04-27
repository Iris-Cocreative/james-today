-- Migration: Week view
-- Adds:
--   1. Six habit boolean columns on the journal table (sleep, meditation,
--      movement, home, nutrition, learning). Stored alongside the daily
--      reflection so a hard-refresh can't lose unpersisted state.
--   2. tasks.scheduled_date — pins a task to a specific day. The existing
--      tasks.target_week stays for week-level planning intent; scheduled_date
--      is set when a task is dragged onto a specific day card.

-- ---------------------------------------------------------------------------
-- Habits on journal
-- ---------------------------------------------------------------------------

ALTER TABLE journal
  ADD COLUMN IF NOT EXISTS sleep_done      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS meditation_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS movement_done   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_done       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nutrition_done  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS learning_done   boolean DEFAULT false;

-- ---------------------------------------------------------------------------
-- Per-day scheduling on tasks
-- ---------------------------------------------------------------------------

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS scheduled_date date;

CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date
  ON tasks(scheduled_date)
  WHERE scheduled_date IS NOT NULL;
