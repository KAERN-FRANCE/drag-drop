-- ==========================================
-- RESET COMPLET DE LA BASE DE DONNÉES
-- ==========================================
-- ⚠️ ATTENTION: Ce script SUPPRIME TOUTES LES DONNÉES
-- À utiliser uniquement en développement pour repartir à zéro

-- ==========================================
-- ÉTAPE 0: CONFIRMATION
-- ==========================================
-- Si vous êtes sûr de vouloir TOUT supprimer, décommentez la ligne suivante:
-- DO $$ BEGIN RAISE NOTICE 'Reset confirmé'; END $$;

-- ⚠️ ARRÊTEZ-VOUS ICI SI VOUS N'ÊTES PAS SÛR! ⚠️


-- ==========================================
-- ÉTAPE 1: SUPPRIMER TOUTES LES DONNÉES
-- ==========================================

-- Désactiver temporairement RLS pour la suppression
ALTER TABLE infractions DISABLE ROW LEVEL SECURITY;
ALTER TABLE drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- Supprimer les données dans l'ordre (à cause des foreign keys)
DELETE FROM infractions;
DELETE FROM drivers;
DELETE FROM user_companies;
DELETE FROM companies;

-- Supprimer les utilisateurs Auth (⚠️ DANGEREUX EN PRODUCTION)
-- ATTENTION: Cela supprime TOUS les comptes utilisateurs!
DELETE FROM auth.users;

-- Réactiver RLS
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ÉTAPE 2: RÉINITIALISER LES SÉQUENCES
-- ==========================================

-- Remettre les ID auto-increment à 1
ALTER SEQUENCE drivers_id_seq RESTART WITH 1;
ALTER SEQUENCE infractions_id_seq RESTART WITH 1;

-- ==========================================
-- ÉTAPE 3: VÉRIFICATION
-- ==========================================

SELECT '=== VÉRIFICATION DU RESET ===' as section;
SELECT
  (SELECT COUNT(*) FROM auth.users) as users_count,
  (SELECT COUNT(*) FROM companies) as companies_count,
  (SELECT COUNT(*) FROM user_companies) as links_count,
  (SELECT COUNT(*) FROM drivers) as drivers_count,
  (SELECT COUNT(*) FROM infractions) as infractions_count;

-- Tous les comptes devraient être à 0

-- ==========================================
-- ÉTAPE 4: MESSAGE DE CONFIRMATION
-- ==========================================

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM auth.users) = 0 THEN
    RAISE NOTICE '✅ BASE DE DONNÉES COMPLÈTEMENT RÉINITIALISÉE';
    RAISE NOTICE '👉 Vous pouvez maintenant créer un nouveau compte';
  ELSE
    RAISE WARNING '⚠️ Des utilisateurs existent encore!';
  END IF;
END $$;

-- ==========================================
-- PROCHAINES ÉTAPES
-- ==========================================
-- 1. Allez sur votre application
-- 2. Créez un nouveau compte via /register
-- 3. Testez l'ajout de chauffeur
-- 4. Si problème, exécutez diagnostic_complet.sql
