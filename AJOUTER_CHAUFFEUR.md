# Comment Ajouter un Chauffeur

## 🚨 Correction du Problème RLS

Si vous avez l'erreur : `new row violates row-level security policy for table "drivers"`

### Étape 1 : Appliquer le Fix RLS

1. Allez sur https://supabase.com
2. Ouvrez votre projet TachoCompliance
3. Allez dans **SQL Editor**
4. Créez une nouvelle query
5. Copiez le contenu du fichier `fix_rls_policies.sql`
6. Cliquez sur **Run**

### Étape 2 : Vérifier votre Inscription

Exécutez cette requête dans SQL Editor :

```sql
SELECT * FROM check_user_registration();
```

Vous devriez voir :
- `has_company`: true
- `company_name`: Le nom de votre entreprise
- `role`: admin

Si `has_company` est `false`, c'est que votre compte n'est pas lié à une entreprise.

## 📝 Ajouter un Chauffeur (Temporaire - En attendant l'interface)

### Option 1 : Via SQL Editor (Recommandé)

Dans Supabase SQL Editor, exécutez :

```sql
INSERT INTO drivers (name, initials, score, status)
VALUES ('Jean DUPONT', 'JD', 100, 'active');
```

Le `company_id` sera **automatiquement défini** grâce au trigger.

### Option 2 : Via Table Editor

1. Allez dans **Table Editor** → `drivers`
2. Cliquez sur **Insert row**
3. Remplissez :
   - `name`: Jean DUPONT
   - `initials`: JD
   - `score`: 100
   - `status`: active
   - **Laissez `company_id` vide** (sera auto-rempli)
4. Cliquez sur **Save**

## 🔍 Vérifier que le Chauffeur est Bien Associé

```sql
SELECT
  d.id,
  d.name,
  d.company_id,
  c.name as company_name
FROM drivers d
LEFT JOIN companies c ON c.id = d.company_id
WHERE d.company_id IN (
  SELECT company_id FROM user_companies WHERE user_id = auth.uid()
);
```

Vous devriez voir votre chauffeur avec le bon `company_name`.

## ⚠️ Problèmes Courants

### 1. Erreur : "User is not associated with any company"

**Cause** : Votre compte n'est pas dans la table `user_companies`

**Solution** : Vérifiez avec :
```sql
SELECT * FROM user_companies WHERE user_id = auth.uid();
```

Si vide, il faut re-créer votre compte ou lier manuellement :
```sql
-- Trouver votre company_id
SELECT id, name FROM companies;

-- Lier votre user à la company (remplacez YOUR_COMPANY_ID)
INSERT INTO user_companies (user_id, company_id, role)
VALUES (auth.uid(), 'YOUR_COMPANY_ID', 'admin');
```

### 2. Je ne vois pas mes chauffeurs dans l'app

**Cause** : Les chauffeurs n'ont pas de `company_id` ou mauvais `company_id`

**Solution** : Vérifiez les company_id :
```sql
-- Voir les chauffeurs sans company
SELECT * FROM drivers WHERE company_id IS NULL;

-- Mettre à jour si nécessaire
UPDATE drivers
SET company_id = (SELECT company_id FROM user_companies WHERE user_id = auth.uid() LIMIT 1)
WHERE company_id IS NULL;
```

## 🎯 Prochaine Étape : Interface de Gestion

Une interface complète de gestion des chauffeurs sera créée prochainement avec :
- ✅ Ajout de chauffeur via formulaire
- ✅ Modification des informations
- ✅ Suppression de chauffeur
- ✅ Import en masse depuis CSV/Excel
- ✅ Génération automatique des codes chauffeur

Pour l'instant, utilisez les méthodes ci-dessus.

## 📞 Support

Si vous avez toujours l'erreur après avoir appliqué le fix :
1. Vérifiez que vous êtes bien connecté
2. Vérifiez que `fix_rls_policies.sql` a été exécuté sans erreur
3. Déconnectez-vous et reconnectez-vous
4. Réessayez d'ajouter un chauffeur
