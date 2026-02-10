# Fix Erreurs d'Inscription & Ajout de Chauffeur

## 🚨 Problèmes Résolus

Ce fix résout deux erreurs critiques :

### 1. Erreur lors de la création de compte
```
new row violates row-level security policy for table "companies"
```

### 2. Erreur lors de l'ajout de chauffeur
```
Erreur lors de l'ajout du chauffeur: User is not associated with any company.
Please ensure user is registered properly.
```

## 🔧 Cause du Problème

Les politiques Row Level Security (RLS) étaient trop restrictives et empêchaient :
1. Les nouveaux utilisateurs de créer leur entreprise lors de l'inscription
2. Les utilisateurs non liés à une entreprise d'ajouter des chauffeurs

## ✅ Solution

Le fix applique **3 corrections** :

### 1. Assouplit les Politiques RLS
- Permet aux utilisateurs authentifiés de créer des entreprises
- Permet aux utilisateurs de se lier à une entreprise

### 2. Crée une Fonction PostgreSQL Sécurisée
`register_company_admin()` - Crée atomiquement l'entreprise et lie l'utilisateur en une seule transaction, en contournant les problèmes RLS

### 3. Met à Jour le Code d'Inscription
Le code utilise maintenant la fonction PostgreSQL au lieu d'insérer directement dans les tables

## 🚀 Application du Fix (OBLIGATOIRE)

### Étape 1 : Exécuter le Script SQL

1. Allez sur https://supabase.com
2. Ouvrez votre projet TachoCompliance
3. Allez dans **SQL Editor** (menu de gauche)
4. Cliquez sur **New query**
5. **IMPORTANT** : Exécutez d'abord le script `fix_registration_rls.sql`
   - Copiez tout le contenu du fichier `fix_registration_rls.sql`
   - Collez dans SQL Editor
   - Cliquez sur **Run** ou `Ctrl+Enter`
   - ✅ Vérifiez qu'il n'y a **aucune erreur** dans les résultats

6. Ensuite, exécutez le script `fix_rls_policies.sql` (pour les chauffeurs)
   - Copiez tout le contenu du fichier `fix_rls_policies.sql`
   - Collez dans SQL Editor
   - Cliquez sur **Run**
   - ✅ Vérifiez qu'il n'y a **aucune erreur**

### Étape 2 : Vérifier l'Installation

Exécutez cette requête dans SQL Editor :

```sql
-- Vérifier que la fonction existe
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('register_company_admin', 'get_user_company_info');
```

Vous devriez voir 2 lignes retournées.

### Étape 3 : Déployer le Nouveau Code

Le code a été mis à jour sur GitHub. Il sera automatiquement déployé sur Vercel.

**OU** si vous êtes en local :
```bash
git pull origin main
npm install
npm run dev
```

## 🧪 Tester l'Inscription

### Test 1 : Créer un Nouveau Compte Entreprise

1. Allez sur `/register`
2. Sélectionnez **Entreprise / RH**
3. Remplissez le formulaire :
   - Étape 1 : Informations entreprise
   - Étape 2 : Informations personnelles
4. Cliquez sur **Créer mon compte entreprise**
5. ✅ Vous devriez être redirigé vers `/dashboard`
6. ✅ Aucune erreur ne devrait apparaître

### Test 2 : Vérifier le Lien Entreprise-Utilisateur

Après avoir créé votre compte, exécutez dans SQL Editor :

```sql
SELECT * FROM get_user_company_info();
```

Vous devriez voir :
- ✅ `is_linked`: true
- ✅ `company_name`: Le nom de votre entreprise
- ✅ `role`: admin

### Test 3 : Ajouter un Chauffeur

Exécutez dans SQL Editor :

```sql
INSERT INTO drivers (name, initials, score, status)
VALUES ('Jean TEST', 'JT', 100, 'active');
```

✅ Aucune erreur ne devrait apparaître
✅ Le chauffeur devrait être visible dans votre dashboard

## 🔍 Diagnostic des Problèmes

### Si vous avez encore des erreurs

#### 1. Vérifier que les scripts ont été exécutés

```sql
-- Doit retourner 2 fonctions
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('register_company_admin', 'get_user_company_info');
```

#### 2. Vérifier les politiques RLS

```sql
-- Doit montrer les nouvelles politiques
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('companies', 'user_companies')
ORDER BY tablename;
```

#### 3. Vérifier votre statut utilisateur

```sql
SELECT * FROM get_user_company_info();
```

Si `is_linked` est `false`, vous devez recréer votre compte.

### Nettoyer et Recommencer

Si vous avez un compte créé avant le fix qui ne fonctionne pas :

```sql
-- 1. Trouver votre user_id
SELECT id, email FROM auth.users WHERE email = 'votre@email.com';

-- 2. Supprimer les anciennes données (remplacez USER_ID)
DELETE FROM user_companies WHERE user_id = 'USER_ID';
DELETE FROM auth.users WHERE id = 'USER_ID';

-- 3. Recréez votre compte via /register
```

## 📊 Architecture Après le Fix

```
Inscription Admin:
1. User crée un compte → auth.users (Supabase Auth)
2. Fonction register_company_admin() s'exécute:
   a. Crée l'entreprise → companies
   b. Lie l'user à l'entreprise → user_companies
3. Redirection vers /dashboard

Ajout de Chauffeur:
1. User ajoute un chauffeur → INSERT INTO drivers
2. Trigger set_company_id() s'exécute automatiquement
3. company_id est défini à partir de user_companies
4. RLS filtre automatiquement les données par company
```

## ✅ Checklist Post-Fix

- [ ] Script `fix_registration_rls.sql` exécuté sans erreur
- [ ] Script `fix_rls_policies.sql` exécuté sans erreur
- [ ] Fonction `register_company_admin` visible dans Supabase
- [ ] Fonction `get_user_company_info` visible dans Supabase
- [ ] Test d'inscription entreprise réussit
- [ ] `get_user_company_info()` retourne `is_linked: true`
- [ ] Ajout de chauffeur fonctionne
- [ ] Chauffeur visible dans le dashboard
- [ ] Code déployé sur Vercel

## 🆘 Support

Si après avoir appliqué ce fix vous avez encore des problèmes :

1. Vérifiez que **les deux scripts SQL** ont été exécutés
2. Vérifiez qu'il n'y a **aucune erreur** dans les résultats SQL
3. Essayez de créer un **nouveau compte** (pas un ancien compte)
4. Vérifiez les logs de la console navigateur (F12)
5. Vérifiez les logs Supabase (Logs → Database)

## 🎉 Une Fois que Tout Fonctionne

Vous pourrez :
- ✅ Créer des comptes entreprise
- ✅ Ajouter des chauffeurs
- ✅ Uploader des fichiers de chronotachygraphe
- ✅ Voir vos analyses dans le dashboard
- ✅ Chaque entreprise voit uniquement ses propres données
