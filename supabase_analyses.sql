-- Drop table to ensure clean state and correct schema
DROP TABLE IF EXISTS analyses;

-- Create analyses table with correct schema
CREATE TABLE analyses (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  score INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'processing', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed analyses
INSERT INTO analyses (driver_id, period_start, period_end, upload_date, score, status) VALUES
(1, '2024-09-01', '2025-02-28', NOW() - INTERVAL '2 days', 87, 'completed'),
(1, '2024-06-01', '2024-12-31', NOW() - INTERVAL '1 month', 82, 'completed'),
(2, '2024-05-01', '2024-05-15', NOW() - INTERVAL '5 days', 62, 'completed'),
(3, '2024-05-01', '2024-05-15', NOW() - INTERVAL '3 days', 94, 'completed'),
(4, '2024-05-01', '2024-05-15', NOW() - INTERVAL '1 week', 45, 'completed'),
(5, '2024-05-16', '2024-05-31', NOW(), 0, 'processing');
