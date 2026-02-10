-- ==========================================
-- RESET AUTH COMPLET - Nettoie TOUTES les tables auth
-- ==========================================
-- Ce script nettoie les tables auth internes de Supabase
-- À exécuter AVANT RESET_COMPLET_V2.sql si vous avez des erreurs d'auth

-- ==========================================
-- PARTIE 1: NETTOYER LES TABLES AUTH
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '=== NETTOYAGE DES TABLES AUTH ===';

    -- Supprimer les identités (connexions email, OAuth, etc.)
    DELETE FROM auth.identities;
    RAISE NOTICE 'Identités supprimées';

    -- Supprimer les sessions
    DELETE FROM auth.sessions;
    RAISE NOTICE 'Sessions supprimées';

    -- Supprimer les refresh tokens
    DELETE FROM auth.refresh_tokens;
    RAISE NOTICE 'Refresh tokens supprimés';

    -- Supprimer les MFA factors (authentification multi-facteur)
    DELETE FROM auth.mfa_factors;
    RAISE NOTICE 'MFA factors supprimés';

    -- Supprimer les MFA challenges
    DELETE FROM auth.mfa_challenges;
    RAISE NOTICE 'MFA challenges supprimés';

    -- Supprimer les MFA amr claims
    DELETE FROM auth.mfa_amr_claims;
    RAISE NOTICE 'MFA amr claims supprimés';

    -- Supprimer les SSO providers
    DELETE FROM auth.sso_providers;
    RAISE NOTICE 'SSO providers supprimés';

    -- Supprimer les SSO domains
    DELETE FROM auth.sso_domains;
    RAISE NOTICE 'SSO domains supprimés';

    -- Supprimer les SAML providers
    DELETE FROM auth.saml_providers;
    RAISE NOTICE 'SAML providers supprimés';

    -- Supprimer les SAML relay states
    DELETE FROM auth.saml_relay_states;
    RAISE NOTICE 'SAML relay states supprimés';

    -- Supprimer les flow states
    DELETE FROM auth.flow_state;
    RAISE NOTICE 'Flow states supprimés';

    -- Supprimer les utilisateurs (après avoir supprimé toutes les dépendances)
    DELETE FROM auth.users;
    RAISE NOTICE 'Utilisateurs supprimés';

    RAISE NOTICE '';
    RAISE NOTICE '✅ TOUTES LES TABLES AUTH SONT VIDES';
END $$;

-- ==========================================
-- PARTIE 2: VÉRIFICATION
-- ==========================================

DO $$
DECLARE
    users_count INTEGER;
    identities_count INTEGER;
    sessions_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO users_count FROM auth.users;
    SELECT COUNT(*) INTO identities_count FROM auth.identities;
    SELECT COUNT(*) INTO sessions_count FROM auth.sessions;

    RAISE NOTICE '';
    RAISE NOTICE '=== COMPTAGE AUTH ===';
    RAISE NOTICE 'auth.users: %', users_count;
    RAISE NOTICE 'auth.identities: %', identities_count;
    RAISE NOTICE 'auth.sessions: %', sessions_count;
    RAISE NOTICE '';

    IF users_count = 0 AND identities_count = 0 AND sessions_count = 0 THEN
        RAISE NOTICE '✅ AUTH COMPLÈTEMENT NETTOYÉ !';
        RAISE NOTICE '👉 Vous pouvez maintenant exécuter RESET_COMPLET_V2.sql';
    ELSE
        RAISE WARNING '⚠️ Certaines données auth existent encore';
    END IF;
END $$;

-- ==========================================
-- NOTES IMPORTANTES
-- ==========================================
-- Après avoir exécuté ce script :
-- 1. Exécutez RESET_COMPLET_V2.sql pour nettoyer les tables publiques
-- 2. Exécutez INSTALLATION_COMPLETE.sql pour réinstaller tout
-- 3. Testez l'inscription
