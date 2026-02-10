# 🚨 Guide de Résolution Complète - Problèmes d'Inscription

## Symptômes

1. ❌ Création de compte renvoie sur un autre compte
2. ❌ Le compte créé n'est pas accessible
3. ❌ Erreurs RLS persistent

## 🎯 Solution en 5 Étapes

### ÉTAPE 1 : Diagnostic Complet

Allez sur Supabase → **SQL Editor** → Exécutez le script `diagnostic_complet.sql`

Cela va afficher l'état complet de votre base. **Prenez une capture d'écran des résultats**.

#### Ce qu'on cherche :
- ✅ Fonctions créées : `register_company_admin`, `get_user_company_info`
- ✅ Politiques RLS présentes
- ❌ Utilisateurs sans entreprise (section "UTILISATEURS SANS ENTREPRISE")
- ❌ Entreprises sans utilisateurs
- ❌ Chauffeurs sans entreprise

---

### ÉTAPE 2 : Configurer Supabase Auth

#### 2.1 Désactiver la Confirmation d'Email (Développement uniquement)

1. Supabase Dashboard → **Authentication** → **Providers** → **Email**
2. Décochez **"Confirm email"**
3. Cliquez sur **Save**

#### 2.2 Vérifier l'URL du Site

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. **Site URL** doit être :
   - En local : `http://localhost:3000`
   - En prod : `https://votre-app.vercel.app`
3. **Redirect URLs** : Ajoutez :
   - `http://localhost:3000/**`
   - `https://votre-app.vercel.app/**`

#### 2.3 Désactiver la Double Authentification

1. **Authentication** → **Policies**
2. Vérifiez qu'il n'y a pas de règles qui bloquent

---

### ÉTAPE 3 : Reset Complet de la Base

⚠️ **ATTENTION : Cela supprime TOUTES les données !**

1. Supabase → **SQL Editor**
2. Copiez le contenu de **`RESET_COMPLET_V2.sql`** (utilise V2, pas V1 !)
3. Lisez les avertissements dans le script
4. Exécutez le script
5. Vérifiez que tous les compteurs sont à 0

**Pourquoi V2 ?**
- V2 gère automatiquement toutes les foreign keys
- V2 découvre et supprime toutes les tables (y compris `utilisateurs`, `fichiers`)
- V2 réinitialise automatiquement toutes les séquences
- V2 utilise TRUNCATE CASCADE pour éviter les erreurs de contraintes

---

### ÉTAPE 4 : Installation Complète

**IMPORTANT : Utilisez un seul script qui fait tout !**

1. Supabase → **SQL Editor**
2. Copiez le contenu de **`INSTALLATION_COMPLETE.sql`**
3. Exécutez le script
4. Attendez les messages de confirmation

#### Vous devriez voir :
```
✅ Tables de base créées
✅ Multi-tenant configuré
✅ RLS activé
✅ Politiques RLS créées
✅ Fonctions créées
✅ Triggers créés
🎉 INSTALLATION COMPLÈTE RÉUSSIE !
```

#### Vérification
Le script vérifie automatiquement que tout est installé. Vous verrez :
- Tables créées: 5
- Fonctions créées: 3
- Politiques RLS créées: [plusieurs]

**Pourquoi un seul script ?**
- L'ordre d'exécution est critique
- Les dépendances sont gérées automatiquement
- Évite les erreurs "table does not exist"
- Tout est fait en une fois

---

### ÉTAPE 5 : Test d'Inscription Complète

#### 5.1 Déconnexion Totale

1. Dans votre navigateur, ouvrez la **Console** (F12)
2. Allez dans **Application** → **Storage**
3. Supprimez :
   - **Local Storage** : Tout
   - **Session Storage** : Tout
   - **Cookies** : Tout
4. Fermez et rouvrez le navigateur

#### 5.2 Mode Incognito (Recommandé)

Ouvrez une fenêtre incognito/privée pour tester.

#### 5.3 Créer un Nouveau Compte

1. Allez sur `/register`
2. Sélectionnez **Entreprise / RH**
3. **Étape 1** :
   - Nom entreprise : `Test Company`
   - SIRET : `12345678900012`
   - Nombre chauffeurs : `6-20`
4. **Étape 2** :
   - Prénom : `Admin`
   - Nom : `Test`
   - Email : `admin@test.com` (utilisez un email unique !)
   - Mot de passe : Au moins 8 caractères
5. Acceptez les CGU
6. Cliquez sur **Créer mon compte entreprise**

#### 5.4 Observer les Logs

Ouvrez la **Console** (F12) et regardez les messages :
- ✅ "✅ Company created successfully: [UUID]"
- ❌ Si erreur, notez le message exact

---

### ÉTAPE 6 : Vérification Post-Inscription

#### 6.1 Vérifier dans Supabase

```sql
-- Exécutez dans SQL Editor
SELECT * FROM get_user_company_info();
```

