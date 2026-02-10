"""Règle de pauses — Article 7 du Règlement (CE) 561/2006.

Art. 7 : Après 4h30 de conduite, le conducteur doit prendre une pause
d'au moins 45 minutes (ou fractionnée : 15min puis 30min).
"""

from datetime import timedelta
from typing import List

from engine.severity import classify_break_severity
from models.activity import Activity, ActivityType, DriverActivity
from models.infringement import Infringement

MAX_DRIVING_BEFORE_BREAK = 4.5 * 60  # 4h30 en minutes
QUALIFYING_BREAK = 45  # minutes


def _is_rest_or_break(activity: Activity) -> bool:
    """Une pause qualifiante peut être REST ou AVAILABILITY."""
    return activity.type in (ActivityType.REST, ActivityType.AVAILABILITY)


def check_breaks(driver: DriverActivity) -> List[Infringement]:
    """Art. 7 : Vérifie les pauses après 4h30 de conduite.

    Logique :
    - On suit la conduite cumulative depuis la dernière pause qualifiante (>=45min)
    - On gère aussi les pauses fractionnées (>=15min puis >=30min)
    - Si conduite cumulative > 4h30 sans pause qualifiante -> infraction
    """
    infringements = []
    sorted_activities = sorted(driver.activities, key=lambda a: a.start)

    cumulative_driving_minutes = 0.0
    longest_break_since_reset = 0.0
    first_split_taken = False  # Pour la pause fractionnée 15+30
    split_first_part = 0.0
    driving_start_date = None

    for act in sorted_activities:
        if act.type == ActivityType.DRIVING:
            if driving_start_date is None:
                driving_start_date = act.start.date()
            cumulative_driving_minutes += act.duration_minutes

            # Vérifier si on dépasse 4h30 sans pause qualifiante
            if cumulative_driving_minutes > MAX_DRIVING_BEFORE_BREAK:
                # Infraction détectée
                severity = classify_break_severity(longest_break_since_reset)
                excess_minutes = cumulative_driving_minutes - MAX_DRIVING_BEFORE_BREAK
                infringements.append(Infringement(
                    article="Art. 7",
                    rule_description="Pause insuffisante après 4h30 de conduite",
                    severity=severity,
                    value=round(cumulative_driving_minutes / 60.0, 2),
                    limit=4.5,
                    excess=round(excess_minutes / 60.0, 2),
                    date=act.start.date(),
                    driver_name=driver.driver_name,
                    card_number=driver.card_number,
                    details=f"Plus longue pause prise: {longest_break_since_reset:.0f}min",
                ))
                # Reset après infraction (le conducteur reprend un nouveau cycle)
                cumulative_driving_minutes = 0.0
                longest_break_since_reset = 0.0
                first_split_taken = False
                split_first_part = 0.0
                driving_start_date = None

        elif _is_rest_or_break(act):
            break_minutes = act.duration_minutes

            if break_minutes > longest_break_since_reset:
                longest_break_since_reset = break_minutes

            # Pause qualifiante complète (>= 45min) -> reset
            if break_minutes >= QUALIFYING_BREAK:
                cumulative_driving_minutes = 0.0
                longest_break_since_reset = 0.0
                first_split_taken = False
                split_first_part = 0.0
                driving_start_date = None
                continue

            # Pause fractionnée : première partie >= 15min
            if not first_split_taken and break_minutes >= 15:
                first_split_taken = True
                split_first_part = break_minutes
                continue

            # Pause fractionnée : deuxième partie >= 30min (après une première >= 15min)
            if first_split_taken and break_minutes >= 30:
                # La pause fractionnée 15+30 est qualifiante -> reset
                cumulative_driving_minutes = 0.0
                longest_break_since_reset = 0.0
                first_split_taken = False
                split_first_part = 0.0
                driving_start_date = None

    return infringements
