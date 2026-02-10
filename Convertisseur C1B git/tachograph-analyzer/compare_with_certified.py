"""Compare les résultats de notre système avec un outil certifié.

Usage:
    python compare_with_certified.py \
        --our-file results.json \
        --certified-file certified.csv \
        --tolerance 0.05  # 5% d'écart max

Format CSV attendu (outil certifié) :
    date,conducteur,carte,conduite_h,repos_h,infractions
    2025-09-26,NIGI,1000000650871003,9.2,14.4,"Art. 6.1"
"""

import argparse
import csv
import json
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


def load_our_results(file_path):
    """Charge les résultats de notre système."""
    with open(file_path) as f:
        return json.load(f)


def load_certified_csv(file_path):
    """Charge les résultats de l'outil certifié (CSV)."""
    results = {}
    with open(file_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            day = datetime.strptime(row['date'], '%Y-%m-%d').date()
            results[day] = {
                'conducteur': row['conducteur'],
                'carte': row['carte'],
                'conduite_h': float(row['conduite_h']),
                'repos_h': float(row.get('repos_h', 0)),
                'infractions': row.get('infractions', '').split(',') if row.get('infractions') else [],
            }
    return results


def compare_results(our_results, certified_results, tolerance=0.05):
    """Compare les deux jeux de résultats."""
    print("=" * 80)
    print("COMPARAISON AVEC OUTIL CERTIFIÉ")
    print("=" * 80)

    discrepancies = []
    matches = 0
    total_days = len(certified_results)

    for day, certified in certified_results.items():
        # Trouver le jour correspondant dans nos résultats
        our_day = our_results.get(str(day))
        if not our_day:
            discrepancies.append({
                'date': day,
                'type': 'MISSING',
                'message': f"Jour manquant dans nos résultats",
            })
            continue

        # Comparer nom conducteur
        if our_day.get('conducteur') != certified['conducteur']:
            discrepancies.append({
                'date': day,
                'type': 'NAME',
                'ours': our_day.get('conducteur'),
                'certified': certified['conducteur'],
            })

        # Comparer numéro carte
        if our_day.get('carte') != certified['carte']:
            discrepancies.append({
                'date': day,
                'type': 'CARD',
                'ours': our_day.get('carte'),
                'certified': certified['carte'],
            })

        # Comparer temps de conduite
        our_driving = our_day.get('conduite_h', 0)
        certified_driving = certified['conduite_h']
        diff = abs(our_driving - certified_driving)
        rel_diff = diff / certified_driving if certified_driving > 0 else 0

        if rel_diff > tolerance:
            discrepancies.append({
                'date': day,
                'type': 'DRIVING_TIME',
                'ours': our_driving,
                'certified': certified_driving,
                'diff': diff,
                'rel_diff': rel_diff * 100,
            })
        else:
            matches += 1

    # Afficher résultats
    print(f"\n📊 RÉSULTATS:")
    print(f"   Total jours testés: {total_days}")
    print(f"   Jours concordants: {matches}")
    print(f"   Écarts détectés: {len(discrepancies)}")

    if discrepancies:
        print(f"\n⚠️  ÉCARTS DÉTECTÉS:\n")
        for disc in discrepancies[:20]:  # Limiter à 20
            date_str = disc['date']
            if disc['type'] == 'MISSING':
                print(f"   📅 {date_str}: {disc['message']}")
            elif disc['type'] == 'NAME':
                print(f"   📅 {date_str}: Nom différent")
                print(f"      Notre: {disc['ours']}")
                print(f"      Certifié: {disc['certified']}")
            elif disc['type'] == 'CARD':
                print(f"   📅 {date_str}: Numéro carte différent")
                print(f"      Notre: {disc['ours']}")
                print(f"      Certifié: {disc['certified']}")
            elif disc['type'] == 'DRIVING_TIME':
                print(f"   📅 {date_str}: Temps de conduite différent")
                print(f"      Notre: {disc['ours']:.2f}h")
                print(f"      Certifié: {disc['certified']:.2f}h")
                print(f"      Écart: {disc['diff']:.2f}h ({disc['rel_diff']:.1f}%)")
            print()

    # Verdict
    print("=" * 80)
    if len(discrepancies) == 0:
        print("✅ VALIDATION RÉUSSIE : 100% de concordance")
        print("   Le système est FIABLE pour ces données.")
    elif len(discrepancies) <= total_days * 0.05:  # < 5% d'écarts
        print("⚠️  VALIDATION PARTIELLE : Quelques écarts mineurs détectés")
        print("   Le système est PARTIELLEMENT FIABLE.")
        print("   Vérifier manuellement les écarts avant utilisation.")
    else:
        print("❌ VALIDATION ÉCHOUÉE : Trop d'écarts détectés")
        print("   Le système N'EST PAS FIABLE.")
        print("   NE PAS UTILISER en production.")
    print("=" * 80)

    return len(discrepancies) == 0


def main():
    parser = argparse.ArgumentParser(description="Compare avec outil certifié")
    parser.add_argument('--our-file', required=True, help="Fichier JSON de nos résultats")
    parser.add_argument('--certified-file', required=True, help="Fichier CSV de l'outil certifié")
    parser.add_argument('--tolerance', type=float, default=0.05, help="Tolérance d'écart (défaut: 5%)")

    args = parser.parse_args()

    if not Path(args.our_file).exists():
        print(f"❌ Fichier introuvable: {args.our_file}")
        sys.exit(1)

    if not Path(args.certified_file).exists():
        print(f"❌ Fichier introuvable: {args.certified_file}")
        print("\n💡 Pour créer le fichier certifié :")
        print("   1. Ouvre le fichier C1B dans TachoScan/VDO/etc.")
        print("   2. Exporte les activités journalières en CSV")
        print("   3. Format attendu: date,conducteur,carte,conduite_h,repos_h,infractions")
        sys.exit(1)

    our_results = load_our_results(args.our_file)
    certified_results = load_certified_csv(args.certified_file)

    success = compare_results(our_results, certified_results, args.tolerance)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
