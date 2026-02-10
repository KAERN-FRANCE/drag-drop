"""Validation manuelle des infractions détectées.

Compare les résultats automatiques avec un calcul manuel sur quelques jours.
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from parser.tacho_parser import parse_file
from parser.json_normalizer import normalize_card_data
from engine.infringement_engine import analyze
from models.activity import ActivityType

FILE_PATH = "../F__100000065087102512031111 (1).C1B"

print("=" * 80)
print("VALIDATION MANUELLE — Vérification croisée des infractions")
print("=" * 80)

# Parser et normaliser
raw_json = parse_file(FILE_PATH, file_type="card")
driver_activity = normalize_card_data(raw_json)
infringements = analyze(driver_activity)

# Choisir 3 jours à vérifier manuellement
test_dates = [
    datetime(2025, 9, 26).date(),  # Jour avec infraction conduite (9.2h)
    datetime(2025, 10, 13).date(),  # Jour avec infraction pause
    datetime(2025, 9, 19).date(),   # Jour avec repos insuffisant (MSI)
]

for test_date in test_dates:
    print(f"\n{'='*80}")
    print(f"📅 JOUR: {test_date}")
    print(f"{'='*80}")

    # Filtrer les activités du jour
    day_activities = [
        a for a in driver_activity.activities
        if a.start.date() == test_date or a.end.date() == test_date
    ]

    if not day_activities:
        print("⚠️  Aucune activité ce jour")
        continue

    # Calculer manuellement
    total_driving_minutes = 0
    total_rest_minutes = 0
    total_work_minutes = 0
    driving_periods = []
    rest_periods = []

    for act in day_activities:
        # Si l'activité chevauche minuit, découper
        if act.start.date() != test_date and act.end.date() == test_date:
            # Commence la veille, finit ce jour
            start_today = datetime(test_date.year, test_date.month, test_date.day, 0, 0)
            duration = int((act.end - start_today).total_seconds() / 60)
        elif act.start.date() == test_date and act.end.date() != test_date:
            # Commence ce jour, finit le lendemain
            end_today = datetime(test_date.year, test_date.month, test_date.day, 23, 59)
            duration = int((end_today - act.start).total_seconds() / 60)
        else:
            duration = act.duration_minutes

        if duration <= 0:
            continue

        if act.type == ActivityType.DRIVING:
            total_driving_minutes += duration
            driving_periods.append((act.start.time(), act.end.time(), duration))
        elif act.type == ActivityType.REST:
            total_rest_minutes += duration
            rest_periods.append((act.start.time(), act.end.time(), duration))
        elif act.type == ActivityType.WORK:
            total_work_minutes += duration

    print(f"\n📊 CALCUL MANUEL:")
    print(f"   Conduite: {total_driving_minutes / 60:.1f}h ({total_driving_minutes}min)")
    print(f"   Repos:    {total_rest_minutes / 60:.1f}h ({total_rest_minutes}min)")
    print(f"   Travail:  {total_work_minutes / 60:.1f}h ({total_work_minutes}min)")

    # Afficher les périodes de conduite
    if driving_periods:
        print(f"\n   Périodes de conduite:")
        for i, (start, end, dur) in enumerate(driving_periods, 1):
            print(f"     {i}. {start} → {end} ({dur}min)")

    # Afficher les repos
    if rest_periods:
        print(f"\n   Périodes de repos:")
        longest_rest = max(rest_periods, key=lambda x: x[2])
        for i, (start, end, dur) in enumerate(rest_periods, 1):
            marker = " ← PLUS LONG" if (start, end, dur) == longest_rest else ""
            print(f"     {i}. {start} → {end} ({dur}min = {dur/60:.1f}h){marker}")

    # Vérifications
    print(f"\n✅ VÉRIFICATIONS:")
    print(f"   Art. 6.1 (Conduite journalière):")
    if total_driving_minutes <= 9 * 60:
        print(f"     ✅ OK : {total_driving_minutes/60:.1f}h ≤ 9h")
    elif total_driving_minutes <= 10 * 60:
        print(f"     ⚠️  TOLÉRANCE : {total_driving_minutes/60:.1f}h (max 10h, 2x/semaine)")
    else:
        print(f"     ❌ INFRACTION : {total_driving_minutes/60:.1f}h > 10h")

    print(f"\n   Art. 8.2 (Repos journalier):")
    longest_rest_hours = max([r[2] for r in rest_periods]) / 60 if rest_periods else 0
    if longest_rest_hours >= 11:
        print(f"     ✅ OK : Plus long repos = {longest_rest_hours:.1f}h ≥ 11h")
    elif longest_rest_hours >= 9:
        print(f"     ⚠️  RÉDUIT : Plus long repos = {longest_rest_hours:.1f}h (9-11h, max 3x)")
    else:
        print(f"     ❌ INSUFFISANT : Plus long repos = {longest_rest_hours:.1f}h < 9h")

    # Infractions détectées par le code
    day_infractions = [inf for inf in infringements if inf.date == test_date]
    if day_infractions:
        print(f"\n🔍 INFRACTIONS DÉTECTÉES PAR LE CODE:")
        for inf in day_infractions:
            print(f"   • {inf.article} ({inf.severity.value}) : {inf.rule_description}")
            print(f"     Valeur: {inf.value}h | Limite: {inf.limit}h | Excès: {inf.excess}h")
            if inf.details:
                print(f"     Détail: {inf.details}")
    else:
        print(f"\n✅ Aucune infraction détectée par le code ce jour")

    print(f"\n💡 COMPARAISON:")
    print(f"   Les résultats correspondent-ils ? À vérifier manuellement.")

print("\n" + "=" * 80)
print("✅ Validation terminée")
print("=" * 80)
print("\n⚠️  IMPORTANT : Vérifier manuellement que les calculs correspondent")
print("    aux infractions détectées. Si des écarts apparaissent, le code")
print("    contient des bugs à corriger avant utilisation en production.")
