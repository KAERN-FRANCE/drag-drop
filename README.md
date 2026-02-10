# 🚛 TachoCompliance - Système de Conformité Tachygraphe

Application SaaS de gestion et d'analyse de conformité des fichiers tachygraphes pour les entreprises de transport, conforme au Règlement CE 561/2006.

## 🎯 Fonctionnalités principales

### 📤 Upload et Analyse
- Upload drag-and-drop de fichiers Excel/CSV
- Validation automatique du format (max 30MB)
- Parsing intelligent des données tachygraphes
- Correction automatique des transitions d'années

### ⚠️ Détection des Infractions
Algorithme de détection conforme au **Règlement CE 561/2006** :

1. **Conduite journalière > 9h** (extension 10h max 2×/semaine)
2. **Conduite journalière > 10h trop fréquente**
3. **Repos journalier < 11h** (réduction 9h max 3×/semaine)
4. **Amplitude > 12h** (extension 14h sous conditions)
5. **Conduite hebdomadaire > 56h**
6. **Repos hebdomadaire < 45h**
7. **Conduite 2 semaines > 90h**

**Gravités** : délit, 5ème classe, 4ème classe, 3ème classe
**Amendes** : 135€ à 30,000€ par infraction

### 📊 Dashboards

**Dashboard Admin :**
- KPIs en temps réel (chauffeurs, analyses, score moyen, infractions critiques)
- Graphiques d'évolution mensuelle
- Répartition par gravité
- Top 10 des infractions
- Gestion des chauffeurs

**Dashboard Chauffeur :**
- Score personnel de conformité (0-100)
- Comparaison avec la moyenne entreprise
- Répartition du temps (conduite/repos/amplitude)
- Objectifs et progression
- Historique des analyses

### 📈 Analyses Détaillées

4 onglets pour chaque analyse :
- **Aperçu** : Statistiques globales, graphiques, coûts potentiels
- **Quotidien** : Détail jour par jour avec métriques
- **Hebdomadaire** : Agrégations par semaine
- **Recommandations** : Conseils personnalisés

## 🛠️ Stack Technique

- **Framework** : Next.js 16.0.3 (App Router)
- **Language** : TypeScript 5
- **UI** : Tailwind CSS 4 + shadcn/ui (50+ composants)
- **Database** : Supabase (PostgreSQL + Auth)
- **Charts** : Recharts
- **File Parsing** : XLSX
- **Package Manager** : pnpm
- **Hosting** : Vercel

## 📦 Installation

```bash
# Cloner le repository
git clone https://github.com/Bl4ckMaaamba/SOGESTMATIC-DRAG-AND-DROP2.git
cd SOGESTMATIC-DRAG-AND-DROP2

# Installer les dépendances
pnpm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés Supabase

# Lancer le serveur de développement
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 🗄️ Configuration Base de Données

### Schéma Supabase

Exécuter les scripts SQL dans cet ordre :

1. **`supabase_schema.sql`** - Tables principales
2. **`add_analysis_id.sql`** - Ajout de la colonne `analysis_id` aux infractions

### Tables

```sql
drivers (
  id, name, initials, score, status, created_at, updated_at
)

analyses (
  id, driver_id, period_start, period_end, upload_date, score, status, created_at
)

infractions (
  id, driver_id, analysis_id, type, date, severity, created_at
)
```

## 🔐 Variables d'Environnement

Créer un fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 🚀 Déploiement

### Vercel (recommandé)

```bash
# Connexion à Vercel
vercel login

# Déploiement
vercel

# Production
vercel --prod
```

### Configuration Vercel

Ajouter les variables d'environnement dans les paramètres du projet :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📁 Structure du Projet

```
├── app/                      # Next.js App Router
│   ├── (auth)/              # Pages d'authentification
│   ├── (marketing)/         # Pages marketing
│   ├── dashboard/           # Dashboard admin
│   ├── upload/              # Upload de fichiers
│   ├── analyses/            # Gestion des analyses
│   ├── chauffeurs/          # Gestion des chauffeurs (admin)
│   └── chauffeur/           # Espace chauffeur
├── components/
│   ├── ui/                  # Composants UI (50+)
│   ├── dashboard/           # Composants dashboard
│   ├── analysis/            # Composants d'analyse
│   └── drivers/             # Composants chauffeurs
├── lib/
│   ├── analyse-infractions.ts  # Algorithme de détection (517 lignes)
│   ├── file-parser.ts          # Parsing Excel/CSV
│   ├── date-corrections.ts     # Correction des dates
│   └── supabase.ts             # Client Supabase
├── types/
│   └── index.ts             # Types TypeScript
└── public/                  # Assets statiques
```

## 🧪 Développement

```bash
# Lancer le serveur
pnpm dev

# Build production
pnpm build

# Lancer en production
pnpm start

# Linter
pnpm lint
```

## 📝 Format des Fichiers Tachygraphe

Les fichiers Excel/CSV doivent contenir ces colonnes :

| Colonne | Format | Description |
|---------|--------|-------------|
| Date | `Lun. 30 Sept. 2024` | Date de l'activité |
| Conduite | `09:30` | Temps de conduite (HH:MM) |
| R.Journ | `11:00` | Repos journalier (HH:MM) |
| Amplitude | `12:00` | Amplitude de travail (HH:MM) |
| Distance | `450` | Distance parcourue (km) |
| R. Hebdo | `45:00` | Repos hebdomadaire (HH:MM) |

**Types de lignes supportés** :
- Journée (ex: `Lun. 30 Sept. 2024`)
- Semaine (ex: `Semaine 40 2024`)

**Lignes ignorées** : TOTAL, Quadrimestre, Semestre, Année

## 🎨 Composants UI

L'application utilise **shadcn/ui** avec plus de 50 composants :
- Forms (Input, Select, Checkbox, Radio, Switch, Slider...)
- Layout (Card, Tabs, Accordion, Separator...)
- Feedback (Alert, Toast, Progress, Skeleton...)
- Data (Table, Chart, Badge, Avatar...)
- Navigation (Dropdown, Context Menu, Command Palette...)

## 📊 Calcul du Score

```
Score de base = (Jours conformes / Total jours) × 100

Pénalités :
- Délit : -5 points
- 5ème classe : -2 points
- 4ème classe : -1 point

Score final = Max(0, Min(100, score avec pénalités))
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Propriétaire - Tous droits réservés

## 👥 Auteurs

Développé avec [Claude Code](https://claude.com/claude-code)

## 🐛 Support

Pour signaler un bug ou demander une fonctionnalité, ouvrir une issue sur GitHub.

---

**Made with ❤️ for transport compliance**
