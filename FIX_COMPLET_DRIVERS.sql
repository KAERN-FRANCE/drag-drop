-- ==========================================
-- FIX COMPLET : Toutes les Politiques Drivers
-- ==========================================
-- Ce script corrige TOUTES les politiques sur drivers (INSERT + SELECT + UPDATE + DELETE)

-- ==========================================
-- ÉTAPE 1: DIAGNOSTIC
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    current_email TEXT;
    user_company_id UUID;
    user_role TEXT;
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Aucun utilisateur connecté!';
        RAISE WARNING '   Restez connecté sur votre dashboard pendant l''exécution';
        RETURN;
    END IF;

    SELECT email INTO current_email FROM auth.users WHERE id = current_user_id;
    SELECT company_id, role INTO user_company_id, user_role
    FROM user_companies
    WHERE user_id = current_user_id
    LIMIT 1;

    RAISE NOTICE '✅ Utilisateur: %', current_email;
    RAISE NOTICE '   Entreprise: %', user_company_id;
    RAISE NOTICE '   Rôle: %', user_role;
END $$;

-- ==========================================
-- ÉTAPE 2: SUPPRIMER TOUTES LES ANCIENNES POLITIQUES
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== NETTOYAGE DES POLITIQUES ===';
END $$;

-- Supprimer toutes les politiques INSERT
DROP POLICY IF EXISTS "Users can create drivers in their company" ON drivers;
DROP POLICY IF EXISTS "Admins and managers can create drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to insert drivers" ON drivers;
DROP POLICY IF EXISTS "Admins and managers can insert drivers in their company" ON drivers;

-- Supprimer toutes les politiques SELECT
DROP POLICY IF EXISTS "Users can view drivers from their company" ON drivers;
DROP POLICY IF EXISTS "View drivers in company" ON drivers;

-- Supprimer toutes les politiques UPDATE
DROP POLICY IF EXISTS "Users can update drivers from their company" ON drivers;
DROP POLICY IF EXISTS "Admins and managers can update drivers" ON drivers;

-- Supprimer toutes les politiques DELETE
DROP POLICY IF EXISTS "Users can delete drivers from their company" ON drivers;
DROP POLICY IF EXISTS "Admins can delete drivers" ON drivers;

DO $$ BEGIN
    RAISE NOTICE '✅ Anciennes politiques supprimées';
END $$;

-- ==========================================
-- ÉTAPE 3: CRÉER LES NOUVELLES POLITIQUES
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CRÉATION DES NOUVELLES POLITIQUES ===';
END $$;

-- Politique SELECT : Voir les chauffeurs de son entreprise
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

-- Politique INSERT : Admins/Managers peuvent ajouter
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

-- Politique UPDATE : Admins/Managers peuvent modifier
CREATE POLICY "Admins and managers can update drivers in their company"
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

-- Politique DELETE : Seuls les Admins peuvent supprimer
CREATE POLICY "Admins can delete drivers in their company"
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
    RAISE NOTICE '✅ SELECT : Vous pouvez voir les chauffeurs de votre entreprise';
    RAISE NOTICE '✅ INSERT : Admins/Managers peuvent ajouter des chauffeurs';
    RAISE NOTICE '✅ UPDATE : Admins/Managers peuvent modifier leurs chauffeurs';
    RAISE NOTICE '✅ DELETE : Admins peuvent supprimer leurs chauffeurs';
END $$;

-- ==========================================
-- ÉTAPE 4: VÉRIFICATION
-- ==========================================

SELECT '=== POLITIQUES CRÉÉES ===' as section;

SELECT
    policyname,
    cmd as operation,
    CASE cmd
        WHEN 'SELECT' THEN 'Lecture'
        WHEN 'INSERT' THEN 'Création'
        WHEN 'UPDATE' THEN 'Modification'
        WHEN 'DELETE' THEN 'Suppression'
    END as action_fr
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'drivers'
ORDER BY cmd;

-- ==========================================
-- ÉTAPE 5: TEST FINAL
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    user_company_id UUID;
    user_role TEXT;
    visible_count INTEGER;
    total_in_company INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST DES ACCÈS ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Pas connecté pour tester';
        RETURN;
    END IF;

    SELECT company_id, role INTO user_company_id, user_role
    FROM user_companies
    WHERE user_id = current_user_id
    LIMIT 1;

    IF user_company_id IS NULL THEN
        RAISE WARNING '❌ Pas lié à une entreprise';
        RETURN;
    END IF;

    -- Test SELECT
    BEGIN
        SELECT COUNT(*) INTO visible_count FROM drivers;

        SET LOCAL session_replication_role = 'replica';
        SELECT COUNT(*) INTO total_in_company
        FROM drivers
        WHERE company_id = user_company_id;
        SET LOCAL session_replication_role = 'origin';

        IF visible_count = total_in_company THEN
            RAISE NOTICE '✅ SELECT : Vous voyez vos % chauffeurs', visible_count;
        ELSE
            RAISE WARNING '⚠️ SELECT : Vous voyez % sur % chauffeurs', visible_count, total_in_company;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ SELECT : Erreur - %', SQLERRM;
    END;

    -- Test INSERT
    IF user_role IN ('admin', 'manager') THEN
        RAISE NOTICE '✅ INSERT : Autorisé (rôle: %)', user_role;
    ELSE
        RAISE WARNING '⚠️ INSERT : Non autorisé (rôle: %)', user_role;
    END IF;

    -- Test UPDATE
    IF user_role IN ('admin', 'manager') THEN
        RAISE NOTICE '✅ UPDATE : Autorisé';
    ELSE
        RAISE WARNING '⚠️ UPDATE : Non autorisé';
    END IF;

    -- Test DELETE
    IF user_role = 'admin' THEN
        RAISE NOTICE '✅ DELETE : Autorisé';
    ELSE
        RAISE NOTICE '⚠️ DELETE : Non autorisé (réservé aux admins)';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 CONFIGURATION TERMINÉE!';
    RAISE NOTICE '';
    RAISE NOTICE '👉 Rafraîchissez votre dashboard (Ctrl+R)';
    RAISE NOTICE '👉 Vous devriez maintenant voir vos chauffeurs';
END $$;

-- ==========================================
-- ÉTAPE 6: AFFICHER VOS CHAUFFEURS
-- ==========================================

SELECT '=== VOS CHAUFFEURS ===' as section;

SELECT
    id,
    name,
    initials,
    score,
    status,
    created_at
FROM drivers
ORDER BY created_at DESC;
