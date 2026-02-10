-- =============================================
-- SETUP COMPLET SUPABASE - TachoCompliance
-- Exécuter ce script dans le SQL Editor de Supabase
-- =============================================

-- 1. TABLE COMPANIES (entreprises)
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  siret TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLE USER_COMPANIES (liaison utilisateur ↔ entreprise)
CREATE TABLE IF NOT EXISTS user_companies (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLE DRIVERS (chauffeurs)
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  company_id INTEGER REFERENCES companies(id),
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLE ANALYSES (historique des analyses)
CREATE TABLE IF NOT EXISTS analyses (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('completed', 'processing', 'failed')) DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLE INFRACTIONS
CREATE TABLE IF NOT EXISTS infractions (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  analysis_id INTEGER REFERENCES analyses(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id),
  type TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. INDEX pour les performances
CREATE INDEX IF NOT EXISTS idx_infractions_driver_id ON infractions(driver_id);
CREATE INDEX IF NOT EXISTS idx_infractions_analysis_id ON infractions(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analyses_driver_id ON analyses(driver_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_analyses_company_id ON analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_infractions_company_id ON infractions(company_id);

-- 7. ACTIVER RLS (Row Level Security)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;

-- 8. POLICIES RLS
CREATE POLICY "Allow public read on companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Allow public write on companies" ON companies FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on user_companies" ON user_companies FOR SELECT USING (true);
CREATE POLICY "Allow public write on user_companies" ON user_companies FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on drivers" ON drivers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on drivers" ON drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on drivers" ON drivers FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on analyses" ON analyses FOR SELECT USING (true);
CREATE POLICY "Allow public insert on analyses" ON analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on analyses" ON analyses FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on infractions" ON infractions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on infractions" ON infractions FOR INSERT WITH CHECK (true);

-- 9. DONNÉES DE DÉMO
INSERT INTO companies (name, siret) VALUES ('Mon Entreprise', '00000000000000');

INSERT INTO drivers (name, initials, score, status, company_id) VALUES
('Pierre DELANOTTE', 'PD', 72, 'active', 1),
('Jean-Marc DUVAL', 'JD', 94, 'active', 1),
('Sophie MARTIN', 'SM', 88, 'active', 1),
('Lucas BERNARD', 'LB', 65, 'active', 1),
('Marie PETIT', 'MP', 91, 'active', 1),
('Thomas ROBERT', 'TR', 78, 'active', 1),
('Émilie MOREAU', 'EM', 85, 'active', 1),
('Antoine GARCIA', 'AG', 58, 'active', 1),
('Claire DUBOIS', 'CD', 92, 'active', 1),
('François LEROY', 'FL', 81, 'inactive', 1),
('Julie SIMON', 'JS', 89, 'active', 1),
('Marc LAURENT', 'ML', 73, 'active', 1);

INSERT INTO analyses (driver_id, company_id, period_start, period_end, upload_date, score, status) VALUES
(1, 1, '2024-09-01', '2025-02-28', NOW() - INTERVAL '2 days', 87, 'completed'),
(1, 1, '2024-06-01', '2024-12-31', NOW() - INTERVAL '1 month', 82, 'completed'),
(2, 1, '2024-05-01', '2024-05-15', NOW() - INTERVAL '5 days', 62, 'completed'),
(3, 1, '2024-05-01', '2024-05-15', NOW() - INTERVAL '3 days', 94, 'completed'),
(4, 1, '2024-05-01', '2024-05-15', NOW() - INTERVAL '1 week', 45, 'completed');

INSERT INTO infractions (driver_id, company_id, analysis_id, type, severity, date) VALUES
(1, 1, 1, 'Conduite >9h', 'medium', NOW() - INTERVAL '2 days'),
(1, 1, 1, 'Repos <11h', 'high', NOW() - INTERVAL '5 days'),
(4, 1, 5, 'Conduite >9h', 'medium', NOW() - INTERVAL '1 day'),
(4, 1, 5, 'Repos hebdo <45h', 'critical', NOW() - INTERVAL '3 days'),
(8, 1, NULL, 'Amplitude >12h', 'medium', NOW() - INTERVAL '1 week'),
(8, 1, NULL, 'Conduite hebdo >56h', 'critical', NOW() - INTERVAL '2 days');
