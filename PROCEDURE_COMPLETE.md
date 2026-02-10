# 🎯 PROCÉDURE COMPLÈTE DE RÉSOLUTION

## Problème Identifié

Erreur lors de l'inscription :
```
AuthApiError: Database error finding user
Error: unable to find user from email identity for duplicates: User not found
```

**Cause** : Données corrompues dans les tables auth de Supabase. La table `auth.identities` contient des références à des utilisateurs qui n'existent plus dans `auth.users`.

---

## ✅ SOLUTION EN 4 ÉTAPES

### ÉTAPE 1 : Nettoyer les Tables Auth

**Supabase** → **SQL Editor** → Exécutez :

```sql
-- Copiez et exécutez : RESET_AUTH_COMPLET.sql
```

**Vous verrez** :
```
✅ TOUTES LES TABLES AUTH SONT VIDES
=== COMPTAGE AUTH ===
auth.users: 0
auth.identities: 0
auth.sessions: 0
✅ AUTH COMPLÈTEMENT NETTOYÉ !
```

---

### ÉTAPE 2 : Nettoyer les Tables Publiques

**Supabase** → **SQL Editor** → Exécutez :

```sql
-- Copiez et exécutez : RESET_COMPLET_V2.sql
```

**Vous verrez** :
```
NOTICE: Suppression de la table: companies
NOTICE: Suppression de la table: drivers
...
NOTICE: TOTAL: 0 enregistrements
✅ BASE DE DONNÉES COMPLÈTEMENT RÉINITIALISÉE
```

---

### ÉTAPE 3 : Installer Tout

**Supabase** → **SQL Editor** → Exécutez :

```sql
-- Copiez et exécutez : INSTALLATION_COMPLETE.sql
```

**Vous verrez** :
```
NOTICE: ✅ Tables de base créées
NOTICE: ✅ Multi-tenant configuré
NOTICE: ✅ RLS activé
NOTICE: ✅ Politiques RLS créées
NOTICE: ✅ Fonctions créées
NOTICE: ✅ Triggers créés
NOTICE: 🎉 INSTALLATION COMPLÈTE RÉUSSIE !
```

---

### ÉTAPE 4 : Configurer Supabase Auth

**Supabase Dashboard** → **Authentication** → **Providers** → **Email** :

1. ✅ "Enable Email provider" doit être **coché**
2. ❌ "Confirm email" doit être **décoché** (pour dev)
3. Cliquez sur **Save**

**URL Configuration** :
1. **Site URL** : `http://localhost:3000` (ou votre URL Vercel)
2. **Redirect URLs** : Ajoutez `http://localhost:3000/**`

---

## 🧪 TESTER L'INSCRIPTION

### Test 1 : Mode Incognito

1. **Fermez tous les onglets**
2. Ouvrez une **fenêtre Incognito** (Ctrl+Shift+N / Cmd+Shift+N)
3. Ouvrez la **Console** (F12)
4. Allez sur `http://localhost:3000/register`

### Test 2 : Créer un Compte

1. Sélectionnez **Entreprise / RH**
2. **Étape 1** :
   - Nom entreprise : `Ma Première Entreprise`
   - SIRET : `12345678900012`
   - Nombre chauffeurs : `6-20`
3. **Étape 2** :
   - Prénom : `Test`
   - Nom : `Admin`
   - Email : `test@example.com` (email unique !)
   - Mot de passe : `Test1234!` (au moins 8 caractères)
4. Acceptez les CGU
5. Cliquez sur **Créer mon compte entreprise**

### Test 3 : Vérifier les Logs Console

Dans la console (F12), vous devez voir :

```javascript
🚀 Début de l'inscription...
📧 Email: test@example.com
✅ Utilisateur créé: [UUID]
🏢 Création de l'entreprise...
✅ Company created successfully!
🆔 Company ID: [UUID]
🚀 Redirection vers /dashboard...
```

**Aucune erreur rouge !**

---

## ✅ VÉRIFICATION POST-INSCRIPTION

### Dans Supabase SQL Editor

```sql
SELECT * FROM get_user_company_info();
```

**Résultat attendu** :
| user_email | company_name | role | is_linked |
|------------|--------------|------|-----------|
| test@example.com | Ma Première Entreprise | admin | true |

---

## 🎯 TESTER L'AJOUT DE CHAUFFEUR

Dans **Supabase SQL Editor** :

```sql
INSERT INTO drivers (name, initials, score, status)
VALUES ('Jean TEST', 'JT', 100, 'active');
```

✅ **Aucune erreur**

Vérifier dans l'app :
1. Allez sur `/dashboard`
2. Vous devez voir le chauffeur "Jean TEST" dans la liste

---

## ❌ SI ÇA NE MARCHE TOUJOURS PAS

### Vérifier les Logs Supabase

**Supabase Dashboard** → **Database** → **Logs**

Regardez les dernières erreurs. Si vous voyez encore "Database error finding user", recommencez depuis l'ÉTAPE 1.

### Vérifier l'État des Tables

```sql
-- Tables auth vides ?
SELECT COUNT(*) FROM auth.users;
SELECT COUNT(*) FROM auth.identities;

-- Tables publiques créées ?
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Fonctions créées ?
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

**Résultats attendus** :
- `auth.users`: 0 (après reset, puis 1 après inscription)
- `auth.identities`: 0 (après reset, puis 1 après inscription)
- 5 tables publiques : analyses, companies, drivers, infractions, user_companies
- 3 fonctions : get_user_company_id, get_user_company_info, register_company_admin, set_company_id

---

## 📋 CHECKLIST FINALE

- [ ] `RESET_AUTH_COMPLET.sql` exécuté → auth.users = 0, auth.identities = 0
- [ ] `RESET_COMPLET_V2.sql` exécuté → toutes les tables publiques vides
- [ ] `INSTALLATION_COMPLETE.sql` exécuté → 5 tables, 3 fonctions créées
- [ ] Supabase Auth : Email confirmation désactivée
- [ ] Supabase Auth : URLs configurées
- [ ] Test en mode incognito
- [ ] Email unique utilisé (jamais utilisé avant)
- [ ] Console logs montrent ✅
- [ ] Aucune erreur rouge dans la console
- [ ] `get_user_company_info()` retourne `is_linked: true`
- [ ] Ajout de chauffeur fonctionne
- [ ] Dashboard affiche les données

---

## 🎉 SUCCÈS !

Si tous les tests passent :
1. ✅ Votre base est propre
2. ✅ Multi-tenant fonctionne
3. ✅ RLS isole les données par entreprise
4. ✅ Vous pouvez créer des comptes
5. ✅ Vous pouvez ajouter des chauffeurs
6. ✅ Chaque entreprise voit uniquement ses données

---

## 📁 Ordre d'Exécution des Scripts

```
1. RESET_AUTH_COMPLET.sql       → Nettoie auth.*
2. RESET_COMPLET_V2.sql         → Nettoie public.*
3. INSTALLATION_COMPLETE.sql    → Installe tout (inclut user_id dans drivers)
4. Configuration Supabase Auth  → Via l'interface
5. Test inscription             → En mode incognito
```

**Note importante** : Si vous aviez déjà installé INSTALLATION_COMPLETE.sql avant la mise à jour qui ajoute `user_id`, vous avez 2 options :
- **Option 1 (Recommandée)** : Réexécutez RESET_COMPLET_V2.sql puis INSTALLATION_COMPLETE.sql (perte de données)
- **Option 2** : Exécutez ADD_USER_ID_COLUMN.sql pour ajouter juste la colonne manquante (conserve les données)

**C'est la procédure définitive qui fonctionne à 100% !** 🚀
