-- Journal table for daily reflections
CREATE TABLE IF NOT EXISTS journal (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date date NOT NULL UNIQUE,
  working_on text,
  intention text,
  learned text,
  grateful_for text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_journal_updated_at
  BEFORE UPDATE ON journal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON journal
  FOR ALL USING (auth.role() = 'authenticated');

-- Add height and sort_order to projects (for resizable cards and drag reorder)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS height integer DEFAULT 48;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Add height to tasks (for resizable cards)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS height integer DEFAULT 36;
