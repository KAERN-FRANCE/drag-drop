# Audit de fiabilité — Plateforme d'analyse tachygraphique

## ⚠️ Points critiques à vérifier

### 1. **Parsing tachoparser (Go)**
- ✅ **Fiable** : Projet open source mature (https://github.com/traconiq/tachoparser)
- ✅ **Testé** : Parse correctement votre fichier C1B (1169 activités extraites)
- ⚠️ **Mais** : Quelques warnings "CHR mismatch" sur les certificats
  - **Impact** : Signature verification peut échouer, **mais le parsing des données fonctionne**
  - **Action** : Les données d'activités ne dépendent pas de la vérification de signature

### 2. **Normalisation JSON → Modèles Python**
- ⚠️ **PARTIELLEMENT TESTÉ** : Ajustements faits "à la volée" sur votre fichier réel
- ⚠️ **Risque** : La structure JSON varie selon Gen1/Gen2/Gen2v2
- ❌ **PROBLÈME MAJEUR** : Nom du conducteur = "Inconnu"
  - Le champ `card_holder_identification` n'a pas été trouvé dans la structure
  - **À vérifier manuellement** dans le JSON brut

### 3. **Règles 561/2006 — Logique métier**

#### Art. 6.1 — Conduite journalière
- ⚠️ **Logique complexe** : Tolérance 10h max 2x/semaine
- ❓ **Non vérifié** : Est-ce qu'on compte bien les jours > 9h par semaine calendaire (lundi-dimanche) ?
- ❓ **Cas limite** : Si un conducteur fait 9h01, est-ce compté comme "jour étendu" ?

#### Art. 6.2/6.3 — Conduite hebdo/bi-hebdo
- ✅ **Logique simple** : Somme des heures par semaine
- ⚠️ **Définition semaine** : On utilise lundi 00:00 → dimanche 23:59
  - **Est-ce conforme au règlement ?** → À vérifier avec un expert légal

#### Art. 7 — Pauses
- ⚠️ **Logique complexe** : Pause fractionnée 15+30 min
- ❓ **Non vérifié** : Est-ce que la pause fractionnée doit être 15min **puis** 30min dans cet ordre ?
- ❌ **PROBLÈME DÉTECTÉ** : Infraction avec "Excès: 0.0h" (ligne "Art. 6.1, 10.0h conduite")
  - **Excès = 0** ne devrait **pas** être une infraction !

#### Art. 8.2 — Repos journalier
- ⚠️ **Logique TRÈS complexe** : Repos sur 24h glissantes vs repos qualifiants
- ❌ **PROBLÈME MAJEUR** : Le code détecte 35 infractions de repos journalier
  - **Trop élevé** — Possible sur-détection
  - **À vérifier manuellement** : Prendre 2-3 dates et recalculer à la main

#### Art. 8.6 — Repos hebdomadaire
- ⚠️ **Logique complexe** : 6 périodes de 24h max sans repos hebdo
- ❓ **Non testé** : Compensation des repos réduits (3ème semaine)

### 4. **Classification de gravité (Directive 2009/5/CE)**
- ✅ **Seuils corrects** : Vérifiés contre la directive
- ✅ **Tests unitaires** : 40 tests passent
- ⚠️ **Mais** : Tests sur données **mockées**, pas réelles

### 5. **Base de données & API**
- ✅ **Code standard** : FastAPI + SQLite
- ⚠️ **Pas de validation** : Aucun test end-to-end sur l'API
- ❌ **Pas de logs** : Impossible de tracer les erreurs en production

---

## 🚨 **Problèmes critiques détectés**

### 1. Infraction avec excès = 0.0h
```
📅 2025-10-01 — Art. 6.1 (MI)
Temps de conduite journalier
Valeur: 10.0h | Limite: 10.0h | Excès: 0.0h
```
**Cause** : Bug dans `check_daily_driving` — détecte 10.0h pile comme infraction
**Impact** : Faux positifs
**Correction** : Vérifier la condition `if minutes > 10.0 * 60` (doit être `>=` ou `>` ?)

### 2. Infraction de pause avec excès = 0.0h
```
📅 2025-10-13 — Art. 7 (SI)
Pause insuffisante après 4h30 de conduite
Valeur: 4.5h | Limite: 4.5h | Excès: 0.0h
```
**Cause** : La limite est atteinte exactement mais signalée comme infraction
**Impact** : Faux positif
**Correction** : Vérifier la condition dans `check_breaks`

### 3. Repos journaliers — Sur-détection probable
35 infractions sur 52 jours = **67% des jours en infraction**
**Causes possibles** :
- Mauvaise définition de "période de 24h"
- Repos fragmentés non fusionnés correctement
- Confusion entre repos qualifiants et non-qualifiants

---

## ✅ **Actions correctives immédiates**

### A. Corriger les seuils stricts
- **Art. 6.1** : `if minutes > 10.0 * 60` → Vérifier si c'est bien `>` et pas `>=`
- **Art. 7** : `if cumulative_driving_minutes > MAX_DRIVING_BEFORE_BREAK` → Vérifier seuil

### B. Ajouter des logs de debug
- Logger chaque infraction détectée avec contexte complet
- Permettre de re-jouer l'analyse sur un jour précis

### C. Validation manuelle croisée
**Test** : Prendre 3 jours du fichier C1B et recalculer **à la main** :
1. Temps de conduite journalier
2. Repos pris
3. Pauses
4. Comparer avec les infractions détectées par le code

### D. Tests avec d'autres fichiers
- Tester avec au moins 5 fichiers C1B différents
- Tester des cartes Gen1, Gen2, Gen2v2
- Vérifier que le nom du conducteur est bien extrait

### E. Consulter un expert
- **Juridique** : Vérifier l'interprétation des articles 561/2006
- **Technique** : Faire valider par quelqu'un qui connaît les tachygraphes

---

## 🎯 **Recommandations**

### Court terme (avant production)
1. ❌ **NE PAS utiliser** pour des décisions légales/sanctions
2. ✅ **Utiliser** uniquement comme outil d'**alerte préventive**
3. ✅ Ajouter un disclaimer : "Analyse automatique à vérifier manuellement"

### Moyen terme
1. Ajouter un mode "audit trail" : export JSON complet de chaque analyse
2. Implémenter des tests de régression avec vrais fichiers C1B
3. Comparer les résultats avec d'autres outils du marché

### Long terme
1. Certification par un organisme agréé
2. Tests sur des milliers de fichiers réels
3. Interface de validation manuelle pour les contrôleurs

---

## 📊 **Niveau de confiance actuel**

| Composant | Confiance | Justification |
|-----------|-----------|---------------|
| Parsing tachoparser | 85% | Projet mature, parse correctement |
| Normalisation JSON | 60% | Ajustements ad-hoc, nom manquant |
| Art. 6.1-6.3 (conduite) | 70% | Logique simple, mais bugs détectés |
| Art. 7 (pauses) | 50% | Logique complexe, faux positif |
| Art. 8.2 (repos journalier) | 40% | Sur-détection probable |
| Art. 8.6 (repos hebdo) | 60% | Peu testé |
| Classification gravité | 90% | Seuils corrects, bien testés |
| API/Base de données | 80% | Code standard, pas de tests |

**Niveau global : 65%** — Prototype fonctionnel mais **PAS prêt pour production légale**
