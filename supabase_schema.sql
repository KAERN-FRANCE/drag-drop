-- Create drivers table
CREATE TABLE drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  score INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create infractions table
CREATE TABLE infractions (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed drivers
INSERT INTO drivers (name, initials, score, status) VALUES
('Pierre DELANOTTE', 'PD', 72, 'active'),
('Jean-Marc DUVAL', 'JD', 94, 'active'),
('Sophie MARTIN', 'SM', 88, 'active'),
('Lucas BERNARD', 'LB', 65, 'active'),
('Marie PETIT', 'MP', 91, 'active'),
('Thomas ROBERT', 'TR', 78, 'active'),
('Émilie MOREAU', 'EM', 85, 'active'),
('Antoine GARCIA', 'AG', 58, 'active'),
('Claire DUBOIS', 'CD', 92, 'active'),
('François LEROY', 'FL', 81, 'inactive'),
('Julie SIMON', 'JS', 89, 'active'),
('Marc LAURENT', 'ML', 73, 'active');

-- Seed infractions (randomly assigned for demo)
INSERT INTO infractions (driver_id, type, severity, date) VALUES
(1, 'Conduite >9h', 'medium', NOW() - INTERVAL '2 days'),
(1, 'Repos <11h', 'high', NOW() - INTERVAL '5 days'),
(4, 'Conduite >9h', 'medium', NOW() - INTERVAL '1 day'),
(4, 'Repos hebdo <45h', 'critical', NOW() - INTERVAL '3 days'),
(8, 'Amplitude >12h', 'medium', NOW() - INTERVAL '1 week'),
(8, 'Conduite hebdo >56h', 'critical', NOW() - INTERVAL '2 days');
