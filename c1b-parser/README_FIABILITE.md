# ⚠️ AVERTISSEMENT — Fiabilité du système

## 🔴 STATUT ACTUEL : PROTOTYPE (65-70% FIABLE)

**CE SYSTÈME N'EST PAS CERTIFIÉ POUR UN USAGE LÉGAL.**

### Limitations critiques

1. **Parser non certifié** : tachoparser n'a pas de certification ERCA officielle
2. **Règles partiellement validées** : Seulement 1 fichier C1B testé
3. **Repos journalier (Art. 8.2)** : Logique complexe, **sur-détection probable**
4. **Pas d'audit externe** : Aucune validation par expert agréé

---

## ✅ Ce que tu PEUX faire avec ce système

### Usage recommandé (sans risque légal)

1. **Pré-analyse indicative**
   - Identifier les conducteurs à risque
   - Prioriser les contrôles manuels
   - Tendances sur la flotte

2. **Alertes préventives**
   - Notification avant dépassement
   - Formation des conducteurs
   - Sensibilisation interne

3. **Audit interne**
   - Comparer avec contrôles manuels
   - Valider la fiabilité du système
   - Amélioration continue

---

## ❌ Ce que tu NE DOIS PAS faire

### Usage interdit (risque légal élevé)

1. ❌ **Sanctions disciplinaires** basées uniquement sur ces résultats
2. ❌ **Amendes/pénalités** sans vérification manuelle
3. ❌ **Preuves devant tribunal** ou inspection du travail
4. ❌ **Décisions RH** (licenciement, avertissement)
5. ❌ **Facturation clients** basée sur ces données

---

## 🎯 Plan pour atteindre la fiabilité

### Étapes obligatoires avant usage légal

#### 1. Validation du parser (CRITIQUE)

```bash
# Tester avec 50 fichiers différents
for file in data/test_files/*.C1B; do
    ./bin/dddparser -card -input "$file" > output.json
    # Comparer avec outil certifié
done
```

**Critère de succès** : Écart < 1% avec outil certifié

#### 2. Correction Art. 8.2 (URGENT)

Le code actuel détecte **67% de jours en infraction** (35/52).
→ **Logique à refaire complètement**

Tests manuels nécessaires :
- 20 jours avec repos fragmentés
- 10 jours avec repos < 9h
- 5 jours avec repos ≥ 11h

#### 3. Tests exhaustifs

- [ ] 100+ tests automatisés
- [ ] 20 fichiers validés manuellement
- [ ] Comparaison avec 2 outils certifiés
- [ ] Tests sur Gen1, Gen2, Gen2v2

#### 4. Audit externe

- [ ] Validation par expert tachygraphe
- [ ] Revue juridique des règles
- [ ] Documentation complète

**DURÉE ESTIMÉE : 2-3 mois**

---

## 📋 Checklist avant utilisation

### Avant chaque analyse

- [ ] Fichier C1B vérifié (pas corrompu)
- [ ] Parsing réussi (pas d'erreur critique)
- [ ] Nom conducteur extrait (pas "Inconnu")
- [ ] Nombre d'activités cohérent (> 0)

### Après chaque analyse

- [ ] **Vérification manuelle obligatoire** des infractions MSI/VSI
- [ ] Comparaison avec historique conducteur
- [ ] Log de l'analyse conservé (traçabilité)
- [ ] Résultats revus par contrôleur qualifié

---

## 🔍 Comment vérifier la fiabilité

### Test de comparaison avec outil certifié

1. **Exporte les données** d'un outil certifié (TachoScan, VDO TIS-Web, etc.)
2. **Analyse le même fichier** avec ce système
3. **Compare les résultats** :

```python
# Script de comparaison (à créer)
python compare_with_certified.py \
    --our-results results.json \
    --certified-results certified.csv \
    --tolerance 0.01  # 1% d'écart max
```

**Critères de validation** :
- Temps de conduite journalier : écart < 5 min
- Nombre d'infractions : ±10% acceptable
- Classification gravité : 100% identique

### Validation manuelle sur 3 jours

```bash
python validate_manual.py
```

Compare calcul manuel vs code pour :
- 2025-09-26 : Conduite 9.2h (tolérance)
- 2025-10-13 : Pause 17min après 4.5h conduite
- 2025-09-19 : Repos 3.5h (insuffisant)

---

## 📞 Support et questions

### Avant de signaler un bug

1. ✅ Vérifie que le parsing a réussi (pas d'erreur)
2. ✅ Compare avec un calcul manuel
3. ✅ Lis l'analyse de risques (ANALYSE_RISQUES.md)

### Contact expert réglementaire

Pour validation juridique des règles :
- Chambre Syndicale du Déménagement
- FNTR (Fédération Nationale des Transports Routiers)
- Expert tachygraphe certifié

---

## 📄 Documents importants

- [AUDIT_FIABILITE.md](AUDIT_FIABILITE.md) — Bugs détectés et corrections
- [ANALYSE_RISQUES.md](ANALYSE_RISQUES.md) — Risques résiduels par composant
- [validate_manual.py](validate_manual.py) — Script de validation croisée

---

## ⚖️ Disclaimer légal

**EN UTILISANT CE SYSTÈME, TU RECONNAIS QUE :**

1. Il s'agit d'un **prototype non certifié**
2. Les résultats sont **indicatifs uniquement**
3. Une **vérification manuelle est obligatoire**
4. Aucune garantie de conformité réglementaire
5. L'auteur décline toute responsabilité en cas d'erreur

**VERSION : 0.1.0-alpha**
**DATE : 2026-02-09**
**FIABILITÉ : 65-70% (prototype)**