**Résultat attendu** :
- `user_email` : votre email
- `company_name` : Test Company
- `role` : admin
- `is_linked` : **true**

#### 6.2 Tester l'Ajout de Chauffeur

```sql
INSERT INTO drivers (name, initials, score, status)
VALUES ('Jean TEST', 'JT', 100, 'active');
```

✅ **Succès** : Aucune erreur
❌ **Échec** : Erreur RLS → Retour à l'étape 4

#### 6.3 Vérifier dans le Dashboard

1. Allez sur `/dashboard`
2. Vous devez voir :
   - ✅ Le chauffeur "Jean TEST"
   - ✅ Les statistiques
   - ✅ Aucune erreur

---

## 🔍 Si ça ne Marche Toujours Pas

### Problème : "Renvoyé sur un autre compte"

**Cause** : Sessions mélangées, cache navigateur

**Solution** :
1. Supprimez complètement le cache navigateur
2. Utilisez mode incognito
3. Essayez un autre navigateur
4. Videz le Local Storage manuellement :
   ```javascript
   // Console navigateur (F12)
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

### Problème : "Email déjà utilisé"

**Cause** : Compte fantôme dans auth.users

**Solution** :
```sql
-- Trouver tous les comptes
SELECT id, email FROM auth.users;

-- Supprimer un compte spécifique (remplacez l'email)
DELETE FROM auth.users WHERE email = 'admin@test.com';
```

### Problème : "User is not associated with any company"

**Cause** : Fonction `register_company_admin` n'existe pas ou a échoué

**Solution** :
```sql
-- Vérifier que la fonction existe
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'register_company_admin';
```

Si vide → Réexécutez `fix_registration_rls.sql`

### Problème : Les scripts SQL donnent des erreurs

**Cause** : Ordre d'exécution incorrect ou conflits

**Solution** :
1. Exécutez `RESET_COMPLET.sql` d'abord
2. Puis les 3 scripts dans l'ordre (étape 4)

---

## 📊 Checklist de Vérification Finale

- [ ] Supabase Auth : Email confirmation désactivée
- [ ] Supabase Auth : URL correctes configurées
- [ ] `diagnostic_complet.sql` exécuté sans erreur
- [ ] `RESET_COMPLET.sql` exécuté (tous les compteurs à 0)
- [ ] `supabase_multi_tenant.sql` exécuté
- [ ] `fix_rls_policies.sql` exécuté
- [ ] `fix_registration_rls.sql` exécuté
- [ ] 3 fonctions visibles dans Supabase
- [ ] Cache navigateur vidé / Mode incognito
- [ ] Nouveau compte créé avec email unique
- [ ] `get_user_company_info()` retourne `is_linked: true`
- [ ] Ajout de chauffeur fonctionne
- [ ] Dashboard affiche les bonnes données

---

## 🆘 Derniers Recours

Si après TOUT cela ça ne fonctionne toujours pas :

1. **Exporter les résultats** de `diagnostic_complet.sql`
2. **Copier les logs** de la console navigateur (F12)
3. **Copier les messages d'erreur** exacts
4. **Vérifier** que vous utilisez bien la dernière version du code (git pull)

---

## 🎉 Une Fois que Tout Fonctionne

1. **Réactivez** la confirmation d'email si nécessaire
2. **Testez** avec un deuxième compte
3. **Vérifiez** l'isolation : Compte A ne voit pas les données du Compte B
4. **Créez une sauvegarde** de votre base Supabase

---

## 📝 Notes Importantes

- **Développement** : Laissez email confirmation désactivé
- **Production** : Réactivez email confirmation
- **Isolation** : Testez toujours avec 2 comptes différents
- **Backup** : Avant tout reset, faites un backup si vous avez des données importantes

---

## 🔗 Fichiers Importants

### Scripts à Utiliser (dans l'ordre)

1. **`diagnostic_complet.sql`** - Diagnostiquer l'état actuel
2. **`RESET_COMPLET_V2.sql`** - Repartir à zéro (supprime tout)
3. **`INSTALLATION_COMPLETE.sql`** - Installer tout (tables + multi-tenant + RLS)

### Scripts Obsolètes (NE PAS UTILISER)

❌ `RESET_COMPLET.sql` - Utilisez V2 à la place
❌ `supabase_multi_tenant.sql` - Inclus dans INSTALLATION_COMPLETE.sql
❌ `fix_rls_policies.sql` - Inclus dans INSTALLATION_COMPLETE.sql
❌ `fix_registration_rls.sql` - Inclus dans INSTALLATION_COMPLETE.sql
❌ `supabase_schema.sql` - Inclus dans INSTALLATION_COMPLETE.sql

### Ordre Correct d'Exécution

```
1. diagnostic_complet.sql       (optionnel - pour voir l'état)
2. RESET_COMPLET_V2.sql        (supprime tout)
3. INSTALLATION_COMPLETE.sql   (installe tout)
```

C'est tout ! Plus besoin d'exécuter 4-5 scripts différents.
