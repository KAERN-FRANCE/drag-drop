-- Add analysis_id column to infractions table to link infractions to specific analyses
ALTER TABLE infractions ADD COLUMN IF NOT EXISTS analysis_id INTEGER REFERENCES analyses(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_infractions_analysis_id ON infractions(analysis_id);
