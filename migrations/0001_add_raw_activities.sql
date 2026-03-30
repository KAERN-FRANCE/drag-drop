-- Add raw_activities column to analyses table for period re-analysis
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS raw_activities TEXT;
