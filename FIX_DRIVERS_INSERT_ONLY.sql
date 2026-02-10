-- ==========================================
-- FIX RAPIDE : Politique INSERT sur drivers
-- ==========================================
-- Corrige uniquement la politique qui bloque l'ajout de chauffeurs

-- ==========================================
-- ÉTAPE 1: VÉRIFIER VOTRE LIAISON
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    current_email TEXT;
    user_company_id UUID;
    user_role TEXT;
BEGIN
    RAISE NOTICE '=== VÉRIFICATION DE VOTRE COMPTE ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Aucun utilisateur connecté!';
        RETURN;
    END IF;

    SELECT email INTO current_email FROM auth.users WHERE id = current_user_id;
    RAISE NOTICE '✅ Connecté en tant que: %', current_email;

    -- Test lecture user_companies
    BEGIN
        SELECT company_id, role INTO user_company_id, user_role
        FROM user_companies
        WHERE user_id = current_user_id
        LIMIT 1;

        IF user_company_id IS NOT NULL THEN
            RAISE NOTICE '✅ Lié à l''entreprise: %', user_company_id;
            RAISE NOTICE '   Rôle: %', user_role;
        ELSE
            RAISE WARNING '❌ Pas lié à une entreprise!';
            RAISE WARNING '   Exécutez d''abord REPAIR_ACCOUNT.sql';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Erreur lecture user_companies: %', SQLERRM;
    END;
END $$;

-- ==========================================
-- ÉTAPE 2: SUPPRIMER TOUTES LES POLITIQUES INSERT
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== SUPPRESSION DES ANCIENNES POLITIQUES ===';
END $$;

DROP POLICY IF EXISTS "Users can create drivers in their company" ON drivers;
DROP POLICY IF EXISTS "Admins and managers can create drivers" ON drivers;
DROP POLICY IF EXISTS "Admins can insert drivers" ON drivers;
DROP POLICY IF EXISTS "Insert drivers with company_id" ON drivers;
DROP POLICY IF EXISTS "Allow insert for admins" ON drivers;

DO $$ BEGIN
    RAISE NOTICE '✅ Anciennes politiques supprimées';
END $$;

-- ==========================================
-- ÉTAPE 3: CRÉER UNE POLITIQUE PERMISSIVE
-- ==========================================

-- Politique très permissive pour tester
CREATE POLICY "Allow authenticated users to insert drivers"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (true);

DO $$ BEGIN
    RAISE NOTICE '✅ Nouvelle politique créée (permissive pour test)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ ATTENTION: Cette politique est très permissive!';
    RAISE NOTICE '   Elle permet à TOUS les utilisateurs d''ajouter des drivers';
    RAISE NOTICE '   C''est temporaire pour diagnostiquer le problème';
END $$;

-- ==========================================
-- ÉTAPE 4: AFFICHER LES POLITIQUES ACTUELLES
-- ==========================================

SELECT '=== POLITIQUES DRIVERS ===' as section;

SELECT
    policyname,
    cmd as operation,
    CASE
        WHEN with_check = 'true' THEN '✅ AUTORISÉ POUR TOUS'
        ELSE with_check
    END as condition
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'drivers'
AND cmd = 'INSERT'
ORDER BY policyname;

-- ==========================================
-- ÉTAPE 5: INSTRUCTIONS
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== INSTRUCTIONS ===';
    RAISE NOTICE '1. Rafraîchissez votre page (Ctrl+R)';
    RAISE NOTICE '2. Essayez d''ajouter un chauffeur';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Si ça marche:';
    RAISE NOTICE '   → Le problème vient de la condition WITH CHECK';
    RAISE NOTICE '   → Exécutez FIX_DRIVERS_FINAL.sql pour sécuriser';
    RAISE NOTICE '';
    RAISE NOTICE '❌ Si ça ne marche toujours pas:';
    RAISE NOTICE '   → Le problème est ailleurs (trigger, autre politique)';
    RAISE NOTICE '   → Copiez l''erreur exacte et dites-moi';
END $$;
