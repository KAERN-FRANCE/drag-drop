# 🚨 Fix Rapide : Erreur RLS lors de l'ajout de chauffeur

## Erreur

```
Erreur lors de l'ajout du chauffeur: new row violates row-level security policy for table "drivers"
```

## ✅ Solution Rapide (1 minute)

### Étape 1 : Exécuter le Script de Correction

1. Allez sur **Supabase Dashboard**
2. Cliquez sur **SQL Editor**
3. Copiez et collez le contenu de **`FIX_DRIVERS_RLS_POLICY.sql`**
4. Cliquez sur **Run**

### Étape 2 : Vérifier le Résultat

Vous devriez voir :
```
✅ Anciennes politiques supprimées
✅ Nouvelle politique INSERT créée
✅ Toutes les politiques RLS mises à jour
✅ Vous êtes lié à l'entreprise: [UUID]
   Votre rôle: admin
✅ Vous pouvez ajouter des chauffeurs
🎉 Politiques RLS corrigées!
```

### Étape 3 : Tester l'Ajout

1. Retournez sur votre dashboard
2. Cliquez sur **"Ajouter un chauffeur"**
3. Remplissez les informations
4. Cliquez sur **Ajouter**

✅ **Ça devrait fonctionner maintenant !**

---

## 🔍 Qu'est-ce qui a été Corrigé ?

### Avant
```sql
-- Politique trop permissive avec company_id IS NULL
CREATE POLICY "Users can create drivers in their company"
  WITH CHECK (
    company_id IS NULL  -- ❌ Conflit avec notre code
    OR
    company_id IN (SELECT ...)
  );
```

### Après
```sql
-- Politique claire : seuls admin/manager de l'entreprise
CREATE POLICY "Admins and managers can create drivers"
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
```

---

## ❓ Pourquoi Cette Erreur ?

L'ancienne politique RLS avait une condition `company_id IS NULL` qui créait un conflit avec notre nouveau code qui passe toujours un `company_id` explicite.

La nouvelle politique :
- ✅ Vérifie que vous êtes admin ou manager
- ✅ Vérifie que le company_id correspond à votre entreprise
- ✅ Bloque les ajouts dans d'autres entreprises (sécurité)

---

## 🎯 Si Ça Ne Marche Toujours Pas

### Diagnostic : Vérifier Votre Rôle

```sql
SELECT * FROM get_user_company_info();
```

**Résultat attendu** :
- `role` : admin (ou manager)
- `is_linked` : true

Si votre rôle n'est pas `admin`, vous ne pouvez pas ajouter de chauffeurs.

### Diagnostic : Vérifier les Politiques

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'drivers'
ORDER BY cmd;
```

**Résultat attendu** :
```
Admins and managers can create drivers | INSERT
Admins can delete drivers              | DELETE
Users can view drivers from their company | SELECT
Admins and managers can update drivers | UPDATE
```

---

## 📝 Note Importante

Si vous réinstallez complètement la base avec `INSTALLATION_COMPLETE.sql`, la bonne politique sera automatiquement créée (j'ai mis à jour le fichier).

---

## ✅ Checklist Finale

- [ ] Script `FIX_DRIVERS_RLS_POLICY.sql` exécuté
- [ ] Message "🎉 Politiques RLS corrigées!" affiché
- [ ] Votre rôle est `admin` ou `manager`
- [ ] Vous pouvez ajouter un chauffeur sans erreur
- [ ] Le chauffeur apparaît dans la liste

**Tout fonctionne ? Parfait ! 🎉**
