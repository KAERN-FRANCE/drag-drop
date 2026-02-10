# ✅ Fix : Affichage Profil et Entreprise

## Problème Identifié

Lors de la création d'un compte RH/Admin, les données ne s'affichaient pas car le code cherchait aux mauvais endroits :

### ❌ Avant

1. **Nom/Prénom** : Cherchés comme `full_name` ou `name` dans `user_metadata`
   - **Réalité** : Stockés comme `first_name` et `last_name`

2. **Nom entreprise/SIRET** : Cherchés dans `user_metadata.company_name`
   - **Réalité** : Stockés dans la table `companies`

---

## ✅ Solution Appliquée

### 1. Correction du Header (`components/dashboard/header.tsx`)

**Nom de l'entreprise** :
```typescript
// Avant : user.user_metadata?.company_name
// Après : Récupération depuis la table companies
const { data: userCompanyData } = await supabase
  .from('user_companies')
  .select('company_id')
  .eq('user_id', user.id)
  .single()

const { data: companyInfo } = await supabase
  .from('companies')
  .select('name')
  .eq('id', userCompanyData.company_id)
  .single()
```

**Nom de l'utilisateur** :
```typescript
// Avant : metadata.full_name || metadata.name
// Après : Construction depuis first_name + last_name
if (metadata.first_name && metadata.last_name) {
  return `${metadata.first_name} ${metadata.last_name}`
}
```

**Initiales** :
```typescript
// Avant : name.substring(0, 2)
// Après : Première lettre du prénom + première lettre du nom
if (metadata.first_name && metadata.last_name) {
  return (metadata.first_name.charAt(0) + metadata.last_name.charAt(0)).toUpperCase()
}
```

### 2. Correction de la Page Paramètres (`app/parametres/page.tsx`)

**Données entreprise** :
```typescript
// Avant : user.user_metadata.company_name, user.user_metadata.siret
// Après : Récupération depuis la table companies
const { data: userCompanyData } = await supabase
  .from('user_companies')
  .select('company_id')
  .eq('user_id', user.id)
  .single()

const { data: companyInfo } = await supabase
  .from('companies')
  .select('name, siret')
  .eq('id', userCompanyData.company_id)
  .single()

setCompanyData({
  companyName: companyInfo.name || '',
  siret: companyInfo.siret || '',
  address: '', // Address not stored yet
})
```

---

## 🧪 Tests Après le Fix

### Test 1 : Créer un Nouveau Compte

1. Allez sur `/register`
2. Sélectionnez **Entreprise / RH**
3. Remplissez :
   - **Étape 1** :
     - Nom entreprise : `Test SARL`
     - SIRET : `12345678900012`
     - Nombre chauffeurs : `6-20`
   - **Étape 2** :
     - Prénom : `Jean`
     - Nom : `DUPONT`
     - Email : `jean.dupont@test.com`
     - Mot de passe : `Test1234!`
4. Créez le compte

### Test 2 : Vérifier l'Affichage

Une fois connecté, vérifiez :

#### Dans le Header (en haut à droite)
- ✅ Avatar avec initiales : **JD** (Jean DUPONT)
- ✅ Nom complet : **Jean DUPONT**
- ✅ Nom de l'entreprise sous le fil d'Ariane : **Test SARL**

#### Dans Paramètres (`/parametres`)
- ✅ Onglet "Entreprise" :
  - Nom de l'entreprise : **Test SARL**
  - SIRET : **12345678900012**

---

## 📋 Où Sont Stockées les Données ?

### Dans `auth.users.raw_user_meta_data` :
```json
{
  "first_name": "Jean",
  "last_name": "DUPONT",
  "user_type": "admin"
}
```

### Dans la table `companies` :
```sql
id                  | name       | siret          | driver_count
--------------------|------------|----------------|-------------
[UUID]              | Test SARL  | 12345678900012 | 6-20
```

### Dans la table `user_companies` (liaison) :
```sql
user_id    | company_id | role
-----------|------------|------
[USER_UUID]| [COMP_UUID]| admin
```

---

## 🔄 Push sur GitHub

Les modifications ont été apportées à :
1. ✅ `components/dashboard/header.tsx`
2. ✅ `app/parametres/page.tsx`

Pour pousser sur GitHub, il faut commit et push ces fichiers.

---

## ✅ Checklist de Vérification

- [ ] Header affiche le bon nom (Prénom + Nom)
- [ ] Header affiche les bonnes initiales (P + N)
- [ ] Header affiche le nom de l'entreprise sous le breadcrumb
- [ ] Page Paramètres affiche le nom de l'entreprise
- [ ] Page Paramètres affiche le SIRET
- [ ] Les données persistent après rafraîchissement

---

## 📝 Notes

### Champs Non Utilisés Actuellement

**Adresse de l'entreprise** :
- La colonne `address` n'existe pas dans la table `companies`
- Si vous voulez l'ajouter, exécutez :
  ```sql
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
  ```

**Téléphone de l'entreprise** :
- Même chose, ajoutez si nécessaire :
  ```sql
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
  ```

---

## 🎯 Résumé

**Avant** :
- ❌ Nom/Prénom non affichés
- ❌ Entreprise/SIRET non affichés

**Après** :
- ✅ Nom complet affiché (Prénom + Nom)
- ✅ Initiales correctes (P + N)
- ✅ Nom de l'entreprise affiché
- ✅ SIRET affiché dans les paramètres
- ✅ Toutes les données proviennent des bonnes sources

**Test maintenant en créant un nouveau compte !** 🚀
