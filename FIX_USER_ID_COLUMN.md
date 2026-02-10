# 🔧 Fix: Erreur "Could not find user_id column"

## Problème Identifié

**Erreur** : `Could not find the 'user_id' column of 'drivers' in the schema cache`

**Cause** : La table `drivers` manquait la colonne `user_id` qui est nécessaire pour :
- Lier un chauffeur à son compte auth (pour qu'il puisse se connecter)
- Permettre aux chauffeurs de voir leurs propres données

## Architecture Correcte

La table `drivers` nécessite **DEUX colonnes** de liaison :

### 1. `user_id` (UUID → auth.users)
- **Rôle** : Lier un chauffeur à son compte d'authentification
- **Utilisation** :
  - Quand un chauffeur se connecte avec son email/mot de passe
  - Pour afficher le profil du chauffeur connecté
  - Pour filtrer les données du chauffeur (infractions, analyses)

### 2. `company_id` (UUID → companies)
- **Rôle** : Lier un chauffeur à son entreprise
- **Utilisation** :
  - Pour l'isolation multi-tenant (RLS)
  - Pour que les admins ne voient que les chauffeurs de leur entreprise
  - Défini automatiquement par un trigger lors de l'insertion

## ✅ Solution Appliquée

### 1. Mise à Jour de `INSTALLATION_COMPLETE.sql`
Ajout de `user_id` dans la création de la table drivers :
```sql
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- ✅ AJOUTÉ
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Création de `ADD_USER_ID_COLUMN.sql`
Script de migration pour ajouter la colonne si elle manque.

### 3. Mise à Jour de `components/drivers/add-driver-modal.tsx`
Le code insère maintenant `user_id` lors de la création d'un chauffeur :
```typescript
const { error: driverError } = await supabase
  .from('drivers')
  .insert({
    user_id: authData.user.id,  // ✅ Lie le driver à son compte auth
    name: formData.fullName,
    initials: generateInitials(formData.fullName),
    score: 100,
    status: 'active'
  })
```

---

## 🚀 Que Faire Maintenant ?

Vous avez **2 options** selon votre situation :

### Option 1 : Reset Complet (Recommandé si pas de données importantes)

1. **Supabase** → **SQL Editor** → Exécutez dans l'ordre :
   ```
   1. RESET_AUTH_COMPLET.sql
   2. RESET_COMPLET_V2.sql
   3. INSTALLATION_COMPLETE.sql (version mise à jour)
   ```

2. Testez l'inscription d'une entreprise

3. Testez l'ajout d'un chauffeur depuis le dashboard

✅ **Avantage** : Installation propre avec le bon schéma
❌ **Inconvénient** : Perte de toutes les données existantes

---

### Option 2 : Ajouter Juste la Colonne (Si vous voulez conserver les données)

1. **Supabase** → **SQL Editor** → Exécutez :
   ```
   ADD_USER_ID_COLUMN.sql
   ```

2. Vérifiez que le script affiche :
   ```
   ✅ Colonne user_id ajoutée à la table drivers
   ✅ Index idx_drivers_user_id créé
   🎉 SUCCÈS! La table drivers a maintenant user_id et company_id
   ```

3. Testez l'ajout d'un chauffeur depuis le dashboard

✅ **Avantage** : Conserve les données existantes
⚠️ **Note** : Les chauffeurs existants n'auront pas de user_id (NULL) et ne pourront pas se connecter

---

## 🧪 Tests Après le Fix

### Test 1 : Vérifier le Schéma

Exécutez dans **SQL Editor** :
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'drivers'
ORDER BY ordinal_position;
```

**Résultat attendu** :
```
id          | integer | NO
user_id     | uuid    | YES  ← DOIT ÊTRE PRÉSENT
name        | text    | NO
initials    | text    | NO
score       | integer | NO
status      | text    | NO
created_at  | timestamp with time zone | YES
updated_at  | timestamp with time zone | YES
company_id  | uuid    | YES  ← DOIT ÊTRE PRÉSENT
```

---

### Test 2 : Ajouter un Chauffeur (Admin)

1. Connectez-vous en tant qu'admin d'une entreprise
2. Allez sur `/dashboard`
3. Cliquez sur **"Ajouter un chauffeur"**
4. Remplissez :
   - Nom complet : `Jean TEST`
   - Email : `jean.test@example.com`
   - Mot de passe : `Test1234!`
5. Cliquez sur **Ajouter**

**✅ Résultat attendu** : "Chauffeur ajouté avec succès !"

**❌ Si erreur** : Vérifiez que la colonne `user_id` existe bien

---

### Test 3 : Se Connecter en Tant que Chauffeur

1. **Déconnectez-vous** de votre compte admin
2. Allez sur `/login`
3. Sélectionnez **Mode Chauffeur**
4. Connectez-vous avec :
   - Email : `jean.test@example.com`
   - Mot de passe : `Test1234!`
5. Vous devez être redirigé vers `/chauffeur`

**✅ Résultat attendu** : Dashboard chauffeur avec les données de Jean TEST

**❌ Si erreur "Driver not found"** :
- Vérifiez que le driver a bien un `user_id` :
  ```sql
  SELECT id, name, user_id, company_id FROM drivers;
  ```

---

### Test 4 : Vérifier l'Isolation Multi-Tenant

1. Créez **un deuxième compte entreprise** avec un email différent
2. Ajoutez un chauffeur à la deuxième entreprise
3. Connectez-vous avec le **premier compte admin**
4. Vérifiez que vous ne voyez **QUE** les chauffeurs de votre entreprise

**✅ Résultat attendu** : Chaque entreprise voit uniquement ses propres chauffeurs

---

## 📊 Schéma Complet de la Table drivers

```sql
CREATE TABLE drivers (
  id SERIAL PRIMARY KEY,

  -- Liaison auth : pour que le chauffeur puisse se connecter
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Informations du chauffeur
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Liaison entreprise : pour l'isolation multi-tenant
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE
);

-- Index pour les requêtes rapides
CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_company_id ON drivers(company_id);
```

---

## 🎯 Résumé

### Avant le Fix
- ❌ Table `drivers` sans `user_id`
- ❌ Impossible d'ajouter des chauffeurs depuis le dashboard
- ❌ Erreur : "Could not find user_id column"

### Après le Fix
- ✅ Table `drivers` avec `user_id` ET `company_id`
- ✅ Ajout de chauffeurs fonctionne
- ✅ Chauffeurs peuvent se connecter avec leur compte
- ✅ Isolation multi-tenant complète
- ✅ Admin voit uniquement ses chauffeurs
- ✅ Chauffeur voit uniquement ses propres données

---

## 📝 Fichiers Modifiés

1. ✅ `INSTALLATION_COMPLETE.sql` - Ajoute `user_id` dans CREATE TABLE
2. ✅ `ADD_USER_ID_COLUMN.sql` - Nouveau script de migration
3. ✅ `components/drivers/add-driver-modal.tsx` - Insère `user_id` lors de la création
4. ✅ `PROCEDURE_COMPLETE.md` - Documentation mise à jour
5. ✅ `FIX_USER_ID_COLUMN.md` - Ce guide (nouveau)

---

## ❓ FAQ

**Q : Est-ce que je dois réinstaller tout ?**
R : Non, vous pouvez utiliser `ADD_USER_ID_COLUMN.sql` pour ajouter juste la colonne.

**Q : Est-ce que mes chauffeurs existants vont fonctionner ?**
R : Non, ils n'auront pas de `user_id` (NULL). Vous devrez les recréer OU les lier manuellement à des comptes auth.

**Q : Est-ce que l'isolation multi-tenant fonctionne toujours ?**
R : Oui ! `company_id` gère l'isolation, `user_id` gère juste l'authentification des chauffeurs.

**Q : Quelle est la différence entre user_id et company_id ?**
R :
- `user_id` : "Ce chauffeur est lié au compte auth X" (pour login)
- `company_id` : "Ce chauffeur appartient à l'entreprise Y" (pour RLS)

**Q : Est-ce que je peux avoir un chauffeur sans user_id ?**
R : Techniquement oui (colonne nullable), mais il ne pourra pas se connecter.

---

## 🎉 C'est Terminé !

Une fois que vous avez exécuté l'une des options ci-dessus, le problème est résolu définitivement. Vous pouvez :
- ✅ Créer des comptes entreprise
- ✅ Ajouter des chauffeurs depuis le dashboard admin
- ✅ Les chauffeurs peuvent se connecter avec leur compte
- ✅ Isolation complète entre entreprises
- ✅ Chaque chauffeur voit uniquement ses propres données
