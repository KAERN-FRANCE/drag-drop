"""Tests pour les règles de temps de conduite (Art. 6)."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.rules.driving_time import (
    check_biweekly_driving,
    check_daily_driving,
    check_weekly_driving,
)
from models.activity import Activity, ActivityType, DriverActivity
from tests.conftest import make_activity, make_driver


# === Art. 6.1 — Conduite journalière ===

def test_daily_driving_under_9h_no_infringement():
    """Exactement 9h de conduite -> pas d'infraction."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 15, 0),  # 9h
    ]
    driver = make_driver(activities)
    infringements = check_daily_driving(driver)
    assert len(infringements) == 0


def test_daily_driving_over_9h_under_10h_first_time():
    """9h30 de conduite, première fois dans la semaine -> toléré (10h autorisé 2x/sem)."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 15, 30),  # 9h30
    ]
    driver = make_driver(activities)
    infringements = check_daily_driving(driver)
    assert len(infringements) == 0


def test_daily_driving_over_10h_infringement():
    """10h30 de conduite -> infraction (dépassement de 0.5h par rapport à 10h)."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 5, 0, 15, 30),  # 10h30
    ]
    driver = make_driver(activities)
    infringements = check_daily_driving(driver)
    assert len(infringements) == 1
    assert infringements[0].article == "Art. 6.1"
    assert infringements[0].severity.value == "MI"  # 0.5h excess -> MI


def test_daily_driving_third_extended_day():
    """3ème jour à plus de 9h dans la même semaine -> infraction."""
    # Lundi, Mardi, Mercredi : 3 jours > 9h mais <= 10h
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 15, 30),  # Lundi 9h30
        make_activity(ActivityType.DRIVING, 2024, 1, 16, 6, 0, 15, 30),  # Mardi 9h30
        make_activity(ActivityType.DRIVING, 2024, 1, 17, 6, 0, 15, 30),  # Mercredi 9h30
    ]
    driver = make_driver(activities)
    infringements = check_daily_driving(driver)
    # Le 3ème jour devrait être en infraction
    assert len(infringements) == 1
    assert infringements[0].date.day == 17


def test_daily_driving_severe_excess():
    """13h de conduite -> MSI (excess > 4h30 par rapport à 9h si pas de tolérance)."""
    # Pour déclencher MSI, il faut que toutes les tolérances soient épuisées
    # ou que le dépassement soit si grand qu'il dépasse même avec tolérance
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 5, 0, 20, 0),  # 15h
    ]
    driver = make_driver(activities)
    infringements = check_daily_driving(driver)
    assert len(infringements) == 1
    # 15h - 10h = 5h excess -> MSI
    assert infringements[0].severity.value == "MSI"


# === Art. 6.2 — Conduite hebdomadaire ===

def test_weekly_driving_under_56h():
    """56h pile -> pas d'infraction."""
    # 5 jours x 11h12 = 56h
    activities = []
    for day in range(15, 20):
        activities.append(
            make_activity(ActivityType.DRIVING, 2024, 1, day, 5, 0, 16, 12)  # 11h12
        )
    driver = make_driver(activities)
    infringements = check_weekly_driving(driver)
    assert len(infringements) == 0


def test_weekly_driving_over_56h():
    """60h de conduite en une semaine -> SI (4h excess)."""
    activities = []
    for day in range(15, 20):
        activities.append(
            make_activity(ActivityType.DRIVING, 2024, 1, day, 5, 0, 17, 0)  # 12h/jour
        )
    driver = make_driver(activities)
    infringements = check_weekly_driving(driver)
    assert len(infringements) == 1
    assert infringements[0].article == "Art. 6.2"


# === Art. 6.3 — Conduite bi-hebdomadaire ===

def test_biweekly_driving_under_90h():
    """89h sur 2 semaines -> pas d'infraction."""
    activities = []
    # Semaine 1 : 45h (5 jours x 9h)
    for day in range(15, 20):
        activities.append(
            make_activity(ActivityType.DRIVING, 2024, 1, day, 6, 0, 15, 0)
        )
    # Semaine 2 : 44h (4 jours x 11h)
    for day in range(22, 26):
        activities.append(
            make_activity(ActivityType.DRIVING, 2024, 1, day, 6, 0, 17, 0)
        )
    driver = make_driver(activities)
    infringements = check_biweekly_driving(driver)
    assert len(infringements) == 0


def test_biweekly_driving_over_90h():
    """96h sur 2 semaines -> SI (6h excess)."""
    activities = []
    # Semaine 1 : 48h (6 jours x 8h)
    for day in range(15, 21):
        activities.append(
            make_activity(ActivityType.DRIVING, 2024, 1, day, 6, 0, 14, 0)
        )
    # Semaine 2 : 48h (6 jours x 8h)
    for day in range(22, 28):
        activities.append(
            make_activity(ActivityType.DRIVING, 2024, 1, day, 6, 0, 14, 0)
        )
    driver = make_driver(activities)
    infringements = check_biweekly_driving(driver)
    assert len(infringements) == 1
    assert infringements[0].article == "Art. 6.3"
