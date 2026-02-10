-- ==========================================
-- RÉPARATION COMPTE - Fix Erreur 406
-- ==========================================
-- Ce script répare votre compte si la liaison user_companies est cassée

-- ==========================================
-- ÉTAPE 1: DIAGNOSTIC SANS RLS
-- ==========================================

DO $$
DECLARE
    all_users_count INTEGER;
    all_companies_count INTEGER;
    all_links_count INTEGER;
BEGIN
    RAISE NOTICE '=== ÉTAT DE LA BASE (SANS RLS) ===';

    -- Désactiver temporairement RLS pour voir toutes les données
    SET LOCAL session_replication_role = 'replica';

    SELECT COUNT(*) INTO all_users_count FROM auth.users;
    SELECT COUNT(*) INTO all_companies_count FROM companies;
    SELECT COUNT(*) INTO all_links_count FROM user_companies;

    RAISE NOTICE 'Utilisateurs auth: %', all_users_count;
    RAISE NOTICE 'Entreprises: %', all_companies_count;
    RAISE NOTICE 'Liaisons user_companies: %', all_links_count;

    -- Réactiver RLS
    SET LOCAL session_replication_role = 'origin';
END $$;

-- ==========================================
-- ÉTAPE 2: AFFICHER TOUS LES COMPTES
-- ==========================================

SELECT '=== TOUS LES UTILISATEURS ===' as section;

-- Désactiver temporairement RLS
SET session_replication_role = 'replica';

SELECT
    u.id,
    u.email,
    u.created_at,
    uc.company_id,
    uc.role,
    c.name as company_name
FROM auth.users u
LEFT JOIN user_companies uc ON uc.user_id = u.id
LEFT JOIN companies c ON c.id = uc.company_id
ORDER BY u.created_at DESC;

-- Réactiver RLS
SET session_replication_role = 'origin';

-- ==========================================
-- ÉTAPE 3: IDENTIFIER LES COMPTES CASSÉS
-- ==========================================

SELECT '=== COMPTES SANS ENTREPRISE ===' as section;

SET session_replication_role = 'replica';

SELECT
    u.id,
    u.email,
    u.created_at
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_companies WHERE user_id = u.id
)
ORDER BY u.created_at DESC;

SET session_replication_role = 'origin';

-- ==========================================
-- ÉTAPE 4: FIX AUTOMATIQUE DES POLITIQUES RLS
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CORRECTION DES POLITIQUES RLS ===';
END $$;

-- Fix user_companies
ALTER TABLE user_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their associations" ON user_companies;
DROP POLICY IF EXISTS "Authenticated users can view their associations" ON user_companies;
DROP POLICY IF EXISTS "Users can create associations" ON user_companies;
DROP POLICY IF EXISTS "Authenticated users can create associations" ON user_companies;

CREATE POLICY "Users can view their associations"
  ON user_companies FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create associations"
  ON user_companies FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DO $$ BEGIN
    RAISE NOTICE '✅ Politiques user_companies corrigées';
END $$;

-- Fix drivers
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

DO $$ BEGIN
    RAISE NOTICE '✅ Politiques drivers corrigées';
END $$;

-- ==========================================
-- ÉTAPE 5: INSTRUCTIONS DE RÉPARATION MANUELLE
-- ==========================================

DO $$
DECLARE
    orphan_users_count INTEGER;
    orphan_companies_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== INSTRUCTIONS DE RÉPARATION ===';

    SET LOCAL session_replication_role = 'replica';

    -- Compter les utilisateurs sans entreprise
    SELECT COUNT(*) INTO orphan_users_count
    FROM auth.users u
    WHERE NOT EXISTS (
        SELECT 1 FROM user_companies WHERE user_id = u.id
    );

    -- Compter les entreprises sans utilisateurs
    SELECT COUNT(*) INTO orphan_companies_count
    FROM companies c
    WHERE NOT EXISTS (
        SELECT 1 FROM user_companies WHERE company_id = c.id
    );

    IF orphan_users_count > 0 THEN
        RAISE WARNING '⚠️ % utilisateur(s) sans entreprise trouvé(s)', orphan_users_count;
        RAISE WARNING '   Regardez la section "COMPTES SANS ENTREPRISE" ci-dessus';
        RAISE WARNING '';
        RAISE WARNING '   Pour réparer, utilisez ce template:';
        RAISE WARNING '   INSERT INTO user_companies (user_id, company_id, role)';
        RAISE WARNING '   VALUES (''[USER_ID]'', ''[COMPANY_ID]'', ''admin'');';
    END IF;

    IF orphan_companies_count > 0 THEN
        RAISE WARNING '';
        RAISE WARNING '⚠️ % entreprise(s) sans utilisateur trouvée(s)', orphan_companies_count;
    END IF;

    IF orphan_users_count = 0 AND orphan_companies_count = 0 THEN
        RAISE NOTICE '✅ Tous les comptes sont correctement liés!';
    END IF;

    SET LOCAL session_replication_role = 'origin';
END $$;

-- ==========================================
-- ÉTAPE 6: TEST AVEC VOTRE COMPTE
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    current_email TEXT;
    user_company_id UUID;
    user_role TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST AVEC VOTRE COMPTE ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Aucun utilisateur connecté!';
        RAISE WARNING '   Ce script doit être exécuté pendant que vous êtes connecté à l''application';
        RAISE WARNING '   Allez sur votre dashboard et réessayez';
        RETURN;
    END IF;

    SELECT email INTO current_email FROM auth.users WHERE id = current_user_id;
    RAISE NOTICE '✅ Vous êtes connecté en tant que: %', current_email;

    -- Test de lecture avec RLS actif
    BEGIN
        SELECT company_id, role INTO user_company_id, user_role
        FROM user_companies
        WHERE user_id = current_user_id
        LIMIT 1;

        IF user_company_id IS NULL THEN
            RAISE WARNING '';
            RAISE WARNING '❌ PROBLÈME IDENTIFIÉ: Votre compte n''est pas lié à une entreprise!';
            RAISE WARNING '   Votre compte existe mais la liaison manque';
            RAISE WARNING '';

            -- Proposer une réparation
            SET LOCAL session_replication_role = 'replica';

            DECLARE
                any_company_id UUID;
                any_company_name TEXT;
            BEGIN
                SELECT id, name INTO any_company_id, any_company_name
                FROM companies
                ORDER BY created_at DESC
                LIMIT 1;

                IF any_company_id IS NOT NULL THEN
                    RAISE WARNING '   RÉPARATION SUGGÉRÉE:';
                    RAISE WARNING '   Copiez et exécutez cette commande:';
                    RAISE WARNING '';
                    RAISE WARNING '   INSERT INTO user_companies (user_id, company_id, role)';
                    RAISE WARNING '   VALUES (''%'', ''%'', ''admin'');', current_user_id, any_company_id;
                    RAISE WARNING '';
                    RAISE WARNING '   Cela liera votre compte à l''entreprise: %', any_company_name;
                END IF;
            END;

            SET LOCAL session_replication_role = 'origin';
        ELSE
            RAISE NOTICE '✅ Vous êtes correctement lié à l''entreprise: %', user_company_id;
            RAISE NOTICE '   Votre rôle: %', user_role;
            RAISE NOTICE '';
            RAISE NOTICE '🎉 TOUT EST OK!';
            RAISE NOTICE '   Le problème devrait être résolu';
            RAISE NOTICE '   Rafraîchissez votre page et réessayez';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Erreur lors du test: %', SQLERRM;
        RAISE WARNING '   Les politiques RLS bloquent encore';
    END;
END $$;
