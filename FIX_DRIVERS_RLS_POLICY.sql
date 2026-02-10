-- ==========================================
-- FIX: Politique RLS pour l'ajout de chauffeurs
-- ==========================================
-- Ce script corrige la politique RLS qui bloque l'ajout de chauffeurs

-- ==========================================
-- PARTIE 1: SUPPRIMER LES ANCIENNES POLITIQUES
-- ==========================================

-- Supprimer toutes les politiques INSERT sur drivers
DROP POLICY IF EXISTS "Users can create drivers in their company" ON drivers;
DROP POLICY IF EXISTS "Admins can insert drivers" ON drivers;
DROP POLICY IF EXISTS "Insert drivers with company_id" ON drivers;

DO $$ BEGIN
    RAISE NOTICE '✅ Anciennes politiques supprimées';
END $$;

-- ==========================================
-- PARTIE 2: CRÉER LA NOUVELLE POLITIQUE INSERT
-- ==========================================

-- Politique pour permettre aux admins/managers d'ajouter des chauffeurs
CREATE POLICY "Admins and managers can create drivers"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (
    -- L'utilisateur doit être admin ou manager de l'entreprise du chauffeur
    company_id IN (
      SELECT company_id
      FROM user_companies
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

DO $$ BEGIN
    RAISE NOTICE '✅ Nouvelle politique INSERT créée';
END $$;

-- ==========================================
-- PARTIE 3: VÉRIFIER LES AUTRES POLITIQUES
-- ==========================================

-- S'assurer que les politiques SELECT, UPDATE, DELETE existent

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
    RAISE NOTICE '✅ Toutes les politiques RLS mises à jour';
END $$;

-- ==========================================
-- PARTIE 4: VÉRIFICATION
-- ==========================================

SELECT '=== POLITIQUES RLS SUR DRIVERS ===' as section;

SELECT
    policyname,
    cmd as operation,
    CASE
        WHEN qual IS NOT NULL THEN 'USING: ' || qual
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
        ELSE 'NO CONDITION'
    END as condition
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'drivers'
ORDER BY cmd, policyname;

-- ==========================================
-- PARTIE 5: TEST DE LA CONFIGURATION
-- ==========================================

DO $$
DECLARE
    user_company_id UUID;
    user_role TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST DE CONFIGURATION ===';

    -- Récupérer les infos de l'utilisateur connecté
    SELECT company_id, role INTO user_company_id, user_role
    FROM user_companies
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF user_company_id IS NULL THEN
        RAISE WARNING '❌ Vous n''êtes pas lié à une entreprise';
        RAISE WARNING '   Impossible d''ajouter des chauffeurs';
    ELSE
        RAISE NOTICE '✅ Vous êtes lié à l''entreprise: %', user_company_id;
        RAISE NOTICE '   Votre rôle: %', user_role;

        IF user_role IN ('admin', 'manager') THEN
            RAISE NOTICE '✅ Vous pouvez ajouter des chauffeurs';
        ELSE
            RAISE WARNING '⚠️ Votre rôle (%) ne permet pas d''ajouter des chauffeurs', user_role;
        END IF;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 Politiques RLS corrigées!';
    RAISE NOTICE '👉 Essayez maintenant d''ajouter un chauffeur';
END $$;
