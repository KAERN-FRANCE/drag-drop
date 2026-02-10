-- Add user_id and email columns to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
