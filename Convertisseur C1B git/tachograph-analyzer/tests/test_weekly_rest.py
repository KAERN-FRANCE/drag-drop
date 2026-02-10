"""Tests pour la règle de repos hebdomadaire (Art. 8.6)."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.rules.weekly_rest import check_weekly_rest
from models.activity import Activity, ActivityType, DriverActivity
from tests.conftest import make_activity, make_driver


def test_normal_weekly_rest_no_infringement():
    """45h de repos hebdomadaire -> pas d'infraction."""
    activities = [
        # Semaine de travail
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 15, 0),
        make_activity(ActivityType.REST, 2024, 1, 15, 15, 0, 23, 59),
        make_activity(ActivityType.DRIVING, 2024, 1, 16, 6, 0, 15, 0),
        make_activity(ActivityType.REST, 2024, 1, 16, 15, 0, 23, 59),
        make_activity(ActivityType.DRIVING, 2024, 1, 17, 6, 0, 15, 0),
        make_activity(ActivityType.REST, 2024, 1, 17, 15, 0, 23, 59),
        make_activity(ActivityType.DRIVING, 2024, 1, 18, 6, 0, 15, 0),
        make_activity(ActivityType.REST, 2024, 1, 18, 15, 0, 23, 59),
        make_activity(ActivityType.DRIVING, 2024, 1, 19, 6, 0, 15, 0),
        # Repos hebdomadaire : vendredi 15h -> dimanche 12h = 45h
        make_activity(ActivityType.REST, 2024, 1, 19, 15, 0, 23, 59),
        make_activity(ActivityType.REST, 2024, 1, 20, 0, 0, 23, 59),
        make_activity(ActivityType.REST, 2024, 1, 21, 0, 0, 12, 0),
    ]
    driver = make_driver(activities)
    infringements = check_weekly_rest(driver)
    assert len(infringements) == 0


def test_no_weekly_rest_infringement():
    """7 jours de conduite sans repos >= 24h -> infraction."""
    activities = []
    for day in range(15, 23):  # 8 jours
        activities.append(
            make_activity(ActivityType.DRIVING, 2024, 1, day, 6, 0, 15, 0)
        )
        activities.append(
            make_activity(ActivityType.REST, 2024, 1, day, 15, 0, 23, 0)  # 8h repos (< 24h)
        )
    driver = make_driver(activities)
    infringements = check_weekly_rest(driver)
    # Devrait détecter un manque de repos hebdomadaire
    assert len(infringements) >= 1


def test_reduced_weekly_rest_no_infringement():
    """24h de repos réduit -> pas d'infraction immédiate (à compenser)."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 15, 0),
        make_activity(ActivityType.REST, 2024, 1, 15, 15, 0, 23, 59),
        make_activity(ActivityType.DRIVING, 2024, 1, 16, 6, 0, 15, 0),
        make_activity(ActivityType.REST, 2024, 1, 16, 15, 0, 23, 59),
        make_activity(ActivityType.DRIVING, 2024, 1, 17, 6, 0, 15, 0),
        make_activity(ActivityType.REST, 2024, 1, 17, 15, 0, 23, 59),
        make_activity(ActivityType.DRIVING, 2024, 1, 18, 6, 0, 15, 0),
        make_activity(ActivityType.REST, 2024, 1, 18, 15, 0, 23, 59),
        make_activity(ActivityType.DRIVING, 2024, 1, 19, 6, 0, 15, 0),
        # Repos de 24h (réduit)
        make_activity(ActivityType.REST, 2024, 1, 19, 15, 0, 23, 59),
        make_activity(ActivityType.REST, 2024, 1, 20, 0, 0, 15, 0),
    ]
    driver = make_driver(activities)
    infringements = check_weekly_rest(driver)
    assert len(infringements) == 0
