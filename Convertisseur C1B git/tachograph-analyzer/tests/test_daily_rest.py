"""Tests pour la règle de repos journalier (Art. 8.2)."""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.rules.daily_rest import check_daily_rest
from models.activity import Activity, ActivityType, DriverActivity
from tests.conftest import make_activity, make_driver


def test_normal_daily_rest_no_infringement():
    """11h de repos -> pas d'infraction."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 15, 0),   # 9h conduite
        make_activity(ActivityType.REST, 2024, 1, 15, 15, 0, 23, 59),    # ~9h repos (partiel)
        make_activity(ActivityType.REST, 2024, 1, 16, 0, 0, 3, 0),       # +3h = 12h repos
    ]
    driver = make_driver(activities)
    infringements = check_daily_rest(driver)
    assert len(infringements) == 0


def test_reduced_daily_rest_no_infringement():
    """9h30 de repos (réduit mais accepté) -> pas d'infraction."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 15, 0),
        make_activity(ActivityType.REST, 2024, 1, 15, 15, 0, 23, 59),
        make_activity(ActivityType.REST, 2024, 1, 16, 0, 0, 0, 30),  # Total ~9h30
    ]
    driver = make_driver(activities)
    infringements = check_daily_rest(driver)
    assert len(infringements) == 0


def test_insufficient_daily_rest_infringement():
    """7h de repos -> infraction (manque 2h par rapport à 9h)."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 16, 0),   # 10h conduite
        make_activity(ActivityType.REST, 2024, 1, 15, 16, 0, 23, 0),     # 7h repos
        make_activity(ActivityType.DRIVING, 2024, 1, 16, 6, 0, 15, 0),   # Reprend
    ]
    driver = make_driver(activities)
    infringements = check_daily_rest(driver)
    assert len(infringements) >= 1
    # Au moins une infraction pour repos < 9h
    rest_infractions = [i for i in infringements if "8.2" in i.article]
    assert len(rest_infractions) >= 1
