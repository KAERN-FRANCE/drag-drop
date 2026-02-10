"""Fixtures partagées pour les tests."""

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

# Ajouter le répertoire racine au path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.activity import Activity, ActivityType, DriverActivity


def make_activity(
    act_type: ActivityType,
    year: int, month: int, day: int,
    start_hour: int, start_min: int,
    end_hour: int, end_min: int,
) -> Activity:
    """Helper pour créer une activité facilement."""
    start = datetime(year, month, day, start_hour, start_min, tzinfo=timezone.utc)
    # Gérer le cas où end est le lendemain
    if end_hour < start_hour or (end_hour == start_hour and end_min < start_min):
        from datetime import timedelta
        end = datetime(year, month, day, end_hour, end_min, tzinfo=timezone.utc) + timedelta(days=1)
    else:
        end = datetime(year, month, day, end_hour, end_min, tzinfo=timezone.utc)
    duration = int((end - start).total_seconds() / 60)
    return Activity(type=act_type, start=start, end=end, duration_minutes=duration)


def make_driver(activities, name="Test Driver", card="TEST0001") -> DriverActivity:
    """Helper pour créer un DriverActivity."""
    return DriverActivity(driver_name=name, card_number=card, activities=activities)
