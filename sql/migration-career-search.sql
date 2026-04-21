-- ============================================================================
-- Migration: Career Search
-- Adds opportunities + conversations tables and seeds the Career Search project
-- + 5 milestone features leading up to the Wave conference (May 29, 2026).
-- ============================================================================

-- Ensure shared trigger function exists (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── opportunities ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company text NOT NULL,
  role_title text,
  source text,
  location text,
  is_remote boolean,
  comp_min integer,
  comp_max integer,
  comp_currency text DEFAULT 'USD',
  url text,
  status text NOT NULL DEFAULT 'researching'
    CHECK (status IN ('researching','applied','talking','interview','offer','closed','declined')),
  priority text NOT NULL DEFAULT 'med'
    CHECK (priority IN ('low','med','high')),
  fit_score integer CHECK (fit_score BETWEEN 1 AND 10),
  person_id uuid REFERENCES people(id) ON DELETE SET NULL,
  notes text,
  last_activity_at timestamptz,
  next_step text,
  next_step_date date,
  is_archived boolean DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status   ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_opportunities_person   ON opportunities(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_next     ON opportunities(next_step_date) WHERE next_step_date IS NOT NULL;

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON opportunities
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── conversations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE CASCADE,
  person_id uuid REFERENCES people(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  channel text CHECK (channel IN ('call','video','email','message','in_person','other')),
  direction text CHECK (direction IN ('inbound','outbound')),
  summary text NOT NULL,
  next_step text,
  next_step_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_opportunity ON conversations(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_person      ON conversations(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_occurred    ON conversations(occurred_at DESC);

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON conversations
  FOR ALL USING (auth.role() = 'authenticated');

-- Bump opportunities.last_activity_at whenever a conversation is added/updated
CREATE OR REPLACE FUNCTION touch_opportunity_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.opportunity_id IS NOT NULL THEN
    UPDATE opportunities
       SET last_activity_at = NEW.occurred_at
     WHERE id = NEW.opportunity_id
       AND (last_activity_at IS NULL OR last_activity_at < NEW.occurred_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conversation_touches_opportunity
  AFTER INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION touch_opportunity_activity();

-- ============================================================================
-- Seed: Career Search project + 5 milestone features
-- Idempotent: only inserts if a project named 'Career Search' doesn't exist.
-- ============================================================================
DO $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT id INTO v_project_id
  FROM projects
  WHERE name = 'Career Search'
  LIMIT 1;

  IF v_project_id IS NULL THEN
    INSERT INTO projects (name, description, status, type, color, domain)
    VALUES (
      'Career Search',
      'Researching and applying to roles. Target: have resume, site, research, recruiter conversation, and company conversations done by the Wave conference (May 29, 2026).',
      'building',
      'personal',
      '#c4956a',
      'mula'
    )
    RETURNING id INTO v_project_id;

    INSERT INTO features (project_id, title, description, status, importance, target_week, sort_order) VALUES
      (v_project_id, 'Updated resume',
        'Refresh resume with current work, IRIS, recent client outcomes, and core skill summary.',
        'planning', 'high', DATE '2026-04-27', 1),
      (v_project_id, 'Updated personal site (james.today)',
        'Site reflects current work, capabilities, and how to engage. Strong intro, recent work, contact path.',
        'planning', 'high', DATE '2026-05-04', 2),
      (v_project_id, 'Researched potential roles',
        'Identify role types worth pursuing, list target companies, gather job descriptions for reference.',
        'idea', 'high', DATE '2026-05-04', 3),
      (v_project_id, 'Talked to recruiter or career consultant',
        'At least one substantive conversation with a recruiter or career consultant for outside perspective.',
        'idea', 'med', DATE '2026-05-11', 4),
      (v_project_id, 'Talked to companies',
        'Initiate at least 3 conversations with target companies about possible work.',
        'idea', 'high', DATE '2026-05-18', 5);
  END IF;
END $$;
