"""Test avec votre fichier C1B réel."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from parser.tacho_parser import parse_file
from parser.json_normalizer import normalize_card_data
from engine.infringement_engine import analyze_summary

# Chemin vers votre fichier
FILE_PATH = "../F__100000065087102512031111 (1).C1B"

print("=" * 80)
print("1. Parsing du fichier C1B avec tachoparser...")
print("=" * 80)

try:
    raw_json = parse_file(FILE_PATH, file_type="card", pretty=False)
    print(f"✓ Parsing réussi — {len(json.dumps(raw_json))} caractères JSON")
except Exception as e:
    print(f"✗ Erreur de parsing: {e}")
    sys.exit(1)

# Afficher un aperçu de la structure
print("\n--- Structure JSON (clés principales) ---")
for key in list(raw_json.keys())[:10]:
    print(f"  - {key}")

print("\n" + "=" * 80)
print("2. Normalisation vers DriverActivity...")
print("=" * 80)

try:
    driver_activity = normalize_card_data(raw_json)
    print(f"✓ Conducteur: {driver_activity.driver_name}")
    print(f"✓ N° carte: {driver_activity.card_number}")
    print(f"✓ Total activités: {len(driver_activity.activities)}")

    # Résumé par type d'activité
    from collections import Counter
    activity_counts = Counter(a.type.value for a in driver_activity.activities)
    print("\n--- Activités par type ---")
    for act_type, count in activity_counts.items():
        print(f"  {act_type}: {count}")

    # Premières activités
    if driver_activity.activities:
        print("\n--- 10 premières activités ---")
        for i, act in enumerate(driver_activity.activities[:10], 1):
            print(f"  {i}. {act.type.value:12} {act.start} → {act.end} ({act.duration_minutes}min)")

except Exception as e:
    print(f"✗ Erreur de normalisation: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("3. Analyse des infractions (Règlement 561/2006)...")
print("=" * 80)

try:
    summary = analyze_summary(driver_activity)
    print(f"✓ Analyse terminée")
    print(f"\n📊 RÉSUMÉ DES INFRACTIONS")
    print(f"   Total: {summary['total']}")
    print(f"\n   Par gravité:")
    for sev, count in summary['by_severity'].items():
        print(f"     {sev:4} : {count}")

    print(f"\n   Par article:")
    for article, count in summary['by_article'].items():
        print(f"     {article:10} : {count}")

    if summary['infringements']:
        print(f"\n--- Détail des infractions ---")
        for inf in summary['infringements'][:20]:  # Limiter à 20
            print(f"\n  📅 {inf.date} — {inf.article} ({inf.severity.value})")
            print(f"     {inf.rule_description}")
            print(f"     Valeur: {inf.value:.1f}h | Limite: {inf.limit:.1f}h | Excès: {inf.excess:.1f}h")
            if inf.details:
                print(f"     Détail: {inf.details}")

    print("\n✓ Analyse complète réussie !")

except Exception as e:
    print(f"✗ Erreur d'analyse: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
