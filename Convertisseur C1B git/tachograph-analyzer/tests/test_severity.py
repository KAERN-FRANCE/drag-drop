"""Tests pour la classification de gravité."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from engine.severity import classify_break_severity, classify_severity
from models.infringement import Severity


# === classify_severity ===

def test_daily_driving_mi():
    assert classify_severity("daily_driving", 0.5) == Severity.MI

def test_daily_driving_si():
    assert classify_severity("daily_driving", 1.5) == Severity.SI

def test_daily_driving_vsi():
    assert classify_severity("daily_driving", 3.0) == Severity.VSI

def test_daily_driving_msi():
    assert classify_severity("daily_driving", 5.0) == Severity.MSI

def test_daily_driving_boundary_mi():
    """Exactement 1h -> MI (inclus)."""
    assert classify_severity("daily_driving", 1.0) == Severity.MI

def test_daily_driving_boundary_si():
    """Exactement 2h -> SI (inclus)."""
    assert classify_severity("daily_driving", 2.0) == Severity.SI

def test_weekly_driving_mi():
    assert classify_severity("weekly_driving", 2.0) == Severity.MI

def test_weekly_driving_msi():
    assert classify_severity("weekly_driving", 13.0) == Severity.MSI

def test_daily_rest_mi():
    assert classify_severity("daily_rest", 0.5) == Severity.MI

def test_daily_rest_vsi():
    assert classify_severity("daily_rest", 3.0) == Severity.VSI

def test_weekly_rest_si():
    assert classify_severity("weekly_rest", 5.0) == Severity.SI

def test_invalid_rule_type():
    with pytest.raises(ValueError):
        classify_severity("invalid", 1.0)

def test_zero_excess():
    with pytest.raises(ValueError):
        classify_severity("daily_driving", 0)

def test_negative_excess():
    with pytest.raises(ValueError):
        classify_severity("daily_driving", -1.0)


# === classify_break_severity ===

def test_break_mi():
    """Pause de 35min (>= 30 et < 45) -> MI."""
    assert classify_break_severity(35) == Severity.MI

def test_break_si():
    """Pause de 20min (>= 15 et < 30) -> SI."""
    assert classify_break_severity(20) == Severity.SI

def test_break_vsi():
    """Pause de 10min (> 0 et < 15) -> VSI."""
    assert classify_break_severity(10) == Severity.VSI

def test_break_msi():
    """Aucune pause (0min) -> MSI."""
    assert classify_break_severity(0) == Severity.MSI

def test_break_no_infringement():
    """Pause >= 45min -> pas d'infraction (erreur)."""
    with pytest.raises(ValueError):
        classify_break_severity(45)
