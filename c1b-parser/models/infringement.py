"""Modèles de données pour les infractions détectées."""

from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class Severity(str, Enum):
    MI = "MI"    # Minor Infringement
    SI = "SI"    # Serious Infringement
    VSI = "VSI"  # Very Serious Infringement
    MSI = "MSI"  # Most Serious Infringement


class Infringement(BaseModel):
    """Une infraction détectée par le moteur de règles."""
    article: str               # ex: "Art. 6.1"
    rule_description: str      # ex: "Temps de conduite journalier"
    severity: Severity
    value: float               # Valeur constatée en heures (ex: 10.5)
    limit: float               # Limite réglementaire en heures (ex: 9.0)
    excess: float              # Dépassement en heures (ex: 1.5)
    date: date
    driver_name: str
    card_number: str
    details: Optional[str] = None
