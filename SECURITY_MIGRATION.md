# Migration de Sécurité Multi-Tenant

## ⚠️ IMPORTANT - Problème de Sécurité Critique

Actuellement, **toutes les entreprises peuvent voir les données de toutes les autres entreprises**. Cette migration corrige ce problème majeur en implémentant une isolation complète des données par entreprise.

## 🎯 Objectif

Cette migration ajoute :
- Une table `companies` pour gérer les entreprises
- Une table `user_companies` pour lier les utilisateurs aux entreprises
- Un système de Row Level Security (RLS) pour filtrer automatiquement les données
- Une isolation complète : chaque entreprise ne voit que ses propres données

## 📋 Étapes d'Application

### 1. Accéder à Supabase SQL Editor

1. Allez sur https://supabase.com
2. Ouvrez votre projet TachoCompliance
3. Allez dans **SQL Editor** (menu de gauche)

### 2. Exécuter le Script de Migration

1. Créez une nouvelle query
2. Copiez le contenu du fichier `supabase_multi_tenant.sql`
3. Cliquez sur **Run** pour exécuter le script

### 3. Vérifier que tout fonctionne

Après l'exécution, vous devriez avoir :
- ✅ Table `companies` créée
- ✅ Table `user_companies` créée
- ✅ Colonne `company_id` ajoutée à `drivers` et `infractions`
- ✅ Row Level Security (RLS) activé sur toutes les tables
- ✅ Politiques RLS configurées

## 🔍 Ce qui change

### Avant (❌ INSÉCURE)
```sql
-- Récupère TOUS les chauffeurs de TOUTES les entreprises
SELECT * FROM drivers;
```

### Après (✅ SÉCURISÉ)
```sql
-- Récupère UNIQUEMENT les chauffeurs de l'entreprise de l'utilisateur connecté
-- RLS filtre automatiquement !
SELECT * FROM drivers;
```

## 🧪 Tester l'Isolation

1. **Créer deux comptes entreprise** :
   - Créez un compte "Entreprise A"
   - Créez un compte "Entreprise B"

2. **Ajouter des chauffeurs** :
   - Sur le compte A, ajoutez des chauffeurs
   - Sur le compte B, ajoutez d'autres chauffeurs

3. **Vérifier l'isolation** :
   - Connectez-vous au compte A → vous ne voyez QUE les chauffeurs de A
   - Connectez-vous au compte B → vous ne voyez QUE les chauffeurs de B

## 🏗️ Architecture

```
auth.users (Supabase Auth)
    ↓
user_companies (liaison user ↔ company)
    ↓
companies (entreprises)
    ↓
drivers (chauffeurs)
    ↓
infractions (infractions)
```

## 📊 Row Level Security (RLS)

Le RLS est configuré pour :
- ✅ Les utilisateurs ne voient que les companies auxquelles ils appartiennent
- ✅ Les utilisateurs ne voient que les drivers de leur company
- ✅ Les utilisateurs ne voient que les infractions de leur company
- ✅ Seuls les admins peuvent créer/modifier/supprimer des drivers
- ✅ Filtrage automatique à chaque requête

## ⚡ Modifications Code

### Page d'inscription (`register/page.tsx`)
```typescript
// Maintenant, lors de l'inscription admin :
// 1. Crée l'utilisateur dans auth.users
// 2. Crée l'entreprise dans companies
// 3. Lie l'utilisateur à l'entreprise via user_companies
```

### Helper Company (`lib/company.ts`)
```typescript
// Nouvelles fonctions :
getUserCompanyId()  // Récupère le company_id de l'utilisateur
getUserRole()       // Récupère le rôle de l'utilisateur (admin/driver)
isUserAdmin()       // Vérifie si l'utilisateur est admin
```

### Composants Dashboard
Les composants (KPI, tables, charts) n'ont **pas besoin d'être modifiés** car :
- Le RLS filtre automatiquement les données au niveau de la base
- Pas besoin d'ajouter `.eq('company_id', ...)` dans les requêtes
- La sécurité est garantie même si un développeur oublie d'ajouter le filtre

## 🚨 Notes Importantes

1. **Données existantes** : Le script crée une "Entreprise Demo" et y assigne tous les chauffeurs existants

2. **Inscription chauffeur** : Pour le moment, l'inscription chauffeur est désactivée. Les chauffeurs doivent être invités par leur entreprise.

3. **Backup** : Avant d'exécuter le script, faites un backup de votre base de données Supabase (Settings → Database → Backups)

4. **Environnement** : Testez d'abord sur un environnement de développement avant de passer en production

## 🔗 Ressources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-tenancy Best Practices](https://supabase.com/docs/guides/auth/managing-user-data)

## ✅ Checklist Post-Migration

- [ ] Script `supabase_multi_tenant.sql` exécuté avec succès
- [ ] Aucune erreur dans Supabase SQL Editor
- [ ] Tables `companies` et `user_companies` visibles dans Table Editor
- [ ] RLS activé sur les tables (icône shield visible dans Table Editor)
- [ ] Test avec 2 comptes différents confirme l'isolation
- [ ] Code déployé sur Vercel
- [ ] Application testée en production

## 🆘 Support

Si vous rencontrez des erreurs lors de l'exécution :
1. Vérifiez les messages d'erreur dans SQL Editor
2. Vérifiez que les tables `drivers` et `infractions` existent déjà
3. Contactez le support si nécessaire
