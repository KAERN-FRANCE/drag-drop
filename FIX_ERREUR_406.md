# 🚨 Fix : Erreur 406 "Impossible de trouver votre entreprise"

## Problème Identifié

Les erreurs dans votre console :
1. **Erreur 406** : Les politiques RLS sur `user_companies` bloquent la lecture de vos propres données
2. **Erreur 403** : Les politiques RLS sur `drivers` bloquent l'insertion
3. **Erreur 422** : "User already registered" - l'email a déjà été utilisé (secondaire)

## ✅ Solution Complète (2 minutes)

### Étape 1 : Exécuter le Script de Fix

1. **Supabase Dashboard** → **SQL Editor**
2. Copiez TOUT le contenu de **`DIAGNOSTIC_ET_FIX_COMPLET.sql`**
3. Cliquez sur **Run**

### Étape 2 : Vérifier les Résultats

Vous devriez voir :
```
=== DIAGNOSTIC UTILISATEUR ===
✅ Utilisateur connecté: [votre email]

=== DIAGNOSTIC USER_COMPANIES ===
✅ Vous êtes lié à 1 entreprise(s)
   Entreprise: [nom de votre entreprise]
   Company ID: [UUID]
   Votre rôle: admin

✅ Politiques user_companies corrigées
✅ Politiques drivers corrigées
✅ Politiques companies corrigées

=== TEST FINAL ===
✅ Lecture user_companies OK
✅ Lecture companies OK
✅ Vous pouvez ajouter des chauffeurs (rôle: admin)

🎉 DIAGNOSTIC ET FIX TERMINÉS!
```

### Étape 3 : Rafraîchir et Tester

1. **Rafraîchissez votre page** (Ctrl+R ou Cmd+R)
2. Allez sur `/dashboard`
3. Cliquez sur **"Ajouter un chauffeur"**
4. Utilisez un **email différent** cette fois (l'ancien est déjà pris)
5. Remplissez :
   - Nom : `Pierre TEST`
   - Email : `pierre.test@example.com` ← **NOUVEAU EMAIL**
   - Mot de passe : `Test1234!`
6. Cliquez sur **Ajouter**

✅ **Ça devrait fonctionner maintenant !**

---

## 🔍 Qu'est-ce qui a été Corrigé ?

Le script a corrigé les politiques RLS sur 3 tables :

### 1. `user_companies` (Le problème principal)
```sql
-- Avant: Politique manquante ou incorrecte
-- Après: Politique claire
CREATE POLICY "Users can view their associations"
  ON user_companies FOR SELECT
  USING (user_id = auth.uid());
```
✅ Vous pouvez maintenant lire votre propre liaison entreprise

### 2. `drivers`
```sql
CREATE POLICY "Admins and managers can create drivers"
  ON drivers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
```
✅ Les admins/managers peuvent ajouter des chauffeurs

### 3. `companies`
Politiques SELECT et UPDATE corrigées pour permettre la lecture de votre entreprise.

---

## ❌ Si Ça Ne Marche Toujours Pas

### Problème : "Vous n'êtes lié à aucune entreprise"

Cela signifie que votre compte a été créé mais la liaison `user_companies` n'existe pas.

**Solution** : Réinscrire un nouveau compte ou réparer manuellement :

```sql
-- Trouver votre user_id
SELECT id, email FROM auth.users WHERE email = 'votre@email.com';

-- Vérifier les entreprises
SELECT * FROM companies;

-- Créer la liaison manuellement (remplacez les UUIDs)
INSERT INTO user_companies (user_id, company_id, role)
VALUES (
  '[VOTRE_USER_ID]',
  '[COMPANY_ID]',
  'admin'
);
```

### Problème : "User already registered"

L'email que vous essayez d'utiliser a déjà été pris.

**Solution** : Utilisez un email différent OU supprimez l'ancien compte :

```sql
-- Voir tous les utilisateurs
SELECT id, email, created_at FROM auth.users;

-- Supprimer un utilisateur (remplacez l'email)
DELETE FROM auth.users WHERE email = 'ancien@email.com';
```

---

## 🧪 Tests Après le Fix

### Test 1 : Vérifier Votre Compte

```sql
SELECT * FROM get_user_company_info();
```

**Résultat attendu** :
- `user_email` : votre email
- `company_name` : nom de votre entreprise
- `role` : admin
- `is_linked` : **true**

### Test 2 : Tester la Lecture

```sql
-- Doit retourner votre entreprise
SELECT * FROM user_companies WHERE user_id = auth.uid();

-- Doit retourner les données de votre entreprise
SELECT * FROM companies;
```

Si ces requêtes fonctionnent, vous pourrez ajouter des chauffeurs !

---

## 📋 Checklist de Résolution

- [ ] Script `DIAGNOSTIC_ET_FIX_COMPLET.sql` exécuté
- [ ] Tous les messages ✅ affichés (aucun ❌)
- [ ] TEST FINAL affiche "✅ Vous pouvez ajouter des chauffeurs"
- [ ] Page dashboard rafraîchie
- [ ] Utilisé un NOUVEL email pour le test
- [ ] Chauffeur ajouté sans erreur 406 ou 403

---

## 🎯 Résumé

**Avant** :
- ❌ Erreur 406 lors de la lecture de `user_companies`
- ❌ Erreur 403 lors de l'ajout de drivers
- ❌ Impossible d'ajouter des chauffeurs

**Après** :
- ✅ Politiques RLS corrigées sur toutes les tables
- ✅ Vous pouvez lire votre entreprise
- ✅ Vous pouvez ajouter des chauffeurs
- ✅ Tout fonctionne !

---

## 💡 Conseil

Pour éviter l'erreur "User already registered" lors des tests :
- Utilisez des emails de test avec +1, +2, etc. : `test+1@example.com`, `test+2@example.com`
- Gmail ignore la partie +X mais Supabase les considère comme différents
