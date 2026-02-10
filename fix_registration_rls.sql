-- ==========================================
-- FIX REGISTRATION RLS ERRORS
-- ==========================================
-- Fixes:
-- 1. "new row violates row-level security policy for table companies"
-- 2. "User is not associated with any company"

-- PART 1: Fix Companies RLS Policies
-- =====================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create companies" ON companies;
DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
DROP POLICY IF EXISTS "Users can update their own companies" ON companies;

-- Allow authenticated users to insert companies (for registration)
CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can only view companies they belong to
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- Only admins can update their company
CREATE POLICY "Admins can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- PART 2: Fix user_companies RLS
-- ================================

-- Enable RLS on user_companies if not already enabled
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their associations" ON user_companies;
DROP POLICY IF EXISTS "Users can create associations" ON user_companies;

-- Allow authenticated users to insert (for registration)
CREATE POLICY "Authenticated users can create associations"
  ON user_companies FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() -- Can only create for themselves
  );

-- Users can view their own associations
CREATE POLICY "Users can view their associations"
  ON user_companies FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- PART 3: Create Registration Helper Function
-- ============================================

-- This function creates a company and links the user atomically
-- It bypasses RLS using SECURITY DEFINER
CREATE OR REPLACE FUNCTION register_company_admin(
  p_company_name TEXT,
  p_siret TEXT,
  p_driver_count TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  company_id UUID,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Create the company
  INSERT INTO companies (name, siret, driver_count)
  VALUES (p_company_name, p_siret, p_driver_count)
  RETURNING id INTO v_company_id;

  -- Link user to company
  INSERT INTO user_companies (user_id, company_id, role)
  VALUES (p_user_id, v_company_id, 'admin');

  -- Return success
  RETURN QUERY SELECT v_company_id, true, 'Company created successfully'::TEXT;

EXCEPTION WHEN OTHERS THEN
  -- Return error
  RETURN QUERY SELECT NULL::UUID, false, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION register_company_admin TO authenticated;

-- PART 4: Helper to Check User Status
-- ====================================

CREATE OR REPLACE FUNCTION get_user_company_info()
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  company_id UUID,
  company_name TEXT,
  role TEXT,
  is_linked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as user_email,
    uc.company_id,
    c.name as company_name,
    uc.role,
    EXISTS(SELECT 1 FROM user_companies WHERE user_id = auth.uid()) as is_linked
  FROM user_companies uc
  LEFT JOIN companies c ON c.id = uc.company_id
  WHERE uc.user_id = auth.uid()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_company_info TO authenticated;

-- PART 5: Fix Existing Users (Migration)
-- =======================================

-- This helps existing users who might have accounts but no company link
-- Run this to diagnose:
-- SELECT * FROM auth.users WHERE id NOT IN (SELECT user_id FROM user_companies);

-- PART 6: Verification Queries
-- =============================

-- To verify everything is working, run these after applying:

-- 1. Check RLS policies
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('companies', 'user_companies', 'drivers', 'infractions')
-- ORDER BY tablename, policyname;

-- 2. Check your own registration status
-- SELECT * FROM get_user_company_info();

-- 3. Check all companies and their users
-- SELECT
--   c.id as company_id,
--   c.name as company_name,
--   u.email as user_email,
--   uc.role
-- FROM companies c
-- JOIN user_companies uc ON uc.company_id = c.id
-- JOIN auth.users u ON u.id = uc.user_id;

COMMENT ON FUNCTION register_company_admin IS 'Atomically creates a company and links the user as admin, bypassing RLS';
COMMENT ON FUNCTION get_user_company_info IS 'Returns current user company information for debugging';
