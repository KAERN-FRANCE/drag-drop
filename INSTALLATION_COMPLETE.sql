-- ==========================================
-- INSTALLATION COMPLÈTE - TachoCompliance
-- ==========================================
-- Ce script installe TOUT dans le bon ordre après un RESET
-- Exécutez ce script APRÈS avoir fait RESET_COMPLET_V2.sql

-- ==========================================
-- PARTIE 1: CRÉER LES TABLES DE BASE
-- ==========================================

-- Table drivers
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table infractions
CREATE TABLE IF NOT EXISTS infractions (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table analyses (pour les analyses de fichiers)
CREATE TABLE IF NOT EXISTS analyses (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  score INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lien entre infractions et analyses
ALTER TABLE infractions ADD COLUMN IF NOT EXISTS analysis_id INTEGER REFERENCES analyses(id) ON DELETE CASCADE;

DO $$ BEGIN RAISE NOTICE '✅ Tables de base créées'; END $$;

-- ==========================================
-- PARTIE 2: AJOUTER MULTI-TENANT
-- ==========================================

-- Table companies
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  siret TEXT,
  driver_count TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table user_companies (junction table)
CREATE TABLE IF NOT EXISTS user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'driver', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- Ajouter company_id aux tables existantes
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE infractions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_infractions_company_id ON infractions(company_id);
CREATE INDEX IF NOT EXISTS idx_analyses_company_id ON analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON user_companies(company_id);

DO $$ BEGIN RAISE NOTICE '✅ Multi-tenant configuré'; END $$;

-- ==========================================
-- PARTIE 3: ACTIVER ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN RAISE NOTICE '✅ RLS activé'; END $$;

-- ==========================================
-- PARTIE 4: CRÉER LES POLITIQUES RLS
-- ==========================================

-- Policies pour COMPANIES
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;
CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their companies" ON companies;
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update their company" ON companies;
CREATE POLICY "Admins can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policies pour USER_COMPANIES
DROP POLICY IF EXISTS "Authenticated users can create associations" ON user_companies;
DROP POLICY IF EXISTS "Users can create associations" ON user_companies;
CREATE POLICY "Users can create associations"
  ON user_companies FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their associations" ON user_companies;
DROP POLICY IF EXISTS "Authenticated users can view their associations" ON user_companies;
CREATE POLICY "Users can view their associations"
  ON user_companies FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policies pour DRIVERS
DROP POLICY IF EXISTS "Users can view drivers from their company" ON drivers;
CREATE POLICY "Users can view drivers from their company"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create drivers in their company" ON drivers;
DROP POLICY IF EXISTS "Admins and managers can create drivers" ON drivers;
CREATE POLICY "Admins and managers can create drivers"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Users can update drivers from their company" ON drivers;
CREATE POLICY "Users can update drivers from their company"
  ON drivers FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Users can delete drivers from their company" ON drivers;
CREATE POLICY "Users can delete drivers from their company"
  ON drivers FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policies pour INFRACTIONS
DROP POLICY IF EXISTS "Users can view infractions from their company" ON infractions;
CREATE POLICY "Users can view infractions from their company"
  ON infractions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create infractions in their company" ON infractions;
CREATE POLICY "Users can create infractions in their company"
  ON infractions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IS NULL
    OR
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- Policies pour ANALYSES
DROP POLICY IF EXISTS "Users can view analyses from their company" ON analyses;
CREATE POLICY "Users can view analyses from their company"
  ON analyses FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create analyses in their company" ON analyses;
CREATE POLICY "Users can create analyses in their company"
  ON analyses FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IS NULL
    OR
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

DO $$ BEGIN RAISE NOTICE '✅ Politiques RLS créées'; END $$;

-- ==========================================
-- PARTIE 5: CRÉER LES FONCTIONS
-- ==========================================

-- Fonction pour obtenir le company_id de l'utilisateur
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM user_companies
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Fonction pour définir automatiquement le company_id
CREATE OR REPLACE FUNCTION set_company_id()
RETURNS TRIGGER AS $$
DECLARE
  user_company_id UUID;
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO user_company_id
    FROM user_companies
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF user_company_id IS NOT NULL THEN
      NEW.company_id := user_company_id;
    ELSE
      RAISE EXCEPTION 'User is not associated with any company. Please ensure user is registered properly.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction d'inscription admin
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
  -- Créer l'entreprise
  INSERT INTO companies (name, siret, driver_count)
  VALUES (p_company_name, p_siret, p_driver_count)
  RETURNING id INTO v_company_id;

  -- Lier l'utilisateur à l'entreprise
  INSERT INTO user_companies (user_id, company_id, role)
  VALUES (p_user_id, v_company_id, 'admin');

  RETURN QUERY SELECT v_company_id, true, 'Company created successfully'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::UUID, false, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de diagnostic
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

-- Donner les permissions
GRANT EXECUTE ON FUNCTION register_company_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_company_info TO authenticated;

DO $$ BEGIN RAISE NOTICE '✅ Fonctions créées'; END $$;

-- ==========================================
-- PARTIE 6: CRÉER LES TRIGGERS
-- ==========================================

-- Trigger pour drivers
DROP TRIGGER IF EXISTS set_company_id_on_driver_insert ON drivers;
CREATE TRIGGER set_company_id_on_driver_insert
  BEFORE INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id();

-- Trigger pour infractions
DROP TRIGGER IF EXISTS set_company_id_on_infraction_insert ON infractions;
CREATE TRIGGER set_company_id_on_infraction_insert
  BEFORE INSERT ON infractions
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id();

-- Trigger pour analyses
DROP TRIGGER IF EXISTS set_company_id_on_analysis_insert ON analyses;
CREATE TRIGGER set_company_id_on_analysis_insert
  BEFORE INSERT ON analyses
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id();

DO $$ BEGIN RAISE NOTICE '✅ Triggers créés'; END $$;

-- ==========================================
-- VÉRIFICATION FINALE
-- ==========================================

SELECT '=== INSTALLATION TERMINÉE ===' as section;

-- Vérifier les tables
SELECT
  'Tables créées:' as info,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('drivers', 'infractions', 'analyses', 'companies', 'user_companies');

-- Vérifier les fonctions
SELECT
  'Fonctions créées:' as info,
  COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('register_company_admin', 'get_user_company_info', 'set_company_id');

-- Vérifier les politiques RLS
SELECT
  'Politiques RLS créées:' as info,
  COUNT(*) as count
FROM pg_policies
WHERE tablename IN ('companies', 'user_companies', 'drivers', 'infractions', 'analyses');

-- Message de succès
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 INSTALLATION COMPLÈTE RÉUSSIE !';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Toutes les tables sont créées';
  RAISE NOTICE '✅ Multi-tenant configuré';
  RAISE NOTICE '✅ RLS activé et configuré';
  RAISE NOTICE '✅ Fonctions installées';
  RAISE NOTICE '✅ Triggers configurés';
  RAISE NOTICE '';
  RAISE NOTICE '👉 Vous pouvez maintenant créer un compte sur /register';
  RAISE NOTICE '';
END $$;
