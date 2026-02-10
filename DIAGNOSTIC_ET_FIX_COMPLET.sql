-- ==========================================
-- DIAGNOSTIC ET FIX COMPLET
-- ==========================================
-- Ce script diagnostique et corrige tous les problèmes RLS

-- ==========================================
-- PARTIE 1: DIAGNOSTIC DE L'UTILISATEUR CONNECTÉ
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    user_email TEXT;
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC UTILISATEUR ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Aucun utilisateur connecté!';
        RAISE WARNING '   Ce script doit être exécuté alors que vous êtes connecté';
    ELSE
        SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
        RAISE NOTICE '✅ Utilisateur connecté: %', user_email;
        RAISE NOTICE '   UUID: %', current_user_id;
    END IF;
END $$;

-- ==========================================
-- PARTIE 2: VÉRIFIER LA LIAISON USER-COMPANY
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    company_count INTEGER;
    user_company_id UUID;
    user_role TEXT;
    company_name TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== DIAGNOSTIC USER_COMPANIES ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Impossible de vérifier - aucun utilisateur connecté';
        RETURN;
    END IF;

    -- Désactiver temporairement RLS pour le diagnostic
    SET LOCAL session_replication_role = 'replica';

    SELECT COUNT(*) INTO company_count
    FROM user_companies
    WHERE user_id = current_user_id;

    IF company_count = 0 THEN
        RAISE WARNING '❌ Vous n''êtes lié à aucune entreprise!';
        RAISE WARNING '   Problème d''inscription - votre compte existe mais pas la liaison';
    ELSE
        SELECT uc.company_id, uc.role, c.name
        INTO user_company_id, user_role, company_name
        FROM user_companies uc
        LEFT JOIN companies c ON c.id = uc.company_id
        WHERE uc.user_id = current_user_id
        LIMIT 1;

        RAISE NOTICE '✅ Vous êtes lié à % entreprise(s)', company_count;
        RAISE NOTICE '   Entreprise: %', company_name;
        RAISE NOTICE '   Company ID: %', user_company_id;
        RAISE NOTICE '   Votre rôle: %', user_role;
    END IF;

    -- Réactiver RLS
    SET LOCAL session_replication_role = 'origin';
END $$;

-- ==========================================
-- PARTIE 3: VÉRIFIER LES POLITIQUES RLS
-- ==========================================

SELECT '=== POLITIQUES RLS ACTUELLES ===' as section;

-- Politiques sur user_companies
SELECT
    'user_companies' as table_name,
    policyname,
    cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'user_companies'
ORDER BY cmd;

-- Politiques sur drivers
SELECT
    'drivers' as table_name,
    policyname,
    cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'drivers'
ORDER BY cmd;

-- ==========================================
-- PARTIE 4: FIX - POLITIQUES USER_COMPANIES
-- ==========================================

-- Supprimer et recréer les politiques user_companies
DROP POLICY IF EXISTS "Users can view their associations" ON user_companies;
DROP POLICY IF EXISTS "Authenticated users can view their associations" ON user_companies;

CREATE POLICY "Users can view their associations"
  ON user_companies FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create associations" ON user_companies;
DROP POLICY IF EXISTS "Users can create associations" ON user_companies;

CREATE POLICY "Users can create associations"
  ON user_companies FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Politiques user_companies corrigées';
END $$;

-- ==========================================
-- PARTIE 5: FIX - POLITIQUES DRIVERS
-- ==========================================

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Users can create drivers in their company" ON drivers;
DROP POLICY IF EXISTS "Admins can insert drivers" ON drivers;
DROP POLICY IF EXISTS "Insert drivers with company_id" ON drivers;
DROP POLICY IF EXISTS "Admins and managers can create drivers" ON drivers;

-- Créer la politique INSERT corrigée
CREATE POLICY "Admins and managers can create drivers"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM user_companies
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Politique SELECT
DROP POLICY IF EXISTS "Users can view drivers from their company" ON drivers;
CREATE POLICY "Users can view drivers from their company"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- Politique UPDATE
DROP POLICY IF EXISTS "Users can update drivers from their company" ON drivers;
DROP POLICY IF EXISTS "Admins and managers can update drivers" ON drivers;
CREATE POLICY "Admins and managers can update drivers"
  ON drivers FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_companies
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Politique DELETE
DROP POLICY IF EXISTS "Users can delete drivers from their company" ON drivers;
DROP POLICY IF EXISTS "Admins can delete drivers" ON drivers;
CREATE POLICY "Admins can delete drivers"
  ON drivers FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_companies
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DO $$ BEGIN
    RAISE NOTICE '✅ Politiques drivers corrigées';
END $$;

-- ==========================================
-- PARTIE 6: FIX - POLITIQUES COMPANIES
-- ==========================================

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
      SELECT company_id
      FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update their company" ON companies;
CREATE POLICY "Admins can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id
      FROM user_companies
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DO $$ BEGIN
    RAISE NOTICE '✅ Politiques companies corrigées';
END $$;

-- ==========================================
-- PARTIE 7: TEST FINAL
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    test_company_id UUID;
    test_role TEXT;
    can_read_company BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST FINAL ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Aucun utilisateur connecté pour tester';
        RETURN;
    END IF;

    -- Tester la lecture de user_companies
    BEGIN
        SELECT company_id, role INTO test_company_id, test_role
        FROM user_companies
        WHERE user_id = current_user_id
        LIMIT 1;

        IF test_company_id IS NULL THEN
            RAISE WARNING '❌ Impossible de lire votre liaison entreprise';
            RAISE WARNING '   Votre compte n''est pas correctement lié';
        ELSE
            RAISE NOTICE '✅ Lecture user_companies OK';
            RAISE NOTICE '   Company ID: %', test_company_id;
            RAISE NOTICE '   Rôle: %', test_role;

            -- Tester la lecture de companies
            BEGIN
                SELECT EXISTS(
                    SELECT 1 FROM companies WHERE id = test_company_id
                ) INTO can_read_company;

                IF can_read_company THEN
                    RAISE NOTICE '✅ Lecture companies OK';
                ELSE
                    RAISE WARNING '⚠️ Impossible de lire les données de l''entreprise';
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '❌ Erreur lors de la lecture de companies: %', SQLERRM;
            END;

            -- Tester si on peut ajouter des chauffeurs
            IF test_role IN ('admin', 'manager') THEN
                RAISE NOTICE '✅ Vous pouvez ajouter des chauffeurs (rôle: %)', test_role;
            ELSE
                RAISE WARNING '⚠️ Votre rôle (%) ne permet pas d''ajouter des chauffeurs', test_role;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Erreur lors de la lecture de user_companies: %', SQLERRM;
    END;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 DIAGNOSTIC ET FIX TERMINÉS!';
    RAISE NOTICE '👉 Rafraîchissez votre page et essayez d''ajouter un chauffeur';
END $$;
