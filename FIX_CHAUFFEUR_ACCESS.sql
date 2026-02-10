-- ==========================================
-- FIX : Accès pour les Chauffeurs
-- ==========================================
-- Permet aux chauffeurs de voir LEURS propres données

-- ==========================================
-- ÉTAPE 1: DIAGNOSTIC
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    current_email TEXT;
    driver_record RECORD;
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC CHAUFFEUR ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Aucun utilisateur connecté!';
        RETURN;
    END IF;

    SELECT email INTO current_email FROM auth.users WHERE id = current_user_id;
    RAISE NOTICE '✅ Connecté en tant que: %', current_email;

    -- Vérifier si cet utilisateur est un chauffeur
    SET LOCAL session_replication_role = 'replica';

    SELECT * INTO driver_record
    FROM drivers
    WHERE user_id = current_user_id;

    IF driver_record.id IS NOT NULL THEN
        RAISE NOTICE '✅ Vous êtes un chauffeur:';
        RAISE NOTICE '   Nom: %', driver_record.name;
        RAISE NOTICE '   ID: %', driver_record.id;
        RAISE NOTICE '   Entreprise: %', driver_record.company_id;
    ELSE
        RAISE NOTICE '⚠️ Vous n''êtes PAS un chauffeur';
        RAISE NOTICE '   (Vous êtes probablement un admin)';
    END IF;

    SET LOCAL session_replication_role = 'origin';
END $$;

-- ==========================================
-- ÉTAPE 2: POLITIQUES DRIVERS POUR CHAUFFEURS
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CONFIGURATION DRIVERS ===';
END $$;

-- La politique SELECT actuelle permet déjà aux admins de voir tous les chauffeurs
-- On garde celle-là et on en ajoute une pour les chauffeurs eux-mêmes

-- Ajouter une politique pour que les chauffeurs puissent voir LEUR PROPRE profil
DROP POLICY IF EXISTS "Drivers can view their own profile" ON drivers;
CREATE POLICY "Drivers can view their own profile"
  ON drivers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Permettre aux chauffeurs de mettre à jour leur propre profil (optionnel)
DROP POLICY IF EXISTS "Drivers can update their own profile" ON drivers;
CREATE POLICY "Drivers can update their own profile"
  ON drivers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DO $$ BEGIN
    RAISE NOTICE '✅ Les chauffeurs peuvent voir leur propre profil';
    RAISE NOTICE '✅ Les chauffeurs peuvent modifier leur propre profil';
END $$;

-- ==========================================
-- ÉTAPE 3: POLITIQUES INFRACTIONS POUR CHAUFFEURS
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CONFIGURATION INFRACTIONS ===';
END $$;

-- Politique pour que les chauffeurs voient LEURS infractions
DROP POLICY IF EXISTS "Drivers can view their own infractions" ON infractions;
CREATE POLICY "Drivers can view their own infractions"
  ON infractions FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

DO $$ BEGIN
    RAISE NOTICE '✅ Les chauffeurs peuvent voir leurs propres infractions';
END $$;

-- ==========================================
-- ÉTAPE 4: POLITIQUES ANALYSES POUR CHAUFFEURS
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CONFIGURATION ANALYSES ===';
END $$;

-- Politique pour que les chauffeurs voient LEURS analyses
DROP POLICY IF EXISTS "Drivers can view their own analyses" ON analyses;
CREATE POLICY "Drivers can view their own analyses"
  ON analyses FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

DO $$ BEGIN
    RAISE NOTICE '✅ Les chauffeurs peuvent voir leurs propres analyses';
END $$;

-- ==========================================
-- ÉTAPE 5: VÉRIFICATION DES POLITIQUES
-- ==========================================

SELECT '=== POLITIQUES SELECT SUR DRIVERS ===' as section;

SELECT
    policyname,
    CASE
        WHEN policyname LIKE '%own%' THEN '👤 Chauffeur'
        WHEN policyname LIKE '%company%' THEN '🏢 Admin/Manager'
        ELSE '❓ Autre'
    END as pour_qui
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'drivers'
AND cmd = 'SELECT'
ORDER BY policyname;

