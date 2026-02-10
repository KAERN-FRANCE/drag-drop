# Plateforme d'analyse d'infractions tachygraphiques

## ⚠️ AVERTISSEMENT CRITIQUE

**CE SYSTÈME EST UN PROTOTYPE NON CERTIFIÉ (65-70% FIABLE)**

❌ **NE PAS UTILISER pour :**
- Sanctions disciplinaires
- Amendes ou pénalités
- Preuves juridiques

✅ **Utilisable uniquement pour :**
- Pré-analyse indicative
- Alertes préventives internes
- Formation conducteurs

**📄 LIRE IMPÉRATIVEMENT : [README_FIABILITE.md](README_FIABILITE.md)**

---

## 🎯 Objectif

Analyser automatiquement les fichiers chronotachygraphiques (C1B, DDD, V1B) et détecter les infractions au Règlement (CE) 561/2006.

### Règles implémentées

- ✅ Art. 6.1 : Temps de conduite journalier (9h/10h)
- ✅ Art. 6.2 : Temps de conduite hebdomadaire (56h)
- ✅ Art. 6.3 : Temps de conduite bi-hebdomadaire (90h)
- ✅ Art. 7 : Pauses obligatoires (45min après 4h30)
- ⚠️ Art. 8.2 : Repos journalier (11h/9h) — **FIABILITÉ 50%**
- ⚠️ Art. 8.6 : Repos hebdomadaire (45h/24h) — **FIABILITÉ 60%**

Classification de gravité selon Directive 2009/5/CE : MI, SI, VSI, MSI

---

## 📦 Installation

### Prérequis

- Go 1.22+ (pour tachoparser)
- Python 3.9+
- macOS / Linux

### Installation rapide

```bash
cd tachograph-analyzer

# Installer dépendances Python
pip3 install -r requirements.txt

# Le binaire dddparser est déjà compilé dans bin/
# Si besoin de recompiler :
cd vendor/tachoparser/cmd/dddparser && go build -o ../../../../bin/dddparser .
```

---

## 🚀 Usage

### 1. Analyser un fichier C1B

```bash
cd tachograph-analyzer
PYTHONPATH=. python3 test_real_file.py
```

**Sortie** : Analyse complète avec infractions détectées

### 2. Validation manuelle (OBLIGATOIRE)

```bash
PYTHONPATH=. python3 validate_manual.py
```

Compare calcul manuel vs code sur 3 jours critiques.

### 3. Lancer l'API

```bash
PYTHONPATH=. uvicorn api.main:app --reload --port 8000
```

**Endpoints** :
- `POST /upload` : Analyse d'un fichier C1B/DDD
- `GET /infringements/{driver_id}` : Infractions d'un conducteur
- `GET /infringements/summary` : Résumé global
- `GET /report/{driver_id}/pdf` : Rapport PDF

### 4. Tests unitaires

```bash
PYTHONPATH=. python3 -m pytest tests/ -v
```

**Résultat** : 40 tests (tous passent sur données mockées)

---

## 📊 Résultats sur fichier réel

### Fichier testé : F__100000065087102512031111.C1B

**Conducteur** : FLORIAN PIERRE NIGI
**Carte** : 1000000650871003
**Période** : 52 jours (sept-oct 2025)
**Activités** : 1169 (484 conduite, 455 repos, 230 travail)

**Infractions détectées** :
- **Total** : 46 infractions
- **MSI** : 4 (très graves)
- **VSI** : 2 (graves)
- **SI** : 25 (sérieuses)
- **MI** : 15 (mineures)

**Par article** :
- Art. 8.2 (repos journalier) : 35 ← **Sur-détection probable**
- Art. 6.1 (conduite journalière) : 5
- Art. 6.3 (conduite bi-hebdo) : 4
- Art. 8.6 (repos hebdo) : 1
- Art. 7 (pauses) : 1

---

## ⚠️ Problèmes connus

### Critiques

1. **tachoparser non certifié** : Aucune garantie officielle ERCA
2. **Art. 8.2 sur-détecte** : 67% des jours en infraction (trop élevé)
3. **Testé sur 1 seul fichier** : Manque validation exhaustive

### Mineurs

1. **Affichage excès arrondis** : 0.03h peut prêter à confusion
2. **Pas de gestion multi-conducteurs VU** : Implémenté mais non testé
3. **Fuseaux horaires** : Assumés UTC

**📄 Détails : [AUDIT_FIABILITE.md](AUDIT_FIABILITE.md)**

---

## 🔍 Comment vérifier la fiabilité

### Étape 1 : Comparer avec outil certifié

