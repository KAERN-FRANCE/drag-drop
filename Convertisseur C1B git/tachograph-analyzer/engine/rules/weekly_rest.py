"""Règle de repos hebdomadaire — Article 8.6 du Règlement (CE) 561/2006.

Art. 8.6 : Au cours de deux semaines consécutives, le conducteur doit prendre
au moins :
- 2 repos hebdomadaires dont au moins un repos normal (>= 45h)
- Le repos réduit (>= 24h) doit être compensé avant la fin de la 3ème semaine

Un repos hebdomadaire doit commencer au plus tard à la fin de 6 périodes
de 24h après le repos hebdomadaire précédent.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from engine.severity import classify_severity
from models.activity import Activity, ActivityType, DriverActivity
from models.infringement import Infringement

NORMAL_WEEKLY_REST = 45.0 * 60   # 45h en minutes
REDUCED_WEEKLY_REST = 24.0 * 60  # 24h en minutes
MAX_PERIOD_WITHOUT_WEEKLY_REST = 6 * 24  # 6 périodes de 24h = 144h


def _find_long_rest_periods(activities: List[Activity]) -> List[Tuple[datetime, datetime, float]]:
    """Identifie les périodes de repos potentiellement hebdomadaires (>= 24h)."""
    sorted_acts = sorted(activities, key=lambda a: a.start)
    rest_periods = []

    current_start = None
    current_end = None

    for act in sorted_acts:
        if act.type == ActivityType.REST:
            if current_start is None:
                current_start = act.start
                current_end = act.end
            elif act.start <= current_end + timedelta(minutes=1):
                current_end = max(current_end, act.end)
            else:
                duration = (current_end - current_start).total_seconds() / 60.0
                if duration >= REDUCED_WEEKLY_REST * 0.5:
                    # Inclure les repos potentiels (même sous le seuil pour détection)
                    rest_periods.append((current_start, current_end, duration))
                current_start = act.start
                current_end = act.end
        else:
            if current_start is not None:
                duration = (current_end - current_start).total_seconds() / 60.0
                if duration >= REDUCED_WEEKLY_REST * 0.5:
                    rest_periods.append((current_start, current_end, duration))
                current_start = None
                current_end = None

    if current_start is not None:
        duration = (current_end - current_start).total_seconds() / 60.0
        if duration >= REDUCED_WEEKLY_REST * 0.5:
            rest_periods.append((current_start, current_end, duration))

    return rest_periods


def check_weekly_rest(driver: DriverActivity) -> List[Infringement]:
    """Art. 8.6 : Vérifie le repos hebdomadaire.

    Vérifie :
    1. Qu'un repos hebdomadaire (>= 24h) existe avant la fin de 6×24h
    2. Que le repos est suffisant (45h normal ou 24h réduit)
    """
    infringements = []
    sorted_acts = sorted(driver.activities, key=lambda a: a.start)

    if not sorted_acts:
        return infringements

    rest_periods = _find_long_rest_periods(sorted_acts)

    # Filtrer les repos qualifiants comme repos hebdomadaires (>= 24h)
    weekly_rests = [
        (start, end, dur) for start, end, dur in rest_periods
        if dur >= REDUCED_WEEKLY_REST
    ]

    # 1. Vérifier la durée de chaque repos hebdomadaire
    for rest_start, rest_end, duration_min in rest_periods:
        if duration_min >= NORMAL_WEEKLY_REST:
            continue  # Repos normal OK

        if duration_min >= REDUCED_WEEKLY_REST:
            # Repos réduit : signaler pour suivi de compensation
            # (pas forcément une infraction si compensé)
            continue

        # Si c'est le meilleur repos trouvé dans une période de 6×24h
        # et qu'il est < 24h, c'est une infraction
        # (traité dans la vérification 6×24h ci-dessous)

    # 2. Vérifier qu'un repos hebdo existe avant la fin de 6×24h
    if not weekly_rests and sorted_acts:
        first_act = min(sorted_acts, key=lambda a: a.start)
        last_act = max(sorted_acts, key=lambda a: a.end)
        total_hours = (last_act.end - first_act.start).total_seconds() / 3600.0

        if total_hours > MAX_PERIOD_WITHOUT_WEEKLY_REST:
            # Trouver le meilleur repos dans la période
            best_rest_min = 0.0
            for _, _, dur in rest_periods:
                best_rest_min = max(best_rest_min, dur)

            if best_rest_min < REDUCED_WEEKLY_REST:
                missing_hours = (REDUCED_WEEKLY_REST - best_rest_min) / 60.0
                severity = classify_severity("weekly_rest", missing_hours)
                infringements.append(Infringement(
                    article="Art. 8.6",
                    rule_description="Pas de repos hebdomadaire dans une période de 6×24h",
                    severity=severity,
                    value=round(best_rest_min / 60.0, 2),
                    limit=24.0,
                    excess=round(missing_hours, 2),
                    date=first_act.start.date(),
                    driver_name=driver.driver_name,
                    card_number=driver.card_number,
                ))
            return infringements

    # Vérifier les intervalles entre repos hebdomadaires
    for i in range(len(weekly_rests) - 1):
        _, end1, _ = weekly_rests[i]
        start2, _, dur2 = weekly_rests[i + 1]
        gap_hours = (start2 - end1).total_seconds() / 3600.0

        if gap_hours > MAX_PERIOD_WITHOUT_WEEKLY_REST:
            # Période > 6×24h entre deux repos hebdomadaires
            infringements.append(Infringement(
                article="Art. 8.6",
                rule_description="Repos hebdomadaire dépassant la période de 6×24h",
                severity=classify_severity("weekly_rest", 3.0),  # SI minimum
                value=round(gap_hours, 2),
                limit=MAX_PERIOD_WITHOUT_WEEKLY_REST,
                excess=round(gap_hours - MAX_PERIOD_WITHOUT_WEEKLY_REST, 2),
                date=end1.date(),
                driver_name=driver.driver_name,
                card_number=driver.card_number,
            ))

    # Vérifier les repos insuffisants
    for rest_start, rest_end, duration_min in weekly_rests:
        if duration_min >= NORMAL_WEEKLY_REST:
            continue  # OK

        if duration_min >= REDUCED_WEEKLY_REST:
            # Repos réduit — pas d'infraction immédiate mais signalement
            # La compensation doit avoir lieu avant la fin de la 3ème semaine
            # (nécessite un suivi sur plusieurs semaines, simplifié ici)
            continue

    return infringements
