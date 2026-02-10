# 🚗 Guide - Accès Espace Chauffeur

## Le Problème

Quand un chauffeur se connecte sur `/chauffeur`, il ne voit rien car les politiques RLS ne permettent pas aux chauffeurs de voir leurs propres données.

## 📋 Différence Admin vs Chauffeur

### 🏢 Admin/Manager (Espace Entreprise)
- Voient **TOUS** les chauffeurs de leur entreprise
- Peuvent ajouter/modifier/supprimer des chauffeurs
- Voient toutes les infractions et analyses de l'entreprise

### 👤 Chauffeur (Espace Chauffeur)
- Voient **UNIQUEMENT** leur propre profil
- Voient leurs propres infractions
- Voient leurs propres analyses
- Ne voient PAS les autres chauffeurs

---

## ✅ Solution (1 minute)

### Exécutez le Script

1. **Connectez-vous en tant que chauffeur** (gardez l'onglet `/chauffeur` ouvert)
2. Ouvrez **Supabase SQL Editor** (nouvel onglet)
3. Copiez TOUT le contenu de **`FIX_CHAUFFEUR_ACCESS.sql`**
4. Cliquez sur **Run**

### Résultat Attendu

```
✅ Connecté en tant que: [email du chauffeur]
✅ Vous êtes un chauffeur:
   Nom: [nom]
   ID: [id]

✅ Les chauffeurs peuvent voir leur propre profil
✅ Les chauffeurs peuvent modifier leur propre profil
✅ Les chauffeurs peuvent voir leurs propres infractions
✅ Les chauffeurs peuvent voir leurs propres analyses

=== TEST ACCÈS CHAUFFEUR ===
✅ Vous êtes le chauffeur ID: X
✅ Vous pouvez voir votre profil
✅ Vous pouvez voir X infraction(s)
✅ Vous pouvez voir X analyse(s)

🎉 ACCÈS CHAUFFEUR CONFIGURÉ!
```

### Dernière Étape

**Rafraîchissez la page `/chauffeur`** (Ctrl+R)

✅ **Vous devriez voir votre profil et vos données !**

---

## 🔍 Ce Que Le Script Fait

Le script ajoute des politiques RLS spéciales pour les chauffeurs :

### 1. Profil Chauffeur (drivers)
```sql
-- Un chauffeur peut voir SON profil
USING (user_id = auth.uid())
```

### 2. Infractions (infractions)
```sql
-- Un chauffeur voit SES infractions
USING (
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  )
)
```

### 3. Analyses (analyses)
```sql
-- Un chauffeur voit SES analyses
USING (
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  )
)
```

---

## 🧪 Tests Après le Fix

### Test 1 : Connexion Chauffeur

1. Allez sur `/login`
2. Sélectionnez **Mode Chauffeur**
3. Connectez-vous avec l'email du chauffeur créé
4. Vous devez être redirigé vers `/chauffeur`
5. Vous devez voir :
   - ✅ Votre nom et initiales
   - ✅ Votre score
   - ✅ Vos statistiques du mois
   - ✅ Vos infractions (si vous en avez)

### Test 2 : Isolation des Données

En tant que chauffeur :
- ❌ Vous ne devez PAS voir les autres chauffeurs
- ❌ Vous ne devez PAS voir les infractions des autres
- ✅ Vous voyez UNIQUEMENT vos propres données

### Test 3 : Navigation

Pages accessibles au chauffeur :
- `/chauffeur` - Dashboard personnel
- `/chauffeur/profil` - Votre profil
- `/chauffeur/infractions` - Vos infractions
- `/chauffeur/analyses` - Vos analyses
- `/chauffeur/calendrier` - Votre calendrier
- `/chauffeur/parametres` - Vos paramètres

---

## 🏢 Retour à l'Espace Admin

Pour tester l'espace admin après avoir configuré les chauffeurs :

1. Déconnectez-vous du compte chauffeur
2. Reconnectez-vous avec votre compte admin
3. Allez sur `/dashboard`
4. Vous devez voir **TOUS** les chauffeurs de votre entreprise

---

## ❓ Questions Fréquentes

**Q : Un chauffeur peut-il voir les autres chauffeurs ?**
R : Non, chaque chauffeur voit uniquement ses propres données.

**Q : Un admin peut-il voir les données des chauffeurs ?**
R : Oui, un admin voit tous les chauffeurs et toutes les données de son entreprise.

**Q : Comment un chauffeur peut-il modifier son profil ?**
R : Via la page `/chauffeur/profil`. La politique RLS permet aux chauffeurs de modifier leur propre profil.

**Q : Si je crée un nouveau chauffeur, fonctionnera-t-il immédiatement ?**
R : Oui, une fois les politiques configurées, tous les nouveaux chauffeurs créés pourront se connecter et voir leurs données.

**Q : Qu'est-ce qui lie un chauffeur à son compte ?**
R : La colonne `user_id` dans la table `drivers`. Quand vous créez un chauffeur, on crée d'abord son compte auth, puis on lie le driver à ce compte via `user_id`.

---

## 📊 Architecture Multi-Utilisateur

```
┌─────────────────────────────────────────┐
│          Base de Données                │
├─────────────────────────────────────────┤
│                                         │
│  🏢 Entreprise A                        │
│  ├── 👤 Admin A                         │
│  │   └── Voit tous les chauffeurs A     │
│  ├── 🚗 Chauffeur A1                    │
│  │   └── Voit ses propres données       │
│  └── 🚗 Chauffeur A2                    │
│      └── Voit ses propres données       │
│                                         │
│  🏢 Entreprise B                        │
│  ├── 👤 Admin B                         │
│  │   └── Voit tous les chauffeurs B     │
│  └── 🚗 Chauffeur B1                    │
│      └── Voit ses propres données       │
│                                         │
└─────────────────────────────────────────┘

Isolation complète :
❌ Admin A ne voit pas Entreprise B
❌ Chauffeur A1 ne voit pas Chauffeur A2
❌ Chauffeur B1 ne voit pas Entreprise A
```

---

## ✅ Checklist Finale

- [ ] Script `FIX_CHAUFFEUR_ACCESS.sql` exécuté
- [ ] Messages ✅ affichés
- [ ] Test réussi pour le chauffeur connecté
- [ ] Page `/chauffeur` rafraîchie
- [ ] Profil chauffeur visible
- [ ] Statistiques affichées
- [ ] Navigation fonctionnelle

**Tout fonctionne ? Parfait ! 🎉**

---

## 🔄 Pour de Futures Installations

Si vous réinstallez la base, après avoir exécuté :
1. `RESET_AUTH_COMPLET.sql`
2. `RESET_COMPLET_V2.sql`
3. `INSTALLATION_COMPLETE.sql`

N'oubliez pas d'exécuter aussi :
4. **`FIX_CHAUFFEUR_ACCESS.sql`** pour les politiques chauffeurs

(Je vais mettre à jour `INSTALLATION_COMPLETE.sql` pour inclure ces politiques automatiquement)
