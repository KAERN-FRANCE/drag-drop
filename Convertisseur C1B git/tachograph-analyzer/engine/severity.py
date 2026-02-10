"""Classification de gravité des infractions selon la Directive 2009/5/CE.

Les seuils sont exprimés en heures de dépassement (excess).
"""

from models.infringement import Severity


# Chaque entrée : (seuil_MI, seuil_SI, seuil_VSI)
# MI  : 0 < excess <= seuil_MI
# SI  : seuil_MI < excess <= seuil_SI
# VSI : seuil_SI < excess <= seuil_VSI
# MSI : excess > seuil_VSI
SEVERITY_THRESHOLDS = {
    "daily_driving": (1.0, 2.0, 4.5),       # Art. 6.1 : conduite journalière
    "weekly_driving": (4.0, 8.0, 12.0),      # Art. 6.2 : conduite hebdomadaire
    "biweekly_driving": (4.0, 8.0, 12.0),    # Art. 6.3 : conduite bi-hebdomadaire
    "daily_rest": (1.0, 2.5, 4.5),           # Art. 8.2 : repos journalier (manque)
    "weekly_rest": (3.0, 9.0, 18.0),         # Art. 8.6 : repos hebdomadaire (manque)
}

# La pause (Art. 7) utilise une logique différente basée sur la durée de pause prise
BREAK_SEVERITY_THRESHOLDS = {
    # (min_pause, max_pause) -> severity
    # Pause prise >= 30min mais < 45min -> MI
    # Pause prise >= 15min mais < 30min -> SI
    # Pause prise > 0 mais < 15min -> VSI
    # Aucune pause (0min) -> MSI
    "thresholds": [(30, 45, Severity.MI),
                   (15, 30, Severity.SI),
                   (0, 15, Severity.VSI)]
}


def classify_severity(rule_type: str, excess_hours: float) -> Severity:
    """Classifie la gravité d'une infraction de temps (conduite, repos).

    Args:
        rule_type: Clé dans SEVERITY_THRESHOLDS
        excess_hours: Dépassement en heures (positif)

    Returns:
        Niveau de gravité MI/SI/VSI/MSI
    """
    if excess_hours <= 0:
        raise ValueError(f"excess_hours doit être positif, reçu: {excess_hours}")

    thresholds = SEVERITY_THRESHOLDS.get(rule_type)
    if thresholds is None:
        raise ValueError(f"Type de règle inconnu: {rule_type}")

    mi_limit, si_limit, vsi_limit = thresholds

    if excess_hours <= mi_limit:
        return Severity.MI
    elif excess_hours <= si_limit:
        return Severity.SI
    elif excess_hours <= vsi_limit:
        return Severity.VSI
    else:
        return Severity.MSI


def classify_break_severity(break_taken_minutes: float) -> Severity:
    """Classifie la gravité d'une infraction de pause (Art. 7).

    Args:
        break_taken_minutes: Durée de la plus longue pause prise (en minutes)

    Returns:
        Niveau de gravité MI/SI/VSI/MSI
    """
    if break_taken_minutes >= 45:
        raise ValueError("Pas d'infraction si pause >= 45 minutes")

    if break_taken_minutes >= 30:
        return Severity.MI
    elif break_taken_minutes >= 15:
        return Severity.SI
    elif break_taken_minutes > 0:
        return Severity.VSI
    else:
        return Severity.MSI
