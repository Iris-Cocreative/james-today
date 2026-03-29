-- Migration: Project domains
-- Add planetary domain classification to projects

ALTER TABLE projects
  ADD COLUMN domain text
    CHECK (domain IN ('mula','dharma','seva','karma','vidya','sangha','prema','moksha'));

CREATE INDEX idx_projects_domain ON projects(domain) WHERE domain IS NOT NULL;
