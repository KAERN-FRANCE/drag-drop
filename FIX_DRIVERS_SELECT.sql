-- ==========================================
-- FIX : Politique SELECT sur drivers
-- ==========================================
-- Le chauffeur est créé mais invisible à cause du RLS SELECT

-- ==========================================
-- ÉTAPE 1: VÉRIFIER QUE LE CHAUFFEUR EXISTE
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '=== VÉRIFICATION DES DONNÉES ===';
END $$;

-- Désactiver RLS temporairement pour voir TOUTES les données
SET session_replication_role = 'replica';

SELECT '=== TOUS LES CHAUFFEURS (sans RLS) ===' as section;

SELECT
    d.id,
    d.name,
    d.company_id,
    c.name as company_name,
    d.created_at
FROM drivers d
LEFT JOIN companies c ON c.id = d.company_id
ORDER BY d.created_at DESC
LIMIT 10;

-- Réactiver RLS
SET session_replication_role = 'origin';

-- ==========================================
-- ÉTAPE 2: VÉRIFIER VOTRE ACCÈS
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    current_email TEXT;
    user_company_id UUID;
    user_role TEXT;
    visible_drivers_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== VÉRIFICATION DE VOTRE ACCÈS ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Aucun utilisateur connecté';
        RETURN;
    END IF;

    SELECT email INTO current_email FROM auth.users WHERE id = current_user_id;
    RAISE NOTICE '✅ Connecté en tant que: %', current_email;

    -- Récupérer votre entreprise
    SELECT company_id, role INTO user_company_id, user_role
    FROM user_companies
    WHERE user_id = current_user_id
    LIMIT 1;

    IF user_company_id IS NULL THEN
        RAISE WARNING '❌ Vous n''êtes pas lié à une entreprise';
        RETURN;
    END IF;

    RAISE NOTICE '   Votre entreprise: %', user_company_id;
    RAISE NOTICE '   Votre rôle: %', user_role;

    -- Tester la lecture avec RLS
    BEGIN
        SELECT COUNT(*) INTO visible_drivers_count
        FROM drivers
        WHERE company_id = user_company_id;

        RAISE NOTICE '   Chauffeurs visibles (avec RLS): %', visible_drivers_count;

        IF visible_drivers_count = 0 THEN
            RAISE WARNING '';
            RAISE WARNING '❌ PROBLÈME: Vous ne voyez AUCUN chauffeur!';
            RAISE WARNING '   Les politiques SELECT bloquent la lecture';
        ELSE
            RAISE NOTICE '';
            RAISE NOTICE '✅ Vous pouvez voir % chauffeur(s)', visible_drivers_count;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Erreur lors de la lecture: %', SQLERRM;
    END;
END $$;

-- ==========================================
-- ÉTAPE 3: VÉRIFIER LES POLITIQUES SELECT
-- ==========================================

SELECT '=== POLITIQUES SELECT ACTUELLES ===' as section;

SELECT
    policyname,
    cmd as operation,
    SUBSTRING(qual FROM 1 FOR 100) as condition
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'drivers'
AND cmd = 'SELECT'
ORDER BY policyname;

-- ==========================================
-- ÉTAPE 4: CORRIGER LA POLITIQUE SELECT
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CORRECTION DE LA POLITIQUE SELECT ===';
END $$;

-- Supprimer l'ancienne
DROP POLICY IF EXISTS "Users can view drivers from their company" ON drivers;
DROP POLICY IF EXISTS "View drivers in company" ON drivers;
DROP POLICY IF EXISTS "Select drivers" ON drivers;

-- Créer la nouvelle politique SELECT
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

DO $$ BEGIN
    RAISE NOTICE '✅ Politique SELECT créée';
END $$;

-- ==========================================
-- ÉTAPE 5: TEST FINAL
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    user_company_id UUID;
    visible_count INTEGER;
    total_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST FINAL ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Pas connecté pour tester';
        RETURN;
    END IF;

    SELECT company_id INTO user_company_id
    FROM user_companies
    WHERE user_id = current_user_id
    LIMIT 1;

    IF user_company_id IS NULL THEN
        RAISE WARNING '❌ Pas lié à une entreprise';
        RETURN;
    END IF;

    -- Compter avec RLS (ce que vous voyez)
    SELECT COUNT(*) INTO visible_count
    FROM drivers;

    -- Compter sans RLS (ce qui existe vraiment)
    SET LOCAL session_replication_role = 'replica';
    SELECT COUNT(*) INTO total_count
    FROM drivers
    WHERE company_id = user_company_id;
    SET LOCAL session_replication_role = 'origin';

    RAISE NOTICE '   Chauffeurs dans votre entreprise: %', total_count;
    RAISE NOTICE '   Chauffeurs visibles pour vous: %', visible_count;

    IF visible_count = total_count AND total_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 SUCCÈS! Vous voyez tous vos chauffeurs';
        RAISE NOTICE '👉 Rafraîchissez votre dashboard';
    ELSIF visible_count = 0 AND total_count > 0 THEN
        RAISE WARNING '';
        RAISE WARNING '❌ Les chauffeurs existent mais vous ne les voyez pas';
        RAISE WARNING '   Problème persistant avec les politiques SELECT';
    ELSIF total_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '⚠️ Aucun chauffeur dans votre entreprise';
        RAISE NOTICE '   Ajoutez-en un d''abord';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '✅ Vous voyez % sur % chauffeurs', visible_count, total_count;
    END IF;
END $$;

-- ==========================================
-- ÉTAPE 6: AFFICHER VOS CHAUFFEURS
-- ==========================================

SELECT '=== VOS CHAUFFEURS (avec RLS) ===' as section;

SELECT
    id,
    name,
    initials,
    score,
    status,
    created_at
FROM drivers
ORDER BY created_at DESC;
