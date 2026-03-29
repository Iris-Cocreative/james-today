-- Migration: Task enhancements
-- Add importance, urgency, flagging, and target week to tasks

ALTER TABLE tasks
  ADD COLUMN importance text NOT NULL DEFAULT 'med'
    CHECK (importance IN ('low','med','high')),
  ADD COLUMN is_urgent boolean DEFAULT false,
  ADD COLUMN is_flagged boolean DEFAULT false,
  ADD COLUMN target_week date;

CREATE INDEX idx_tasks_importance ON tasks(importance);
CREATE INDEX idx_tasks_urgent ON tasks(is_urgent) WHERE is_urgent = true;
CREATE INDEX idx_tasks_flagged ON tasks(is_flagged) WHERE is_flagged = true;
CREATE INDEX idx_tasks_target_week ON tasks(target_week) WHERE target_week IS NOT NULL;
