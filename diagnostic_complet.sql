-- ==========================================
-- DIAGNOSTIC COMPLET DE LA BASE DE DONNÉES
-- ==========================================
-- Exécutez ce script pour voir l'état actuel de votre base

-- 1. VÉRIFIER LES FONCTIONS CRÉÉES
-- =================================
SELECT '=== FONCTIONS DISPONIBLES ===' as section;
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'register_company_admin',
  'get_user_company_info',
  'set_company_id',
  'check_user_registration'
)
ORDER BY routine_name;

-- 2. VÉRIFIER LES POLITIQUES RLS
-- ================================
SELECT '=== POLITIQUES RLS ===' as section;
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd as commande
FROM pg_policies
WHERE tablename IN ('companies', 'user_companies', 'drivers', 'infractions')
ORDER BY tablename, policyname;

-- 3. VÉRIFIER RLS ACTIVÉ
-- ========================
SELECT '=== RLS ACTIVÉ SUR LES TABLES ===' as section;
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('companies', 'user_companies', 'drivers', 'infractions')
ORDER BY tablename;

-- 4. TOUS LES UTILISATEURS AUTH
-- ==============================
SELECT '=== UTILISATEURS DANS AUTH ===' as section;
SELECT
  id,
  email,
  created_at,
  confirmed_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- 5. TOUTES LES ENTREPRISES
-- ==========================
SELECT '=== ENTREPRISES ===' as section;
SELECT
  id,
  name,
  siret,
  driver_count,
  created_at
FROM companies
ORDER BY created_at DESC;

-- 6. TOUS LES LIENS USER-COMPANY
-- ================================
SELECT '=== LIENS UTILISATEUR-ENTREPRISE ===' as section;
SELECT
  uc.id,
  u.email as user_email,
  c.name as company_name,
  uc.role,
  uc.created_at
FROM user_companies uc
LEFT JOIN auth.users u ON u.id = uc.user_id
LEFT JOIN companies c ON c.id = uc.company_id
ORDER BY uc.created_at DESC;

-- 7. UTILISATEURS SANS ENTREPRISE
-- =================================
SELECT '=== UTILISATEURS SANS ENTREPRISE (PROBLÈME!) ===' as section;
SELECT
  u.id,
  u.email,
  u.created_at
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM user_companies)
ORDER BY u.created_at DESC;

-- 8. ENTREPRISES SANS UTILISATEURS
-- ==================================
SELECT '=== ENTREPRISES SANS UTILISATEURS (PROBLÈME!) ===' as section;
SELECT
  c.id,
  c.name,
  c.created_at
FROM companies c
WHERE c.id NOT IN (SELECT company_id FROM user_companies)
ORDER BY c.created_at DESC;

-- 9. TOUS LES CHAUFFEURS
-- =======================
SELECT '=== CHAUFFEURS ===' as section;
SELECT
  d.id,
  d.name,
  d.company_id,
  c.name as company_name,
  d.score,
  d.status,
  d.created_at
FROM drivers d
LEFT JOIN companies c ON c.id = d.company_id
ORDER BY d.created_at DESC;

-- 10. CHAUFFEURS SANS ENTREPRISE
-- ================================
SELECT '=== CHAUFFEURS SANS ENTREPRISE (PROBLÈME!) ===' as section;
SELECT
  id,
  name,
  score,
  status,
  created_at
FROM drivers
WHERE company_id IS NULL
ORDER BY created_at DESC;

-- 11. INFRACTIONS
-- ================
SELECT '=== INFRACTIONS ===' as section;
SELECT
  i.id,
  d.name as driver_name,
  i.type,
  i.severity,
  i.company_id,
  c.name as company_name,
  i.date,
  i.created_at
FROM infractions i
LEFT JOIN drivers d ON d.id = i.driver_id
LEFT JOIN companies c ON c.id = i.company_id
ORDER BY i.created_at DESC
LIMIT 20;

-- 12. VOTRE STATUT (SI CONNECTÉ)
-- ================================
SELECT '=== VOTRE STATUT ACTUEL ===' as section;
SELECT * FROM get_user_company_info();

-- 13. COMPTAGE GLOBAL
-- ====================
SELECT '=== COMPTAGES ===' as section;
SELECT
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM companies) as total_companies,
  (SELECT COUNT(*) FROM user_companies) as total_links,
  (SELECT COUNT(*) FROM drivers) as total_drivers,
  (SELECT COUNT(*) FROM infractions) as total_infractions,
  (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT user_id FROM user_companies)) as users_sans_company,
  (SELECT COUNT(*) FROM companies WHERE id NOT IN (SELECT company_id FROM user_companies)) as companies_sans_users,
  (SELECT COUNT(*) FROM drivers WHERE company_id IS NULL) as drivers_sans_company;
