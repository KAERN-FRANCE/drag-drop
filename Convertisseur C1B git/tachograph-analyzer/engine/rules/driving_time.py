"""Règles de temps de conduite — Articles 6.1, 6.2, 6.3 du Règlement (CE) 561/2006.

Art. 6.1 : Temps de conduite journalier max 9h (10h toléré 2x/semaine)
Art. 6.2 : Temps de conduite hebdomadaire max 56h
Art. 6.3 : Temps de conduite sur 2 semaines consécutives max 90h
"""

from collections import defaultdict
from datetime import date, timedelta
from typing import Dict, List, Tuple

from engine.severity import classify_severity
from models.activity import ActivityType, DriverActivity
from models.infringement import Infringement


def _driving_minutes_per_day(driver: DriverActivity) -> Dict[date, float]:
    """Calcule le temps de conduite total par jour calendaire (en minutes)."""
    daily = defaultdict(float)
    for act in driver.activities:
        if act.type != ActivityType.DRIVING:
            continue
        # Gérer les activités qui chevauchent minuit
        current = act.start
        while current.date() < act.end.date():
            # Minutes restantes dans la journée courante
            end_of_day = current.replace(hour=23, minute=59, second=59)
            minutes = (end_of_day - current).total_seconds() / 60.0 + 1 / 60.0
            daily[current.date()] += minutes
            current = (current + timedelta(days=1)).replace(hour=0, minute=0, second=0)
        # Dernière portion (même jour)
        minutes = (act.end - current).total_seconds() / 60.0
        if minutes > 0:
            daily[current.date()] += minutes
    return dict(daily)


def _monday_of_week(d: date) -> date:
    """Retourne le lundi de la semaine contenant la date d."""
    return d - timedelta(days=d.weekday())


def _driving_minutes_per_week(daily_minutes: Dict[date, float]) -> Dict[date, float]:
    """Agrège les minutes de conduite par semaine (clé = lundi de la semaine)."""
    weekly = defaultdict(float)
    for day, minutes in daily_minutes.items():
        monday = _monday_of_week(day)
        weekly[monday] += minutes
    return dict(weekly)


def check_daily_driving(driver: DriverActivity) -> List[Infringement]:
    """Art. 6.1 : Vérifie le temps de conduite journalier.

    - Max 9h par jour
    - Tolérance 10h maximum 2 fois par semaine
    """
    infringements = []
    daily_minutes = _driving_minutes_per_day(driver)

    # Compter les jours à 10h par semaine pour gérer la tolérance
    weekly_extended_days: Dict[date, int] = defaultdict(int)
    # D'abord, identifier les jours entre 9h et 10h par semaine
    days_between_9_10: Dict[date, List[date]] = defaultdict(list)

    for day, minutes in sorted(daily_minutes.items()):
        hours = minutes / 60.0
        monday = _monday_of_week(day)
        if 9.0 * 60 < minutes <= 10.0 * 60:
            days_between_9_10[monday].append(day)

    # Marquer les jours en dépassement réel
    for day, minutes in sorted(daily_minutes.items()):
        hours = minutes / 60.0
        monday = _monday_of_week(day)

        if minutes <= 9.0 * 60:
            continue  # Pas d'infraction

        if minutes < 10.0 * 60:
            # Entre 9h et 10h : toléré si pas plus de 2 jours étendus cette semaine
            weekly_extended_days[monday] += 1
            if weekly_extended_days[monday] <= 2:
                continue  # Tolérance acceptée
            # 3ème jour étendu : infraction par rapport à 9h
            excess_hours = (minutes - 9.0 * 60) / 60.0
            limit = 9.0
        elif minutes == 10.0 * 60:
            # Exactement 10h : toléré si pas plus de 2 jours étendus cette semaine
            weekly_extended_days[monday] += 1
            if weekly_extended_days[monday] <= 2:
                continue  # Tolérance acceptée (10h pile OK)
            # 3ème jour à 10h : infraction de 1h par rapport à 9h
            excess_hours = 1.0
            limit = 9.0
        else:
            # > 10h : toujours infraction, calculé par rapport à 10h si tolérance dispo
            if weekly_extended_days[monday] < 2:
                weekly_extended_days[monday] += 1
                excess_hours = (minutes - 10.0 * 60) / 60.0
                limit = 10.0
            else:
                excess_hours = (minutes - 9.0 * 60) / 60.0
                limit = 9.0

        if excess_hours > 0:
            severity = classify_severity("daily_driving", excess_hours)
            infringements.append(Infringement(
                article="Art. 6.1",
                rule_description="Temps de conduite journalier",
                severity=severity,
                value=round(hours, 2),
                limit=limit,
                excess=round(excess_hours, 2),
                date=day,
                driver_name=driver.driver_name,
                card_number=driver.card_number,
            ))

    return infringements


def check_weekly_driving(driver: DriverActivity) -> List[Infringement]:
    """Art. 6.2 : Vérifie le temps de conduite hebdomadaire (max 56h)."""
    infringements = []
    daily_minutes = _driving_minutes_per_day(driver)
    weekly_minutes = _driving_minutes_per_week(daily_minutes)

    for monday, minutes in sorted(weekly_minutes.items()):
        hours = minutes / 60.0
        if minutes > 56.0 * 60:
            excess_hours = (minutes - 56.0 * 60) / 60.0
            severity = classify_severity("weekly_driving", excess_hours)
            # Infraction datée au dimanche de la semaine
            sunday = monday + timedelta(days=6)
            infringements.append(Infringement(
                article="Art. 6.2",
                rule_description="Temps de conduite hebdomadaire",
                severity=severity,
                value=round(hours, 2),
                limit=56.0,
                excess=round(excess_hours, 2),
                date=sunday,
                driver_name=driver.driver_name,
                card_number=driver.card_number,
            ))

    return infringements


def check_biweekly_driving(driver: DriverActivity) -> List[Infringement]:
    """Art. 6.3 : Vérifie le temps de conduite sur 2 semaines consécutives (max 90h)."""
    infringements = []
    daily_minutes = _driving_minutes_per_day(driver)
    weekly_minutes = _driving_minutes_per_week(daily_minutes)

    sorted_weeks = sorted(weekly_minutes.keys())
    for i in range(len(sorted_weeks) - 1):
        week1 = sorted_weeks[i]
        week2 = sorted_weeks[i + 1]
        # Vérifier que les semaines sont bien consécutives
        if (week2 - week1).days != 7:
            continue
        total_minutes = weekly_minutes[week1] + weekly_minutes[week2]
        total_hours = total_minutes / 60.0
        if total_minutes > 90.0 * 60:
            excess_hours = (total_minutes - 90.0 * 60) / 60.0
            severity = classify_severity("biweekly_driving", excess_hours)
            # Datée au dimanche de la 2ème semaine
            sunday = week2 + timedelta(days=6)
            infringements.append(Infringement(
                article="Art. 6.3",
                rule_description="Temps de conduite sur 2 semaines consécutives",
                severity=severity,
                value=round(total_hours, 2),
                limit=90.0,
                excess=round(excess_hours, 2),
                date=sunday,
                driver_name=driver.driver_name,
                card_number=driver.card_number,
            ))

    return infringements
