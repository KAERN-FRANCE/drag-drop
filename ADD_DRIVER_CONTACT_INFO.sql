-- ==========================================
-- AJOUTER EMAIL ET PHONE AUX DRIVERS
-- ==========================================
-- Ce script ajoute les colonnes email et phone à la table drivers
-- pour afficher les infos de contact dans le profil

-- ==========================================
-- PARTIE 1: AJOUTER LES COLONNES
-- ==========================================

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS phone TEXT;

DO $$ BEGIN
    RAISE NOTICE '✅ Colonnes email et phone ajoutées à la table drivers';
END $$;

-- ==========================================
-- PARTIE 2: CRÉER UNE FONCTION POUR RÉCUPÉRER L'EMAIL DEPUIS auth.users
-- ==========================================

-- Fonction pour récupérer l'email d'un driver depuis auth.users
CREATE OR REPLACE FUNCTION get_driver_email(driver_user_id UUID)
RETURNS TEXT AS $$
  SELECT email FROM auth.users WHERE id = driver_user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

DO $$ BEGIN
    RAISE NOTICE '✅ Fonction get_driver_email créée';
END $$;

-- ==========================================
-- PARTIE 3: REMPLIR LES EMAILS EXISTANTS
-- ==========================================

-- Mettre à jour les emails des drivers existants depuis auth.users
UPDATE drivers
SET email = (SELECT email FROM auth.users WHERE id = drivers.user_id)
WHERE user_id IS NOT NULL AND email IS NULL;

DO $$ BEGIN
    RAISE NOTICE '✅ Emails des drivers existants mis à jour';
END $$;

-- ==========================================
-- PARTIE 4: CRÉER UN TRIGGER POUR AUTO-REMPLIR L'EMAIL
-- ==========================================

-- Fonction trigger pour remplir automatiquement l'email lors de la création
CREATE OR REPLACE FUNCTION set_driver_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND (NEW.email IS NULL OR NEW.email = '') THEN
    NEW.email := (SELECT email FROM auth.users WHERE id = NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger
DROP TRIGGER IF EXISTS set_driver_email_on_insert ON drivers;
CREATE TRIGGER set_driver_email_on_insert
  BEFORE INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION set_driver_email();

DO $$ BEGIN
    RAISE NOTICE '✅ Trigger pour auto-remplir l''email créé';
END $$;

-- ==========================================
-- PARTIE 5: VÉRIFICATION
-- ==========================================

DO $$
DECLARE
    has_email_col BOOLEAN;
    has_phone_col BOOLEAN;
    drivers_with_email INTEGER;
    total_drivers INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== VÉRIFICATION ===';

    -- Vérifier colonnes
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'drivers' AND column_name = 'email'
    ) INTO has_email_col;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'drivers' AND column_name = 'phone'
    ) INTO has_phone_col;

    IF has_email_col THEN
        RAISE NOTICE '✅ Colonne email existe';
    ELSE
        RAISE WARNING '❌ Colonne email n''existe pas';
    END IF;

    IF has_phone_col THEN
        RAISE NOTICE '✅ Colonne phone existe';
    ELSE
        RAISE WARNING '❌ Colonne phone n''existe pas';
    END IF;

    -- Compter les drivers avec email
    SELECT COUNT(*) INTO total_drivers FROM drivers;
    SELECT COUNT(*) INTO drivers_with_email FROM drivers WHERE email IS NOT NULL;

    RAISE NOTICE '   Total drivers: %', total_drivers;
    RAISE NOTICE '   Drivers avec email: %', drivers_with_email;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 Configuration terminée!';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Note: Les nouveaux chauffeurs auront automatiquement leur email';
    RAISE NOTICE '📝 Pour ajouter un téléphone, modifiez le profil du chauffeur';
END $$;

-- ==========================================
-- AFFICHER LES DRIVERS
-- ==========================================

SELECT '=== DRIVERS AVEC INFOS DE CONTACT ===' as section;

SELECT
    id,
    name,
    email,
    phone,
    created_at
FROM drivers
ORDER BY created_at DESC;
