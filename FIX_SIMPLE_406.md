# 🔧 Fix Simple - Erreur 406

## Le Problème

Votre compte existe dans Supabase, mais il n'est **pas lié à une entreprise** dans la table `user_companies`. C'est pour ça que vous avez l'erreur 406.

## ✅ Solution en 3 Étapes

### Étape 1 : Diagnostic

1. **Restez connecté** à votre application (ne vous déconnectez pas)
2. Allez sur **Supabase Dashboard** → **SQL Editor**
3. Copiez TOUT le contenu de **`REPAIR_ACCOUNT.sql`**
4. Cliquez sur **Run**

### Étape 2 : Lire les Résultats

Le script va afficher plusieurs sections. Regardez attentivement :

#### Si vous voyez :
```
❌ PROBLÈME IDENTIFIÉ: Votre compte n'est pas lié à une entreprise!

RÉPARATION SUGGÉRÉE:
INSERT INTO user_companies (user_id, company_id, role)
VALUES ('[UUID-1]', '[UUID-2]', 'admin');
```

**→ Copiez cette commande INSERT et exécutez-la dans le SQL Editor**

#### Si vous voyez :
```
✅ Vous êtes correctement lié à l'entreprise: [UUID]
🎉 TOUT EST OK!
```

**→ Rafraîchissez juste votre page et réessayez**

### Étape 3 : Tester

1. **Rafraîchissez votre page dashboard** (Ctrl+R)
2. Cliquez sur **"Ajouter un chauffeur"**
3. Utilisez un NOUVEL email : `pierre.nouveau@example.com`
4. Mot de passe : `Test1234!`
5. Cliquez sur **Ajouter**

✅ **Ça devrait fonctionner !**

---

## 🆘 Si Le Script Dit "Aucun utilisateur connecté"

Cela signifie que vous n'êtes pas connecté **pendant** que vous exécutez le script.

**Solution** :
1. Ouvrez 2 onglets :
   - **Onglet 1** : Votre application (dashboard) - restez connecté
   - **Onglet 2** : Supabase SQL Editor
2. Exécutez le script dans l'onglet 2
3. Le script détectera votre session de l'onglet 1

---

## 🔍 Alternative : Réparation Manuelle

Si le script ne fonctionne pas, voici comment réparer manuellement :

### 1. Trouver votre user_id

```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC;
```

Notez votre `id` (UUID).

### 2. Trouver le company_id

```sql
SELECT id, name FROM companies ORDER BY created_at DESC;
```

Notez l'`id` de votre entreprise (UUID).

### 3. Créer la liaison

```sql
INSERT INTO user_companies (user_id, company_id, role)
VALUES (
  '[VOTRE_USER_ID]',
  '[VOTRE_COMPANY_ID]',
  'admin'
);
```

Remplacez les UUIDs entre crochets par vos valeurs.

### 4. Vérifier

```sql
SELECT * FROM user_companies;
```

Vous devriez voir votre liaison.

---

## 🎯 Pourquoi Ce Problème ?

Votre compte a été créé, mais quelque chose a échoué lors de la création de la liaison `user_companies`. Cela peut arriver si :
- L'inscription a été interrompue
- Une erreur RLS a bloqué la création de la liaison
- La fonction `register_company_admin` a échoué

Une fois la liaison créée manuellement, tout fonctionnera normalement.

---

## ✅ Checklist Finale

- [ ] Script `REPAIR_ACCOUNT.sql` exécuté
- [ ] Commande INSERT copiée et exécutée (si suggérée)
- [ ] Verification : `SELECT * FROM user_companies;` montre votre liaison
- [ ] Page dashboard rafraîchie
- [ ] Test d'ajout de chauffeur avec un nouvel email
- [ ] Aucune erreur 406 !

**Tout fonctionne ? Parfait ! 🎉**
