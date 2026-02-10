# ✅ Fix : Profil Chauffeur - Données Réelles

## Problème Identifié

Quand vous cliquez sur un profil de chauffeur depuis la page RH (admin), les données affichées étaient hardcodées :
- ❌ Email : `pierre.delanotte@transport-dupont.fr` (mocké)
- ❌ Téléphone : `06 12 34 56 78` (mocké)
- ❌ Date d'embauche : `15/03/2019` (mockée)

## ✅ Solution Appliquée

### 1. Ajout des Colonnes à la Table drivers

**Script SQL** : `ADD_DRIVER_CONTACT_INFO.sql`

Le script ajoute :
- ✅ Colonne `email TEXT` à la table `drivers`
- ✅ Colonne `phone TEXT` à la table `drivers`
- ✅ Fonction `get_driver_email()` pour récupérer l'email depuis auth.users
- ✅ Trigger automatique pour remplir l'email lors de la création d'un driver
- ✅ Mise à jour des emails existants depuis auth.users

### 2. Correction du Composant

**Fichier** : `app/chauffeurs/[id]/page.tsx`

**Avant** :
```tsx
// Données hardcodées
<Mail className="h-4 w-4" />
pierre.delanotte@transport-dupont.fr

<Phone className="h-4 w-4" />
06 12 34 56 78

<Calendar className="h-4 w-4" />
Depuis le 15/03/2019
```

**Après** :
```tsx
// Données depuis la base
{driver.email && (
  <div className="flex items-center gap-2">
    <Mail className="h-4 w-4" />
    {driver.email}
  </div>
)}

{driver.phone && (
  <div className="flex items-center gap-2">
    <Phone className="h-4 w-4" />
    {driver.phone}
  </div>
)}

{driver.created_at && (
  <div className="flex items-center gap-2">
    <Calendar className="h-4 w-4" />
    Depuis le {new Date(driver.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
  </div>
)}
```

---

## 🚀 Comment Appliquer le Fix

### Étape 1 : Exécuter le Script SQL

1. Allez sur **Supabase Dashboard** → **SQL Editor**
2. Copiez TOUT le contenu de **`ADD_DRIVER_CONTACT_INFO.sql`**
3. Cliquez sur **Run**

Vous devriez voir :
```
✅ Colonnes email et phone ajoutées à la table drivers
✅ Fonction get_driver_email créée
✅ Emails des drivers existants mis à jour
✅ Trigger pour auto-remplir l'email créé
🎉 Configuration terminée!
```

### Étape 2 : Rafraîchir l'Application

1. **Rafraîchissez votre page** (Ctrl+R ou Cmd+R)
2. Allez sur `/chauffeurs`
3. Cliquez sur un chauffeur

✅ **Vous devriez voir les vraies données !**

---

## 🧪 Tests Après le Fix

### Test 1 : Vérifier un Chauffeur Existant

1. Allez sur `/chauffeurs`
2. Cliquez sur n'importe quel chauffeur
3. Dans le profil, vérifiez :
   - ✅ **Email** : L'email réel du chauffeur (celui utilisé lors de sa création)
   - ✅ **Date** : La date de création réelle du chauffeur
   - ⚠️ **Téléphone** : Vide pour l'instant (vous pouvez l'ajouter manuellement)

### Test 2 : Créer un Nouveau Chauffeur

1. Dashboard → **Ajouter un chauffeur**
2. Remplissez :
   - Nom : `Marc NOUVEAU`
   - Email : `marc.nouveau@test.com`
   - Mot de passe : `Test1234!`
3. Cliquez sur **Ajouter**
4. Allez voir le profil de ce chauffeur

**✅ Résultat attendu** :
- Email affiché : `marc.nouveau@test.com`
- Date : La date d'aujourd'hui

---

## 📊 Structure de la Table drivers (Après)

```sql
CREATE TABLE drivers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  email TEXT,              -- ✅ AJOUTÉ
  phone TEXT,              -- ✅ AJOUTÉ
  score INTEGER DEFAULT 100,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID REFERENCES companies(id)
);
```

---

## 🔧 Ajouter un Téléphone Manuellement

Le téléphone n'est pas rempli automatiquement. Pour l'ajouter :

```sql
-- Dans Supabase SQL Editor
UPDATE drivers
SET phone = '06 12 34 56 78'
WHERE id = [ID_DU_CHAUFFEUR];
```

Ou créez un formulaire de modification de profil dans l'interface.

---

## 📝 Notes Importantes

### Trigger Automatique

Quand vous créez un nouveau chauffeur avec `add-driver-modal`, le trigger remplit automatiquement l'email depuis `auth.users` :

```sql
CREATE TRIGGER set_driver_email_on_insert
  BEFORE INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION set_driver_email();
```

### Drivers Existants

Les drivers créés avant ce fix ont été mis à jour automatiquement par le script :

```sql
UPDATE drivers
SET email = (SELECT email FROM auth.users WHERE id = drivers.user_id)
WHERE user_id IS NOT NULL AND email IS NULL;
```

---

## ✅ Checklist de Vérification

- [ ] Script `ADD_DRIVER_CONTACT_INFO.sql` exécuté
- [ ] Messages ✅ affichés sans erreur
- [ ] Page chauffeurs rafraîchie
- [ ] Profil d'un chauffeur affiche le vrai email
- [ ] Profil affiche la vraie date de création
- [ ] Nouveau chauffeur créé a automatiquement son email

---

## 🎯 Résumé

**Avant** :
- ❌ Données mockées hardcodées
- ❌ Impossible de voir les vraies informations
- ❌ Email toujours "pierre.delanotte@transport-dupont.fr"

**Après** :
- ✅ Email réel du chauffeur affiché
- ✅ Date de création réelle affichée
- ✅ Possibilité d'ajouter un téléphone
- ✅ Trigger automatique pour les nouveaux chauffeurs
- ✅ Données récupérées depuis la base

**Testez maintenant en cliquant sur un profil chauffeur !** 🚀