```bash
# 1. Analyse le même fichier C1B avec TachoScan/VDO
# 2. Exporte en CSV : date,conducteur,carte,conduite_h,repos_h,infractions
# 3. Compare
python3 compare_with_certified.py \
    --our-file results.json \
    --certified-file tachoscan_export.csv \
    --tolerance 0.05
```

**Critère de succès** : Écart < 5%

### Étape 2 : Validation manuelle

```bash
python3 validate_manual.py
```

Vérifie manuellement 3 jours critiques.

**📄 Procédure complète : [VERIFIER_PARSER.md](VERIFIER_PARSER.md)**

---

## 📋 Plan pour atteindre 100% de fiabilité

### Phase 1 : Validation parser (2 semaines)
- [ ] Tester sur 50 fichiers C1B différents
- [ ] Comparer avec outil certifié (écart < 1%)
- [ ] Tester Gen1, Gen2, Gen2v2
- [ ] Tester cartes multi-pays

### Phase 2 : Refonte Art. 8.2 (1 semaine)
- [ ] Réécrire logique repos journalier
- [ ] 20 cas de test manuels
- [ ] Validation croisée

### Phase 3 : Tests exhaustifs (2 semaines)
- [ ] 100+ tests automatisés
- [ ] 20 fichiers validés manuellement
- [ ] Comparaison avec 2 outils certifiés

### Phase 4 : Audit externe (1-2 semaines)
- [ ] Validation par expert tachygraphe agréé
- [ ] Revue juridique des règles
- [ ] Documentation complète

**DURÉE TOTALE : 2-3 mois pour 95% de fiabilité**

**📄 Plan complet : [ANALYSE_RISQUES.md](ANALYSE_RISQUES.md)**

---

## 📁 Structure du projet

```
tachograph-analyzer/
├── bin/dddparser                     # Binaire Go compilé
├── parser/
│   ├── tacho_parser.py               # Wrapper subprocess
│   └── json_normalizer.py            # JSON → Pydantic
├── engine/
│   ├── infringement_engine.py        # Moteur principal
│   ├── severity.py                   # Classification MI/SI/VSI/MSI
│   └── rules/
│       ├── driving_time.py           # Art. 6.1, 6.2, 6.3
│       ├── breaks.py                 # Art. 7
│       ├── daily_rest.py             # Art. 8.2
│       └── weekly_rest.py            # Art. 8.6
├── models/
│   ├── activity.py                   # DriverActivity, Activity
│   └── infringement.py               # Infringement, Severity
├── database/
│   └── db.py                         # SQLite
├── api/
│   ├── main.py                       # FastAPI app
│   └── routes/
│       ├── upload.py                 # POST /upload
│       ├── infringements.py          # GET /infringements
│       └── reports.py                # GET /report (PDF)
├── tests/                            # 40 tests unitaires
├── test_real_file.py                 # Test sur fichier réel
├── validate_manual.py                # Validation croisée
├── compare_with_certified.py         # Comparaison outil certifié
├── README_FIABILITE.md               # ⚠️ LIRE EN PREMIER
├── AUDIT_FIABILITE.md                # Bugs et corrections
├── ANALYSE_RISQUES.md                # Risques par composant
└── VERIFIER_PARSER.md                # Procédure validation
```

---

## 🤝 Contribution

Ce projet est un **prototype** nécessitant :
- ✅ Validation sur davantage de fichiers
- ✅ Refonte de l'Art. 8.2
- ✅ Certification par expert

**Pull requests bienvenues** pour :
- Tests unitaires additionnels
- Corrections de bugs
- Documentation

---

## 📄 Licence

Code sous licence MIT (à définir avec l'auteur).

**tachoparser** : Voir https://github.com/traconiq/tachoparser

---

## ⚖️ Disclaimer légal

**EN UTILISANT CE SYSTÈME, VOUS RECONNAISSEZ QUE :**

1. Il s'agit d'un prototype non certifié
2. Les résultats sont indicatifs uniquement
3. Une vérification manuelle est OBLIGATOIRE
4. Aucune garantie de conformité réglementaire
5. L'auteur décline toute responsabilité en cas d'erreur

**NE PAS UTILISER pour sanctions légales.**

---

## 📞 Contact & Support

### Questions techniques
- Ouvrir une issue GitHub
- Consulter [VERIFIER_PARSER.md](VERIFIER_PARSER.md)

### Validation réglementaire
- Chambre Syndicale du Déménagement
- FNTR (Fédération Nationale des Transports Routiers)
- Expert tachygraphe certifié

---

**VERSION : 0.1.0-alpha**
**DATE : 2026-02-09**
**STATUT : Prototype (65-70% fiable)**
