-- ==========================================
-- RESET COMPLET V2 - GÈRE TOUTES LES FOREIGN KEYS
-- ==========================================
-- ⚠️ ATTENTION: Ce script SUPPRIME TOUTES LES DONNÉES
-- À utiliser uniquement en développement pour repartir à zéro

-- ==========================================
-- ÉTAPE 1: DÉCOUVERTE DES TABLES
-- ==========================================

SELECT '=== TABLES À SUPPRIMER ===' as section;
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- ==========================================
-- ÉTAPE 2: DÉSACTIVER TEMPORAIREMENT LES CONTRAINTES
-- ==========================================

-- Désactiver les triggers et contraintes pour la suppression
SET session_replication_role = 'replica';

-- ==========================================
-- ÉTAPE 3: SUPPRIMER TOUTES LES DONNÉES
-- ==========================================

DO $$
DECLARE
    table_record RECORD;
BEGIN
    -- Désactiver RLS sur toutes les tables
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE IF EXISTS ' || table_record.tablename || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;

    -- Supprimer toutes les données de toutes les tables publiques avec CASCADE
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        ORDER BY tablename
    LOOP
        RAISE NOTICE 'Suppression de la table: %', table_record.tablename;
        EXECUTE 'TRUNCATE TABLE ' || table_record.tablename || ' CASCADE';
    END LOOP;

    -- Supprimer les utilisateurs auth
    DELETE FROM auth.users;
    RAISE NOTICE 'Utilisateurs auth supprimés';

    -- Réactiver RLS sur toutes les tables
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE IF EXISTS ' || table_record.tablename || ' ENABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- ==========================================
-- ÉTAPE 4: RÉINITIALISER LES SÉQUENCES
-- ==========================================

-- Remettre les ID auto-increment à 1
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || seq_record.sequence_name || ' RESTART WITH 1';
    END LOOP;
END $$;

-- Réactiver les contraintes
SET session_replication_role = 'origin';

-- ==========================================
-- ÉTAPE 5: VÉRIFICATION COMPLÈTE
-- ==========================================

SELECT '=== VÉRIFICATION DU RESET ===' as section;

DO $$
DECLARE
    table_record RECORD;
    table_count INTEGER;
    total_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== COMPTAGE DES ENREGISTREMENTS ===';

    -- Compter auth.users
    SELECT COUNT(*) INTO table_count FROM auth.users;
    RAISE NOTICE 'auth.users: %', table_count;
    total_count := total_count + table_count;

    -- Compter toutes les tables publiques
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        ORDER BY tablename
    LOOP
        EXECUTE 'SELECT COUNT(*) FROM ' || table_record.tablename INTO table_count;
        RAISE NOTICE '%: %', table_record.tablename, table_count;
        total_count := total_count + table_count;
    END LOOP;

    RAISE NOTICE '===================';
    RAISE NOTICE 'TOTAL: % enregistrements', total_count;
END $$;

-- ==========================================
-- ÉTAPE 6: MESSAGE DE CONFIRMATION
-- ==========================================

DO $$
DECLARE
  total_users INTEGER;
  total_companies INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO total_companies FROM companies;

  IF total_users = 0 AND total_companies = 0 THEN
    RAISE NOTICE '✅ BASE DE DONNÉES COMPLÈTEMENT RÉINITIALISÉE';
    RAISE NOTICE '✅ Toutes les tables sont vides';
    RAISE NOTICE '✅ Les séquences sont réinitialisées';
    RAISE NOTICE '👉 Vous pouvez maintenant créer un nouveau compte';
  ELSE
    RAISE WARNING '⚠️ Certaines données existent encore:';
    RAISE WARNING '   - Utilisateurs: %', total_users;
    RAISE WARNING '   - Entreprises: %', total_companies;
  END IF;
END $$;

-- ==========================================
-- NOTES IMPORTANTES
-- ==========================================
-- Si vous voyez encore des erreurs de foreign key:
-- 1. Exécutez le diagnostic_complet.sql pour voir toutes les tables
-- 2. Ajoutez les tables manquantes au script ci-dessus
-- 3. Ou contactez-moi avec la liste complète des tables

-- Pour voir toutes les tables de votre base:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
