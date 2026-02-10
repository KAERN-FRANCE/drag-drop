# Analyse de risques — Fiabilité à 100%

## 🎯 Objectif : Fiabilité réglementaire absolue

Pour atteindre **100% de fiabilité** dans un contexte légal, il faut :

1. ✅ **Parser certifié** — Validation officielle ERCA
2. ✅ **Tests exhaustifs** — Milliers de fichiers réels testés
3. ✅ **Validation croisée** — Comparaison avec outils certifiés
4. ✅ **Audit indépendant** — Expert tachygraphe agréé
5. ✅ **Documentation légale** — Traçabilité complète des règles
6. ✅ **Maintenance garantie** — Mises à jour réglementaires

---

## 🔍 État actuel du projet

### Composant 1 : tachoparser (Go)

**Statut** : ⚠️ **NON CERTIFIÉ**

| Critère | État | Détails |
|---------|------|---------|
| Certification ERCA | ❌ | Aucune certification officielle visible |
| Open source | ✅ | Code accessible, vérifiable |
| Tests unitaires | ⚠️ | Non documentés dans le repo |
| Parsing Gen1 | ✅ | Fonctionne sur votre fichier |
| Parsing Gen2 | ⚠️ | Erreur ASN.1 sur certificat |
| Vérification signature | ❌ | Warnings CHR mismatch |
| Maintenance | ⚠️ | Dernière maj GitHub à vérifier |

**Risques identifiés** :
1. **Parsing incorrect** : Si tachoparser a un bug, toutes les analyses sont fausses
2. **Formats non supportés** : Gen2v2, futurs formats
3. **Données corrompues** : Pas de validation d'intégrité cryptographique
4. **Évolution réglementaire** : Changements 2016/799 non répercutés

**Mitigation** :
- ✅ Comparer avec un outil certifié du marché (TachoScan, VDO TIS-Web, etc.)
- ✅ Tester sur 50+ fichiers différents (Gen1, Gen2, pays différents)
- ⚠️ Contacter traconiq pour confirmation de la fiabilité

---

### Composant 2 : Normalisation JSON (Python)

**Statut** : ⚠️ **AJUSTEMENTS AD-HOC**

| Critère | État | Détails |
|---------|------|---------|
| Structure JSON documentée | ❌ | Adapté "à la volée" sur 1 fichier |
| Gestion Gen1/Gen2/Gen2v2 | ⚠️ | Non testé exhaustivement |
| Nom conducteur | ✅ | Corrigé (testé sur 1 fichier) |
| Activités décodées | ✅ | `decoded_activity_daily_records` |
| Gestion erreurs | ⚠️ | Pas de validation des champs |
| Fuseaux horaires | ⚠️ | Non vérifié (UTC assumé) |

**Risques identifiés** :
1. **Variabilité du JSON** : Structure peut changer selon émetteur/version
2. **Champs manquants** : Code assume que tous les champs existent
3. **Timestamps mal interprétés** : Fuseaux, DST, epoch vs ISO
4. **Activités fragmentées** : Activités chevauchant minuit mal gérées

**Mitigation** :
- ❌ Ajouter validation Pydantic stricte (reject si champs manquants)
- ❌ Tester avec cartes de différents pays (FR, DE, ES, PL...)
- ❌ Logger toutes les données brutes pour audit

---

### Composant 3 : Règles 561/2006 (Moteur d'analyse)

**Statut** : ⚠️ **IMPLÉMENTATION MAISON**

| Article | Complexité | Tests | Validation manuelle | Fiabilité |
|---------|------------|-------|---------------------|-----------|
| Art. 6.1 | ⭐⭐⭐ | ✅ 5 tests | ✅ Vérifié | 85% |
| Art. 6.2 | ⭐⭐ | ✅ 2 tests | ⚠️ Non vérifié | 80% |
| Art. 6.3 | ⭐⭐ | ✅ 2 tests | ⚠️ Non vérifié | 80% |
| Art. 7 | ⭐⭐⭐⭐ | ✅ 6 tests | ✅ Vérifié | 75% |
| Art. 8.2 | ⭐⭐⭐⭐⭐ | ✅ 3 tests | ⚠️ Partiel | **50%** ⚠️ |
| Art. 8.6 | ⭐⭐⭐⭐ | ✅ 3 tests | ⚠️ Non vérifié | 60% |

**Risques critiques identifiés** :

#### Art. 8.2 — Repos journalier (FIABILITÉ 50%)
**Problèmes détectés** :
1. **Sur-détection probable** : 35 infractions sur 52 jours (67%)
2. **Logique complexe** : Repos sur 24h glissantes mal implémentée
3. **Repos fragmentés** : Fusion de repos consécutifs non testée
4. **Repos qualifiants** : Définition floue dans le code

**Test nécessaire** :
```
Jour X :
- 00:00-07:00 : REPOS (7h)
- 07:00-16:00 : CONDUITE (9h)
- 16:00-23:59 : REPOS (8h)
Total repos = 15h, mais AUCUN repos ≥ 9h continu
→ Doit détecter infraction (manque repos qualifiant)
```

