"""Moteur principal de détection d'infractions.

Orchestre toutes les règles du Règlement (CE) 561/2006 et retourne
la liste complète des infractions détectées pour un conducteur.
"""

from typing import List

from engine.rules.breaks import check_breaks
from engine.rules.daily_rest import check_daily_rest
from engine.rules.driving_time import (
    check_biweekly_driving,
    check_daily_driving,
    check_weekly_driving,
)
from engine.rules.weekly_rest import check_weekly_rest
from models.activity import DriverActivity
from models.infringement import Infringement


def analyze(driver_activity: DriverActivity) -> List[Infringement]:
    """Analyse complète des activités d'un conducteur.

    Applique toutes les règles 561/2006 et retourne les infractions
    classifiées selon la Directive 2009/5/CE.

    Args:
        driver_activity: Activités du conducteur à analyser

    Returns:
        Liste des infractions détectées, triées par date
    """
    infringements: List[Infringement] = []

    # Art. 6.1 — Temps de conduite journalier
    infringements.extend(check_daily_driving(driver_activity))

    # Art. 6.2 — Temps de conduite hebdomadaire
    infringements.extend(check_weekly_driving(driver_activity))

    # Art. 6.3 — Temps de conduite bi-hebdomadaire
    infringements.extend(check_biweekly_driving(driver_activity))

    # Art. 7 — Pauses
    infringements.extend(check_breaks(driver_activity))

    # Art. 8.2 — Repos journalier
    infringements.extend(check_daily_rest(driver_activity))

    # Art. 8.6 — Repos hebdomadaire
    infringements.extend(check_weekly_rest(driver_activity))

    # Trier par date
    infringements.sort(key=lambda i: i.date)

    return infringements


def analyze_summary(driver_activity: DriverActivity) -> dict:
    """Retourne un résumé des infractions par article et gravité."""
    infringements = analyze(driver_activity)

    summary = {
        "total": len(infringements),
        "by_severity": {"MI": 0, "SI": 0, "VSI": 0, "MSI": 0},
        "by_article": {},
        "infringements": infringements,
    }

    for inf in infringements:
        summary["by_severity"][inf.severity.value] += 1
        if inf.article not in summary["by_article"]:
            summary["by_article"][inf.article] = 0
        summary["by_article"][inf.article] += 1

    return summary
