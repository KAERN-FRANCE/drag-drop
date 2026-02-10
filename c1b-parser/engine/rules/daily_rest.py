"""Règle de repos journalier — Article 8.2 du Règlement (CE) 561/2006.

Art. 8.2 : Dans chaque période de 24h après la fin du repos journalier ou
hebdomadaire précédent, le conducteur doit avoir pris un nouveau repos
journalier d'au moins :
- 11h (repos normal)
- 9h (repos réduit, max 3 entre 2 repos hebdomadaires)

Art. 8.5 : En équipage, repos de 9h minimum dans une période de 30h
(non implémenté ici, nécessite info multi-conducteur).
"""

from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from engine.severity import classify_severity
from models.activity import Activity, ActivityType, DriverActivity
from models.infringement import Infringement

NORMAL_DAILY_REST = 11.0 * 60   # 11h en minutes
REDUCED_DAILY_REST = 9.0 * 60   # 9h en minutes
MAX_REDUCED_PER_WEEK = 3


def _find_rest_periods(activities: List[Activity]) -> List[Tuple[datetime, datetime, float]]:
    """Identifie les périodes de repos contiguës et leur durée.

    Retourne une liste de (start, end, duration_minutes).
    Les repos consécutifs sont fusionnés.
    """
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
                # Fusionner les repos consécutifs (tolérance 1 min)
                current_end = max(current_end, act.end)
            else:
                duration = (current_end - current_start).total_seconds() / 60.0
                rest_periods.append((current_start, current_end, duration))
                current_start = act.start
                current_end = act.end
        else:
            if current_start is not None:
                duration = (current_end - current_start).total_seconds() / 60.0
                rest_periods.append((current_start, current_end, duration))
                current_start = None
                current_end = None

    if current_start is not None:
        duration = (current_end - current_start).total_seconds() / 60.0
        rest_periods.append((current_start, current_end, duration))

    return rest_periods


def check_daily_rest(driver: DriverActivity) -> List[Infringement]:
    """Art. 8.2 : Vérifie le repos journalier.

    Logique :
    - Identifier chaque période de 24h à partir de la fin du dernier repos qualifiant
    - Vérifier qu'un repos >= 11h (ou >= 9h réduit) a été pris
    - Maximum 3 repos réduits entre 2 repos hebdomadaires
    """
    infringements = []
    sorted_acts = sorted(driver.activities, key=lambda a: a.start)

    if not sorted_acts:
        return infringements

    rest_periods = _find_rest_periods(sorted_acts)
    reduced_count = 0

    # Analyser les périodes entre deux repos qualifiants
    # Un repos qualifiant pour le journalier est >= 9h
    last_qualifying_rest_end: Optional[datetime] = None

    for rest_start, rest_end, duration_min in rest_periods:
        # Ignorer les très courtes pauses (< 7h ne compte pas comme repos journalier)
        if duration_min < 7 * 60:
            continue

        if last_qualifying_rest_end is not None:
            # Calculer la période depuis le dernier repos qualifiant
            period_hours = (rest_start - last_qualifying_rest_end).total_seconds() / 3600.0

            # Si la période dépasse 24h, vérifier le repos pris
            if period_hours > 24:
                # Le repos trouvé ne couvre pas la période de 24h correctement
                pass

        if duration_min >= NORMAL_DAILY_REST:
            # Repos normal (>= 11h) : OK
            last_qualifying_rest_end = rest_end
            continue

        if duration_min >= REDUCED_DAILY_REST:
            # Repos réduit (9h <= repos < 11h)
            reduced_count += 1
            if reduced_count <= MAX_REDUCED_PER_WEEK:
                # Toléré
                last_qualifying_rest_end = rest_end
                continue
            # Trop de repos réduits — infraction par rapport à 11h
            missing_hours = (NORMAL_DAILY_REST - duration_min) / 60.0
            severity = classify_severity("daily_rest", missing_hours)
            infringements.append(Infringement(
                article="Art. 8.2",
                rule_description="Repos journalier insuffisant (trop de repos réduits)",
                severity=severity,
                value=round(duration_min / 60.0, 2),
                limit=11.0,
                excess=round(missing_hours, 2),
                date=rest_start.date(),
                driver_name=driver.driver_name,
                card_number=driver.card_number,
                details=f"Repos réduit #{reduced_count} (max {MAX_REDUCED_PER_WEEK} autorisés)",
            ))
            last_qualifying_rest_end = rest_end
            continue

        # Repos < 9h : toujours infraction
        missing_hours = (REDUCED_DAILY_REST - duration_min) / 60.0
        severity = classify_severity("daily_rest", missing_hours)
        infringements.append(Infringement(
            article="Art. 8.2",
            rule_description="Repos journalier insuffisant",
            severity=severity,
            value=round(duration_min / 60.0, 2),
            limit=9.0,
            excess=round(missing_hours, 2),
            date=rest_start.date(),
            driver_name=driver.driver_name,
            card_number=driver.card_number,
        ))
        last_qualifying_rest_end = rest_end

    # Vérifier aussi les périodes de 24h sans aucun repos qualifiant
    _check_24h_periods_without_rest(driver, rest_periods, infringements)

    return infringements


def _check_24h_periods_without_rest(
    driver: DriverActivity,
    rest_periods: List[Tuple[datetime, datetime, float]],
    infringements: List[Infringement],
) -> None:
    """Vérifie qu'il n'y a pas de période de 24h sans repos qualifiant (>= 9h)."""
    qualifying_rests = [
        (start, end, dur) for start, end, dur in rest_periods
        if dur >= REDUCED_DAILY_REST
    ]

    if not qualifying_rests:
        if not driver.activities:
            return
        # Aucun repos qualifiant sur toute la période
        first_act = min(driver.activities, key=lambda a: a.start)
        last_act = max(driver.activities, key=lambda a: a.end)
        total_hours = (last_act.end - first_act.start).total_seconds() / 3600.0
        if total_hours > 24:
            missing_hours = 9.0  # Aucun repos pris
            severity = classify_severity("daily_rest", missing_hours)
            infringements.append(Infringement(
                article="Art. 8.2",
                rule_description="Aucun repos journalier sur 24h+",
                severity=severity,
                value=0.0,
                limit=9.0,
                excess=9.0,
                date=first_act.start.date(),
                driver_name=driver.driver_name,
                card_number=driver.card_number,
            ))
        return

    # Vérifier les écarts entre repos qualifiants consécutifs
    for i in range(len(qualifying_rests) - 1):
        _, end1, _ = qualifying_rests[i]
        start2, _, _ = qualifying_rests[i + 1]
        gap_hours = (start2 - end1).total_seconds() / 3600.0
        if gap_hours > 24:
            # Période > 24h entre deux repos qualifiants
            # Chercher le meilleur repos non-qualifiant dans cet intervalle
            best_rest = 0.0
            for r_start, r_end, r_dur in rest_periods:
                if r_start >= end1 and r_end <= start2 and r_dur < REDUCED_DAILY_REST:
                    best_rest = max(best_rest, r_dur)

            missing_hours = (REDUCED_DAILY_REST - best_rest) / 60.0
            severity = classify_severity("daily_rest", missing_hours)
            infringements.append(Infringement(
                article="Art. 8.2",
                rule_description="Repos journalier insuffisant dans une période de 24h",
                severity=severity,
                value=round(best_rest / 60.0, 2),
                limit=9.0,
                excess=round(missing_hours, 2),
                date=end1.date(),
                driver_name=driver.driver_name,
                card_number=driver.card_number,
            ))
