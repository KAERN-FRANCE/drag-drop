-- ==========================================
-- MULTI-TENANT SECURITY FOR TACHOCOMPLIANCE
-- ==========================================
-- This migration adds company isolation to ensure each company only sees its own data

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  siret TEXT,
  driver_count TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add company_id to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON drivers(company_id);

-- 3. Add company_id to infractions table
ALTER TABLE infractions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_infractions_company_id ON infractions(company_id);

-- 4. Add company_id to analyses table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analyses') THEN
    ALTER TABLE analyses ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_analyses_company_id ON analyses(company_id);
  END IF;
END $$;

-- 5. Create user_companies junction table (maps users to companies)
CREATE TABLE IF NOT EXISTS user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'driver', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON user_companies(company_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;

-- Also enable RLS on analyses if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analyses') THEN
    ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 7. Create RLS Policies for companies
-- Users can only see companies they belong to
CREATE POLICY "Users can view their own companies"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert companies (for registration)
CREATE POLICY "Users can create companies"
  ON companies FOR INSERT
  WITH CHECK (true);

-- Users can update their own companies
CREATE POLICY "Users can update their own companies"
  ON companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 8. Create RLS Policies for drivers
-- Users can only see drivers from their company
CREATE POLICY "Users can view drivers from their company"
  ON drivers FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert drivers to their company
CREATE POLICY "Users can create drivers in their company"
  ON drivers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Users can update drivers from their company
CREATE POLICY "Users can update drivers from their company"
  ON drivers FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Users can delete drivers from their company
CREATE POLICY "Users can delete drivers from their company"
  ON drivers FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 9. Create RLS Policies for infractions
-- Users can only see infractions from their company
CREATE POLICY "Users can view infractions from their company"
  ON infractions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert infractions to their company
CREATE POLICY "Users can create infractions in their company"
  ON infractions FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- 10. Create function to get user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM user_companies
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 11. Create function to automatically set company_id on insert
CREATE OR REPLACE FUNCTION set_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := get_user_company_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create triggers to auto-set company_id
DROP TRIGGER IF EXISTS set_company_id_on_driver_insert ON drivers;
CREATE TRIGGER set_company_id_on_driver_insert
  BEFORE INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id();

DROP TRIGGER IF EXISTS set_company_id_on_infraction_insert ON infractions;
CREATE TRIGGER set_company_id_on_infraction_insert
  BEFORE INSERT ON infractions
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id();

-- 13. Update existing drivers to assign them to a default company (DEMO ONLY)
-- In production, you would need to properly assign existing data
DO $$
DECLARE
  demo_company_id UUID;
BEGIN
  -- Create a demo company for existing data
  INSERT INTO companies (name, siret, driver_count)
  VALUES ('Entreprise Demo', '12345678900012', '6-20')
  RETURNING id INTO demo_company_id;

  -- Assign all existing drivers to demo company
  UPDATE drivers SET company_id = demo_company_id WHERE company_id IS NULL;

  -- Assign all existing infractions to demo company
  UPDATE infractions SET company_id = demo_company_id WHERE company_id IS NULL;
END $$;

-- 14. Add comment
COMMENT ON TABLE companies IS 'Stores company information for multi-tenant isolation';
COMMENT ON TABLE user_companies IS 'Maps users to companies with their roles';
COMMENT ON COLUMN drivers.company_id IS 'Links driver to a specific company for data isolation';
COMMENT ON COLUMN infractions.company_id IS 'Links infraction to a specific company for data isolation';
