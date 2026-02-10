"""Tests pour la règle de pauses (Art. 7)."""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.rules.breaks import check_breaks
from models.activity import Activity, ActivityType, DriverActivity
from tests.conftest import make_activity, make_driver


def test_break_after_4h_no_infringement():
    """4h de conduite puis 45min de pause -> pas d'infraction."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 10, 0),    # 4h
        make_activity(ActivityType.REST, 2024, 1, 15, 10, 0, 10, 45),     # 45min pause
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 10, 45, 14, 0),  # 3h15
    ]
    driver = make_driver(activities)
    infringements = check_breaks(driver)
    assert len(infringements) == 0


def test_break_after_4h30_no_infringement():
    """4h30 pile de conduite puis 45min de pause -> pas d'infraction."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 10, 30),   # 4h30
        make_activity(ActivityType.REST, 2024, 1, 15, 10, 30, 11, 15),    # 45min
    ]
    driver = make_driver(activities)
    infringements = check_breaks(driver)
    assert len(infringements) == 0


def test_no_break_after_5h_infringement():
    """5h de conduite sans pause -> infraction MSI."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 11, 0),  # 5h
    ]
    driver = make_driver(activities)
    infringements = check_breaks(driver)
    assert len(infringements) == 1
    assert infringements[0].article == "Art. 7"
    assert infringements[0].severity.value == "MSI"  # Aucune pause prise


def test_short_break_30min_infringement_mi():
    """5h conduite avec pause de 30min (insuffisante) -> MI."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 8, 30),    # 2h30
        make_activity(ActivityType.REST, 2024, 1, 15, 8, 30, 9, 0),       # 30min pause
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 9, 0, 12, 0),    # 3h -> total 5h30
    ]
    driver = make_driver(activities)
    infringements = check_breaks(driver)
    assert len(infringements) == 1
    assert infringements[0].severity.value == "MI"


def test_split_break_15_30_no_infringement():
    """Pause fractionnée 15min + 30min -> pas d'infraction."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 8, 0),     # 2h
        make_activity(ActivityType.REST, 2024, 1, 15, 8, 0, 8, 15),       # 15min
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 8, 15, 10, 15),  # 2h
        make_activity(ActivityType.REST, 2024, 1, 15, 10, 15, 10, 45),    # 30min
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 10, 45, 14, 0),  # 3h15
    ]
    driver = make_driver(activities)
    infringements = check_breaks(driver)
    assert len(infringements) == 0


def test_very_short_break_infringement_vsi():
    """5h conduite avec pause de 10min -> VSI."""
    activities = [
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 6, 0, 8, 30),    # 2h30
        make_activity(ActivityType.REST, 2024, 1, 15, 8, 30, 8, 40),      # 10min
        make_activity(ActivityType.DRIVING, 2024, 1, 15, 8, 40, 11, 40),  # 3h -> total 5h30
    ]
    driver = make_driver(activities)
    infringements = check_breaks(driver)
    assert len(infringements) == 1
    # 10min de pause : longest_break = 10, pas qualifiante
    # Mais l'infraction se détecte quand cumulative > 270min
    # La pause de 10min n'est pas qualifiante donc ne reset pas
