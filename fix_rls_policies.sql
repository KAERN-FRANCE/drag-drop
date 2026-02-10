-- ==========================================
-- FIX RLS POLICIES FOR DRIVER CREATION
-- ==========================================
-- This fixes the "row violates row-level security policy" error when creating drivers

-- 1. Drop existing INSERT policies for drivers
DROP POLICY IF EXISTS "Users can create drivers in their company" ON drivers;

-- 2. Create a more permissive INSERT policy for drivers
-- Allow insert if:
-- - company_id is NULL (will be set by trigger)
-- - OR company_id matches user's company
CREATE POLICY "Users can create drivers in their company"
  ON drivers FOR INSERT
  WITH CHECK (
    -- Allow if company_id is NULL (trigger will set it)
    company_id IS NULL
    OR
    -- Allow if company_id matches user's company
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- 3. Drop and recreate the trigger to ensure it runs properly
DROP TRIGGER IF EXISTS set_company_id_on_driver_insert ON drivers;

-- 4. Recreate the function with better error handling
CREATE OR REPLACE FUNCTION set_company_id()
RETURNS TRIGGER AS $$
DECLARE
  user_company_id UUID;
BEGIN
  -- Only set company_id if it's NULL
  IF NEW.company_id IS NULL THEN
    -- Get the company_id for the current user
    SELECT company_id INTO user_company_id
    FROM user_companies
    WHERE user_id = auth.uid()
    LIMIT 1;

    -- If we found a company_id, use it
    IF user_company_id IS NOT NULL THEN
      NEW.company_id := user_company_id;
    ELSE
      -- If no company found, raise an error
      RAISE EXCEPTION 'User is not associated with any company. Please ensure user is registered properly.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate the trigger
CREATE TRIGGER set_company_id_on_driver_insert
  BEFORE INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id();

-- 6. Also fix infractions INSERT policy
DROP POLICY IF EXISTS "Users can create infractions in their company" ON infractions;

CREATE POLICY "Users can create infractions in their company"
  ON infractions FOR INSERT
  WITH CHECK (
    -- Allow if company_id is NULL (trigger will set it)
    company_id IS NULL
    OR
    -- Allow if company_id matches user's company
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- 7. Recreate the infraction trigger
DROP TRIGGER IF EXISTS set_company_id_on_infraction_insert ON infractions;

CREATE TRIGGER set_company_id_on_infraction_insert
  BEFORE INSERT ON infractions
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id();

-- 8. Create a helper function to check if user is properly registered
CREATE OR REPLACE FUNCTION check_user_registration()
RETURNS TABLE(
  user_id UUID,
  has_company BOOLEAN,
  company_name TEXT,
  role TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    auth.uid() as user_id,
    EXISTS(SELECT 1 FROM user_companies WHERE user_id = auth.uid()) as has_company,
    c.name as company_name,
    uc.role
  FROM user_companies uc
  JOIN companies c ON c.id = uc.company_id
  WHERE uc.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test query to check your registration:
-- SELECT * FROM check_user_registration();
