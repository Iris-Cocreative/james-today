-- Migration: Features table
-- Features are the persistent material of the work — between projects and tasks

-- Create the trigger function if it doesn't already exist
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE features (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea','planning','scheduled','building','done','integrated')),
  importance text NOT NULL DEFAULT 'med'
    CHECK (importance IN ('low','med','high')),
  target_week date,
  is_flagged boolean DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN feature_id uuid REFERENCES features(id) ON DELETE SET NULL;

CREATE INDEX idx_features_project ON features(project_id);
CREATE INDEX idx_features_status ON features(status);
CREATE INDEX idx_features_target_week ON features(target_week) WHERE target_week IS NOT NULL;
CREATE INDEX idx_tasks_feature ON tasks(feature_id) WHERE feature_id IS NOT NULL;

CREATE TRIGGER update_features_updated_at
  BEFORE UPDATE ON features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything" ON features
  FOR ALL USING (auth.role() = 'authenticated');
