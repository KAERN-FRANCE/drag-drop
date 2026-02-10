# Comment vérifier la fiabilité de tachoparser

## 🎯 Objectif

**Prouver que tachoparser extrait correctement les données des fichiers C1B.**

---

## 📋 Méthode 1 : Comparaison avec outil certifié

### Outils du marché certifiés

1. **TachoScan** (Inelo) — Leader français
   - Certifié VDO
   - Export CSV/Excel des infractions

2. **VDO TIS-Web** (Continental) — Officiel
   - Outil fabricant VDO
   - Export détaillé

3. **RVI Download Key** (Renault Trucks)
   - Outil constructeur
   - Format spécifique

4. **TachoReader** (open source alternatif)
   - https://github.com/juanro49/tachoreader
   - Non certifié mais code vérifiable

### Procédure de test

```bash
# 1. Télécharge le même fichier C1B avec les 2 outils
# 2. Exporte les activités depuis l'outil certifié (CSV)
# 3. Parse avec tachoparser
./bin/dddparser -card -input fichier.C1B > notre_parse.json

# 4. Compare les résultats
python3 compare_parsing.py \
    --tachoparser notre_parse.json \
    --certified activites_certifiees.csv
```

### Critères de validation

| Donnée | Tolérance | Priorité |
|--------|-----------|----------|
| Nom conducteur | Exact | CRITIQUE |
| N° carte | Exact | CRITIQUE |
| Nombre d'activités | ±2% | HAUTE |
| Horodatages activités | ±1 min | HAUTE |
| Durée conduite journalière | ±5 min | CRITIQUE |
| Type d'activité | 100% | CRITIQUE |

**Si écart > tolérance** → tachoparser n'est **PAS fiable**

---

## 📋 Méthode 2 : Validation manuelle (sans outil)

### Lire un fichier C1B "à la main"

Les fichiers C1B sont en **binaire TLV** (Tag-Length-Value) :

```bash
# Afficher le fichier en hexadécimal
hexdump -C fichier.C1B | head -50

# Extraire des patterns connus
# Exemple : Trouver le numéro de carte (Tag 0x0520)
```

**Problème** : Format complexe, nécessite expertise.

### Outils d'inspection bas niveau

1. **cardreader** (Windows, officiel)
   - Fourni par centres agréés
   - Affiche structure TLV

2. **Analyse hexadécimale manuelle**
   - Tag 0x0520 : Card Number
   - Tag 0x0521 : Card Holder Name
   - Tag 0x050E : Activities

**Validation** :
- Extraire manuellement le numéro de carte (hex → décimal)
- Comparer avec la sortie de tachoparser

---

## 📋 Méthode 3 : Tests croisés avec autres parsers

### Parsers open source alternatifs

1. **TachoReader** (Java/Kotlin)
   - https://github.com/juanro49/tachoreader
   - Parse C1B/DDD
   - **À tester en parallèle**

2. **pyTacho** (Python)
   - https://github.com/mariusherzog/pyTacho
   - Parser Python natif
   - **À comparer avec tachoparser**

### Procédure

```bash
# Parser le même fichier avec 3 parsers
./tachoparser/bin/dddparser -card -input test.C1B > tacho1.json
java -jar tachoreader.jar test.C1B > tacho2.json
python3 pytacho.py test.C1B > tacho3.json

# Comparer les 3 sorties
diff <(jq -S . tacho1.json) <(jq -S . tacho2.json)
```

**Critère** : Les 3 doivent donner **exactement** les mêmes données

---

## 🔍 Tests que tu peux faire MAINTENANT

### Test 1 : Vérifier le numéro de carte

```bash
cd "/Users/noah/Desktop/Convertisseur C1B git/tachograph-analyzer"

# Extraire le numéro avec tachoparser
./bin/dddparser -card -input "../F__100000065087102512031111 (1).C1B" 2>/dev/null | \
  jq -r '.card_identification_and_driver_card_holder_identification_1.card_identification.card_number'
```

**Résultat attendu** : `1000000650871003`

**Vérifie** : Ouvre le fichier avec un lecteur de carte officiel et compare.

---

### Test 2 : Vérifier le nom du conducteur

```bash
./bin/dddparser -card -input "../F__100000065087102512031111 (1).C1B" 2>/dev/null | \
  jq -r '.card_identification_and_driver_card_holder_identification_1.driver_card_holder_identification.card_holder_name | "\(.holder_first_names) \(.holder_surname)"'
```

**Résultat** : `FLORIAN PIERRE NIGI`

**Vérifie** : Compare avec la carte physique ou l'outil officiel.

---

### Test 3 : Compter les activités

```bash
# Nombre de jours d'activités Gen1
./bin/dddparser -card -input "../F__100000065087102512031111 (1).C1B" 2>/dev/null | \
  jq '.card_driver_activity_1.decoded_activity_daily_records | length'
```

**Résultat** : `52` (jours)

**Vérifie avec outil certifié** : Le nombre de jours doit correspondre.

---

### Test 4 : Temps de conduite d'un jour précis

```bash
# Activités du 2025-09-26
./bin/dddparser -card -input "../F__100000065087102512031111 (1).C1B" 2>/dev/null | \
  jq '.card_driver_activity_1.decoded_activity_daily_records[] | select(.activity_record_date == "2025-09-26T00:00:00Z") | .activity_change_info'
```

**Calcule manuellement** : Somme des durées work_type=3 (DRIVING)

**Compare avec** :
- Notre script Python : 9.2h
- Outil certifié : ?

---

## ⚠️ Signaux d'alerte

Si tu observes ces problèmes, **tachoparser n'est PAS fiable** :

1. ❌ Nombre de jours différent entre tachoparser et outil certifié
2. ❌ Nom conducteur différent
3. ❌ Temps de conduite journalier écart > 15 min
4. ❌ Activités manquantes ou en trop
5. ❌ Horodatages décalés de plusieurs heures

→ **Dans ce cas, NE PAS UTILISER tachoparser**

---

## 🎯 Prochaines étapes

### Immédiat (cette semaine)
1. ✅ Télécharge le même fichier C1B avec TachoScan ou équivalent
2. ✅ Compare nom, numéro carte, nombre de jours
3. ✅ Compare temps de conduite journalier sur 5 jours

### Court terme (2 semaines)
1. ⚠️ Teste avec 10 fichiers C1B différents
2. ⚠️ Compare avec pyTacho ou TachoReader
3. ⚠️ Documente tous les écarts

### Moyen terme (1 mois)
1. ⚠️ Contacte traconiq (auteur de tachoparser) pour confirmation
2. ⚠️ Teste Gen2, Gen2v2
3. ⚠️ Teste cartes de pays différents (DE, ES, PL...)

---

## 📞 Où trouver de l'aide

### Communauté tachygraphes
- Forums transport.info
- LinkedIn groupes "Chronotachygraphe"
- Experts tachygraphes certifiés (annuaire FNTR)

### Validation technique
- Centre agréé VDO/Stoneridge
- Fabricant de cartes (Imprimerie Nationale)
- ANTS (Agence Nationale des Titres Sécurisés)

---

## ✅ Conclusion

**AVANT d'utiliser ce système en production, tu DOIS** :

1. ✅ Valider tachoparser sur ≥ 10 fichiers avec outil certifié
2. ✅ Écart < 1% sur temps de conduite
3. ✅ 100% de concordance sur nom/numéro carte
4. ✅ Documenter les tests

**SANS CES VALIDATIONS, LA FIABILITÉ EST INCONNUE.**
