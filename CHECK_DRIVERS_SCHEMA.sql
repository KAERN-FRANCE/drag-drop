-- ==========================================
-- DIAGNOSTIC: Vérifier le schéma de la table drivers
-- ==========================================
-- Ce script vérifie l'état actuel de la table drivers

-- ==========================================
-- PARTIE 1: VÉRIFIER LES COLONNES
-- ==========================================

SELECT '=== COLONNES DE LA TABLE DRIVERS ===' as section;

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'drivers'
ORDER BY ordinal_position;

-- ==========================================
-- PARTIE 2: VÉRIFIER LES INDEX
-- ==========================================

SELECT '=== INDEX SUR LA TABLE DRIVERS ===' as section;

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'drivers'
ORDER BY indexname;

-- ==========================================
-- PARTIE 3: VÉRIFIER LES CONTRAINTES FOREIGN KEY
-- ==========================================

SELECT '=== FOREIGN KEYS DE LA TABLE DRIVERS ===' as section;

SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'drivers'::regclass
AND contype = 'f'
ORDER BY conname;

-- ==========================================
-- PARTIE 4: VÉRIFIER LES POLITIQUES RLS
-- ==========================================

SELECT '=== POLITIQUES RLS SUR DRIVERS ===' as section;

SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'drivers'
ORDER BY policyname;

-- ==========================================
-- PARTIE 5: VÉRIFIER LES TRIGGERS
-- ==========================================

SELECT '=== TRIGGERS SUR LA TABLE DRIVERS ===' as section;

SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'drivers'
ORDER BY trigger_name;

-- ==========================================
-- DIAGNOSTIC
-- ==========================================

DO $$
DECLARE
    has_user_id BOOLEAN;
    has_company_id BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== DIAGNOSTIC ===';

    -- Vérifier si user_id existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'drivers'
        AND column_name = 'user_id'
    ) INTO has_user_id;

    -- Vérifier si company_id existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'drivers'
        AND column_name = 'company_id'
    ) INTO has_company_id;

    IF has_user_id THEN
        RAISE WARNING '⚠️ La colonne user_id existe dans drivers (PROBLÈME!)';
        RAISE WARNING '   Cette colonne ne devrait PAS exister dans l''architecture multi-tenant';
    ELSE
        RAISE NOTICE '✅ Pas de colonne user_id (CORRECT)';
    END IF;

    IF has_company_id THEN
        RAISE NOTICE '✅ La colonne company_id existe (CORRECT)';
    ELSE
        RAISE WARNING '⚠️ La colonne company_id n''existe pas (PROBLÈME!)';
    END IF;

    RAISE NOTICE '';

    IF has_user_id AND has_company_id THEN
        RAISE WARNING '🔧 ACTION REQUISE: Supprimez la colonne user_id';
        RAISE WARNING '   Exécutez: REMOVE_USER_ID_FROM_DRIVERS.sql';
    ELSIF has_user_id AND NOT has_company_id THEN
        RAISE WARNING '🔧 ACTION REQUISE: Mauvais schéma';
        RAISE WARNING '   Réexécutez: RESET_COMPLET_V2.sql puis INSTALLATION_COMPLETE.sql';
    ELSIF NOT has_company_id THEN
        RAISE WARNING '🔧 ACTION REQUISE: Colonne company_id manquante';
        RAISE WARNING '   Réexécutez: INSTALLATION_COMPLETE.sql';
    ELSE
        RAISE NOTICE '✅ Schéma drivers correct!';
    END IF;
END $$;
