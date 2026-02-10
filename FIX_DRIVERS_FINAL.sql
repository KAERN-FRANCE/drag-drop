-- ==========================================
-- FIX FINAL : Politique drivers SÉCURISÉE
-- ==========================================
-- À exécuter APRÈS avoir testé avec FIX_DRIVERS_INSERT_ONLY.sql
-- Cette version est sécurisée et respecte le multi-tenant

-- ==========================================
-- SUPPRIMER LA POLITIQUE PERMISSIVE
-- ==========================================

DROP POLICY IF EXISTS "Allow authenticated users to insert drivers" ON drivers;

DO $$ BEGIN
    RAISE NOTICE '✅ Politique permissive supprimée';
END $$;

-- ==========================================
-- CRÉER LA POLITIQUE SÉCURISÉE
-- ==========================================

-- Politique qui vérifie que:
-- 1. L'utilisateur est admin ou manager
-- 2. Le company_id du driver correspond à l'entreprise de l'admin
CREATE POLICY "Admins and managers can insert drivers in their company"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_companies uc
      WHERE uc.user_id = auth.uid()
      AND uc.company_id = drivers.company_id
      AND uc.role IN ('admin', 'manager')
    )
  );

DO $$ BEGIN
    RAISE NOTICE '✅ Politique sécurisée créée';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Cette politique vérifie que:';
    RAISE NOTICE '   - Vous êtes admin ou manager';
    RAISE NOTICE '   - Le chauffeur est ajouté dans VOTRE entreprise';
    RAISE NOTICE '   - Isolation multi-tenant respectée';
END $$;

-- ==========================================
-- VÉRIFIER LES AUTRES POLITIQUES
-- ==========================================

SELECT '=== TOUTES LES POLITIQUES DRIVERS ===' as section;

SELECT
    policyname,
    cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'drivers'
ORDER BY cmd, policyname;

-- ==========================================
-- TEST FINAL
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    user_company_id UUID;
    user_role TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST FINAL ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Aucun utilisateur connecté';
        RETURN;
    END IF;

    SELECT company_id, role INTO user_company_id, user_role
    FROM user_companies
    WHERE user_id = current_user_id
    LIMIT 1;

    IF user_company_id IS NULL THEN
        RAISE WARNING '❌ Pas lié à une entreprise';
    ELSIF user_role NOT IN ('admin', 'manager') THEN
        RAISE WARNING '⚠️ Votre rôle (%) ne permet pas d''ajouter des drivers', user_role;
    ELSE
        RAISE NOTICE '✅ Vous pouvez ajouter des chauffeurs';
        RAISE NOTICE '   Company ID: %', user_company_id;
        RAISE NOTICE '   Rôle: %', user_role;
        RAISE NOTICE '';
        RAISE NOTICE '🎉 Tout est configuré correctement!';
        RAISE NOTICE '👉 Essayez d''ajouter un chauffeur';
    END IF;
END $$;
