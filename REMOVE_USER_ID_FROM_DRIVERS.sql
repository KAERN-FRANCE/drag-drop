-- ==========================================
-- SUPPRIMER LA COLONNE user_id DE DRIVERS
-- ==========================================
-- Ce script supprime la colonne user_id qui entre en conflit
-- avec l'architecture multi-tenant basée sur company_id

-- ==========================================
-- PARTIE 1: VÉRIFIER L'ÉTAT ACTUEL
-- ==========================================

DO $$
DECLARE
    has_user_id BOOLEAN;
    has_company_id BOOLEAN;
BEGIN
    RAISE NOTICE '=== VÉRIFICATION AVANT SUPPRESSION ===';

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
        RAISE NOTICE '⚠️ Colonne user_id trouvée - sera supprimée';
    ELSE
        RAISE NOTICE '✅ Colonne user_id n''existe pas déjà';
    END IF;

    IF has_company_id THEN
        RAISE NOTICE '✅ Colonne company_id existe (CORRECT)';
    ELSE
        RAISE WARNING '⚠️ ATTENTION: company_id n''existe pas!';
        RAISE WARNING '   Vous devez réexécuter INSTALLATION_COMPLETE.sql';
    END IF;
END $$;

-- ==========================================
-- PARTIE 2: SUPPRIMER L'INDEX SUR user_id
-- ==========================================

DROP INDEX IF EXISTS idx_drivers_user_id;

DO $$ BEGIN
    RAISE NOTICE '✅ Index idx_drivers_user_id supprimé (si existant)';
END $$;

-- ==========================================
-- PARTIE 3: SUPPRIMER LA COLONNE user_id
-- ==========================================

ALTER TABLE drivers DROP COLUMN IF EXISTS user_id;

DO $$ BEGIN
    RAISE NOTICE '✅ Colonne user_id supprimée (si existante)';
END $$;

-- ==========================================
-- PARTIE 4: SUPPRIMER LA COLONNE email SI PRÉSENTE
-- ==========================================
-- La colonne email a été ajoutée par le même script
-- mais n'est pas utilisée dans l'architecture actuelle

ALTER TABLE drivers DROP COLUMN IF EXISTS email;

DO $$ BEGIN
    RAISE NOTICE '✅ Colonne email supprimée (si existante)';
END $$;

-- ==========================================
-- PARTIE 5: VÉRIFICATION FINALE
-- ==========================================

DO $$
DECLARE
    has_user_id BOOLEAN;
    has_company_id BOOLEAN;
    has_email BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== VÉRIFICATION FINALE ===';

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

    -- Vérifier email
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'drivers'
        AND column_name = 'email'
    ) INTO has_email;

    IF has_user_id THEN
        RAISE WARNING '❌ La colonne user_id existe encore (PROBLÈME!)';
    ELSE
        RAISE NOTICE '✅ La colonne user_id a été supprimée';
    END IF;

    IF has_email THEN
        RAISE NOTICE '⚠️ La colonne email existe encore';
    ELSE
        RAISE NOTICE '✅ La colonne email a été supprimée';
    END IF;

    IF has_company_id THEN
        RAISE NOTICE '✅ La colonne company_id existe (CORRECT)';
    ELSE
        RAISE WARNING '❌ La colonne company_id n''existe pas (PROBLÈME!)';
        RAISE WARNING '   Réexécutez INSTALLATION_COMPLETE.sql';
    END IF;

    RAISE NOTICE '';

    IF NOT has_user_id AND has_company_id THEN
        RAISE NOTICE '🎉 SUCCÈS! Le schéma drivers est maintenant correct';
        RAISE NOTICE '👉 Vous pouvez maintenant ajouter des chauffeurs';
    ELSE
        RAISE WARNING '⚠️ Le schéma n''est pas encore correct';
        RAISE WARNING '   Réexécutez RESET_COMPLET_V2.sql puis INSTALLATION_COMPLETE.sql';
    END IF;
END $$;

-- ==========================================
-- AFFICHER LES COLONNES FINALES
-- ==========================================

SELECT '=== COLONNES FINALES DE LA TABLE DRIVERS ===' as section;

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'drivers'
ORDER BY ordinal_position;
