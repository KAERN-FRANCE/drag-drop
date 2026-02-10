"""Modèles de données pour les activités conducteur tachygraphiques."""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class ActivityType(str, Enum):
    DRIVING = "DRIVING"
    WORK = "WORK"
    AVAILABILITY = "AVAILABILITY"
    REST = "REST"
    UNKNOWN = "UNKNOWN"


class Activity(BaseModel):
    """Une activité individuelle du conducteur."""
    type: ActivityType
    start: datetime
    end: datetime
    duration_minutes: int
    vehicle_registration: Optional[str] = None

    @property
    def duration_hours(self) -> float:
        return self.duration_minutes / 60.0


class DriverActivity(BaseModel):
    """Ensemble des activités d'un conducteur extraites d'un fichier tachygraphique."""
    driver_name: str
    card_number: str
    activities: List[Activity]

    def driving_activities(self) -> List[Activity]:
        return [a for a in self.activities if a.type == ActivityType.DRIVING]

    def rest_activities(self) -> List[Activity]:
        return [a for a in self.activities if a.type == ActivityType.REST]