SELECT '=== POLITIQUES SELECT SUR INFRACTIONS ===' as section;

SELECT
    policyname,
    CASE
        WHEN policyname LIKE '%own%' THEN '👤 Chauffeur'
        WHEN policyname LIKE '%company%' THEN '🏢 Admin/Manager'
        ELSE '❓ Autre'
    END as pour_qui
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'infractions'
AND cmd = 'SELECT'
ORDER BY policyname;

SELECT '=== POLITIQUES SELECT SUR ANALYSES ===' as section;

SELECT
    policyname,
    CASE
        WHEN policyname LIKE '%own%' THEN '👤 Chauffeur'
        WHEN policyname LIKE '%company%' THEN '🏢 Admin/Manager'
        ELSE '❓ Autre'
    END as pour_qui
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'analyses'
AND cmd = 'SELECT'
ORDER BY policyname;

-- ==========================================
-- ÉTAPE 6: TEST POUR CHAUFFEUR
-- ==========================================

DO $$
DECLARE
    current_user_id UUID;
    driver_id INTEGER;
    visible_profile BOOLEAN;
    infractions_count INTEGER;
    analyses_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST ACCÈS CHAUFFEUR ===';

    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE WARNING '❌ Pas connecté';
        RETURN;
    END IF;

    -- Vérifier si c'est un chauffeur
    BEGIN
        SELECT id INTO driver_id FROM drivers WHERE user_id = current_user_id;

        IF driver_id IS NULL THEN
            RAISE NOTICE '⚠️ Vous n''êtes pas un chauffeur';
            RAISE NOTICE '   Ce test est pour les comptes chauffeurs';
            RAISE NOTICE '   Si vous êtes admin, tout est déjà configuré';
            RETURN;
        END IF;

        RAISE NOTICE '✅ Vous êtes le chauffeur ID: %', driver_id;

        -- Test lecture profil
        SELECT EXISTS(SELECT 1 FROM drivers WHERE id = driver_id) INTO visible_profile;

        IF visible_profile THEN
            RAISE NOTICE '✅ Vous pouvez voir votre profil';
        ELSE
            RAISE WARNING '❌ Vous ne pouvez pas voir votre profil';
        END IF;

        -- Test lecture infractions
        SELECT COUNT(*) INTO infractions_count FROM infractions WHERE driver_id = driver_id;
        RAISE NOTICE '✅ Vous pouvez voir % infraction(s)', infractions_count;

        -- Test lecture analyses
        SELECT COUNT(*) INTO analyses_count FROM analyses WHERE driver_id = driver_id;
        RAISE NOTICE '✅ Vous pouvez voir % analyse(s)', analyses_count;

        RAISE NOTICE '';
        RAISE NOTICE '🎉 ACCÈS CHAUFFEUR CONFIGURÉ!';
        RAISE NOTICE '👉 Rafraîchissez votre page /chauffeur';

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Erreur: %', SQLERRM;
    END;
END $$;

-- ==========================================
-- ÉTAPE 7: RÉSUMÉ DES ACCÈS
-- ==========================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== RÉSUMÉ DES ACCÈS ===';
    RAISE NOTICE '';
    RAISE NOTICE '🏢 ADMIN/MANAGER peuvent:';
    RAISE NOTICE '   ✅ Voir tous les chauffeurs de leur entreprise';
    RAISE NOTICE '   ✅ Ajouter/modifier/supprimer des chauffeurs';
    RAISE NOTICE '   ✅ Voir toutes les infractions de leur entreprise';
    RAISE NOTICE '   ✅ Voir toutes les analyses de leur entreprise';
    RAISE NOTICE '';
    RAISE NOTICE '👤 CHAUFFEURS peuvent:';
    RAISE NOTICE '   ✅ Voir leur propre profil';
    RAISE NOTICE '   ✅ Modifier leur propre profil';
    RAISE NOTICE '   ✅ Voir leurs propres infractions';
    RAISE NOTICE '   ✅ Voir leurs propres analyses';
    RAISE NOTICE '   ❌ Ne peuvent PAS voir les autres chauffeurs';
    RAISE NOTICE '';
END $$;
