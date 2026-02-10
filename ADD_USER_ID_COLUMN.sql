-- ==========================================
-- AJOUTER LA COLONNE user_id À DRIVERS
-- ==========================================
-- Ce script ajoute la colonne user_id à la table drivers
-- Exécutez ce script si vous avez déjà installé la base sans user_id

-- ==========================================
-- PARTIE 1: AJOUTER LA COLONNE user_id
-- ==========================================

-- Ajouter la colonne user_id si elle n'existe pas déjà
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$ BEGIN
    RAISE NOTICE '✅ Colonne user_id ajoutée à la table drivers';
END $$;

-- ==========================================
-- PARTIE 2: CRÉER L'INDEX
-- ==========================================

-- Créer l'index pour des requêtes rapides par user_id
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);

DO $$ BEGIN
    RAISE NOTICE '✅ Index idx_drivers_user_id créé';
END $$;

-- ==========================================
-- PARTIE 3: VÉRIFICATION
-- ==========================================

DO $$
DECLARE
    has_user_id BOOLEAN;
    has_company_id BOOLEAN;
    has_index BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== VÉRIFICATION ===';

    -- Vérifier user_id
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'drivers'
        AND column_name = 'user_id'
    ) INTO has_user_id;

    -- Vérifier company_id
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'drivers'
        AND column_name = 'company_id'
    ) INTO has_company_id;

    -- Vérifier l'index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'drivers'
        AND indexname = 'idx_drivers_user_id'
    ) INTO has_index;

    IF has_user_id THEN
        RAISE NOTICE '✅ Colonne user_id existe';
    ELSE
        RAISE WARNING '❌ Colonne user_id n''existe pas';
    END IF;

    IF has_company_id THEN
        RAISE NOTICE '✅ Colonne company_id existe';
    ELSE
        RAISE WARNING '❌ Colonne company_id n''existe pas';
    END IF;

    IF has_index THEN
        RAISE NOTICE '✅ Index idx_drivers_user_id existe';
    ELSE
        RAISE WARNING '❌ Index idx_drivers_user_id n''existe pas';
    END IF;

    RAISE NOTICE '';

    IF has_user_id AND has_company_id AND has_index THEN
        RAISE NOTICE '🎉 SUCCÈS! La table drivers a maintenant user_id et company_id';
        RAISE NOTICE '👉 Vous pouvez maintenant créer des chauffeurs depuis le dashboard';
    ELSE
        RAISE WARNING '⚠️ Problème avec la configuration';
    END IF;
END $$;

-- ==========================================
-- AFFICHER LE SCHÉMA FINAL
-- ==========================================

SELECT '=== COLONNES DE LA TABLE DRIVERS ===' as section;

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'drivers'
ORDER BY ordinal_position;