**Action** : Réécrire complètement la logique Art. 8.2

#### Art. 6.1 — Tolérance 10h (FIABILITÉ 85%)
**Problème** : Compteur de "jours étendus" par semaine
- ❓ Semaine = lundi-dimanche ou 7 jours glissants ?
- ❓ Si 3 jours à 9h30 les vendredi/samedi/dimanche, le dimanche est-il en infraction ?

**Test nécessaire** :
```
Semaine 1 (lun-dim) : Ven=9.5h, Sam=9.5h
Semaine 2 (lun-dim) : Lun=9.5h
→ Lundi semaine 2 est-il le 3ème jour étendu (infraction) ?
   OU première extension de la nouvelle semaine (OK) ?
```

#### Art. 7 — Pauses fractionnées (FIABILITÉ 75%)
**Problème** : Ordre des pauses 15min + 30min
- ❓ Doit-on avoir 15min **puis** 30min, ou l'inverse accepté ?
- ❓ Délai max entre les 2 parties de la pause ?

**Test nécessaire** :
```
Conduite 2h → Pause 30min → Conduite 2h → Pause 15min → Conduite 1h
Total conduite 5h, pause fractionnée 30+15 (ordre inversé)
→ Infraction ou OK ?
```

---

### Composant 4 : Classification gravité (Directive 2009/5/CE)

**Statut** : ✅ **FIABLE 90%**

- ✅ Seuils corrects selon directive
- ✅ 17 tests unitaires passent
- ⚠️ Pas de validation officielle des seuils

**Risque résiduel** : Interprétation des seuils (inclus vs exclus)

---

## 📊 Niveau de fiabilité global : **65-70%**

### Ce qui fonctionne bien
- ✅ Parsing des activités (structure décodée)
- ✅ Extraction nom + numéro carte
- ✅ Détection conduite journalière
- ✅ Détection pauses (validé manuellement)

### Ce qui nécessite un travail approfondi
- ❌ **Repos journalier (Art. 8.2)** — À refaire
- ⚠️ **Repos hebdomadaire (Art. 8.6)** — À valider
- ⚠️ **Semaines glissantes vs calendaires** — À clarifier

---

## 🎯 Plan pour atteindre 100% de fiabilité

### Phase 1 : Validation du parser (2-3 semaines)
1. ✅ Tester tachoparser sur 50 fichiers C1B différents
2. ✅ Comparer avec TachoScan ou équivalent certifié
3. ✅ Documenter les écarts
4. ⚠️ Si écarts > 1% → Changer de parser ou contribuer des fixes

### Phase 2 : Refonte règles complexes (1 semaine)
1. ❌ Réécrire Art. 8.2 (repos journalier) de zéro
2. ❌ Clarifier semaines calendaires vs glissantes
3. ❌ Ajouter 50+ tests de cas limites

### Phase 3 : Tests exhaustifs (2 semaines)
1. ❌ Créer suite de 100+ fichiers de test
2. ❌ Validation manuelle de 20 fichiers
3. ❌ Tests de régression automatisés

### Phase 4 : Audit externe (1-2 semaines)
1. ⚠️ Faire valider par expert tachygraphe agréé
2. ⚠️ Comparaison avec jurisprudence réelle
3. ⚠️ Documentation légale complète

### Phase 5 : Certification (optionnel, 6+ mois)
1. ⚠️ Démarche certification ERCA (si possible)
2. ⚠️ Tests par organisme indépendant

**DURÉE TOTALE ESTIMÉE : 2-3 mois minimum pour 95% de fiabilité**

---

## ⚠️ RECOMMANDATION FINALE

### Court terme (utilisation actuelle)
**NE PAS UTILISER** pour :
- ❌ Sanctions disciplinaires
- ❌ Amendes/pénalités
- ❌ Preuves juridiques

**UTILISER UNIQUEMENT** pour :
- ✅ Pré-analyse indicative
- ✅ Alerte préventive interne
- ✅ Formation des conducteurs
- ✅ Audit interne (à vérifier manuellement)

### Moyen terme (après corrections)
**OBJECTIF : 95% de fiabilité**
- Après refonte Art. 8.2
- Après validation sur 50+ fichiers
- Après comparaison avec outil certifié

→ **Utilisable pour contrôles internes avec vérification manuelle**

### Long terme (certification)
**OBJECTIF : 99.9% de fiabilité**
- Certification officielle
- Maintenance continue
- Traçabilité complète

→ **Utilisable pour sanctions légales**

---

## 📋 Checklist de fiabilité

Avant d'utiliser en production, vérifier :

- [ ] tachoparser testé sur 50+ fichiers (Gen1, Gen2, pays multiples)
- [ ] Comparaison avec outil certifié (écart < 1%)
- [ ] Art. 8.2 réécrit et validé sur 20 cas manuels
- [ ] 100+ tests automatisés (tous verts)
- [ ] Validation par expert tachygraphe
- [ ] Documentation juridique complète
- [ ] Logs d'audit traçables
- [ ] Disclaimer légal visible
- [ ] Procédure de vérification manuelle définie
- [ ] Formation des utilisateurs
