"""Normalisation du JSON brut de tachoparser vers nos modèles Pydantic.

Gère les différentes générations (Gen1, Gen2, Gen2v2) et extrait
les activités conducteur dans un format unifié.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from models.activity import Activity, ActivityType, DriverActivity

# Mapping des types d'activité tachoparser -> nos types
ACTIVITY_TYPE_MAP = {
    0: ActivityType.REST,          # Break/Rest
    1: ActivityType.AVAILABILITY,  # Availability
    2: ActivityType.WORK,          # Work
    3: ActivityType.DRIVING,       # Driving
}

# Mapping textuel (selon le format JSON de tachoparser)
ACTIVITY_TEXT_MAP = {
    "BREAK": ActivityType.REST,
    "REST": ActivityType.REST,
    "AVAILABILITY": ActivityType.AVAILABILITY,
    "WORK": ActivityType.WORK,
    "DRIVING": ActivityType.DRIVING,
}


def _parse_timestamp(ts) -> Optional[datetime]:
    """Parse un timestamp tachoparser (secondes epoch ou string ISO)."""
    if ts is None:
        return None
    if isinstance(ts, (int, float)):
        if ts == 0:
            return None
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(ts, str):
        # Essayer plusieurs formats
        for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(ts, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return None


def _resolve_activity_type(value) -> ActivityType:
    """Résout un type d'activité depuis une valeur numérique ou textuelle."""
    if isinstance(value, int):
        return ACTIVITY_TYPE_MAP.get(value, ActivityType.UNKNOWN)
    if isinstance(value, str):
        return ACTIVITY_TEXT_MAP.get(value.upper(), ActivityType.UNKNOWN)
    return ActivityType.UNKNOWN


def _extract_driver_info_gen1(data: dict) -> Tuple[str, str]:
    """Extrait nom et numéro de carte depuis les données Gen1."""
    ident = data.get("card_identification_and_driver_card_holder_identification_1", {})

    # Essayer d'abord driver_card_holder_identification (structure réelle)
    holder = ident.get("driver_card_holder_identification", {})
    if not holder:
        holder = ident.get("card_holder_identification", {})

    # Extraire nom depuis card_holder_name
    holder_name = holder.get("card_holder_name", {})
    surname = holder_name.get("holder_surname", "")
    firstname = holder_name.get("holder_first_names", "")

    # Fallback ancien format
    if not surname:
        surname = holder.get("card_holder_surname", {}).get("name", "")
    if not firstname:
        firstname = holder.get("card_holder_first_names", {}).get("name", "")

    driver_name = f"{firstname} {surname}".strip() or "Inconnu"

    card_ident = ident.get("card_identification", {})
    card_number = card_ident.get("card_number", "")
    # Si card_number est un dict, extraire driver_identification ou owner_identification
    if isinstance(card_number, dict):
        card_number = card_number.get("driver_identification", "") or card_number.get("owner_identification", "")

    return driver_name, card_number or "UNKNOWN"


def _extract_driver_info_gen2(data: dict) -> Tuple[str, str]:
    """Extrait nom et numéro de carte depuis les données Gen2."""
    ident = data.get("card_identification_and_driver_card_holder_identification_2", {})
    if not ident:
        return "", ""

    # Essayer d'abord driver_card_holder_identification (structure réelle)
    holder = ident.get("driver_card_holder_identification", {})
    if not holder:
        holder = ident.get("card_holder_identification", {})

    # Extraire nom depuis card_holder_name
    holder_name = holder.get("card_holder_name", {})
    surname = holder_name.get("holder_surname", "")
    firstname = holder_name.get("holder_first_names", "")

    # Fallback ancien format
    if not surname:
        surname = holder.get("card_holder_surname", {}).get("name", "")
    if not firstname:
        firstname = holder.get("card_holder_first_names", {}).get("name", "")

    driver_name = f"{firstname} {surname}".strip()

    card_ident = ident.get("card_identification", {})
    card_number = card_ident.get("card_number", "")
    # Si card_number est un dict, extraire driver_identification
    if isinstance(card_number, dict):
        card_number = card_number.get("driver_identification", "")

    return driver_name, card_number


def _extract_activities_from_card_gen1(data: dict) -> List[Activity]:
    """Extrait les activités depuis card_driver_activity_1."""
    activities = []
    card_activity = data.get("card_driver_activity_1", {})
    if not card_activity:
        return activities

    # Essayer decoded_activity_daily_records d'abord (structure réelle)
    daily_records = card_activity.get("decoded_activity_daily_records") or []
    if not daily_records:
        daily_records = card_activity.get("card_driver_activity_daily_records") or []
    if not daily_records:
        daily_records = card_activity.get("activity_daily_records") or []

    for record in daily_records:
        record_date = record.get("activity_record_date", {})
        # Date du jour de l'enregistrement
        day_timestamp = _parse_timestamp(record_date)

        activity_changes = record.get("activity_change_info", [])
        if not activity_changes:
            activity_changes = record.get("card_activity_change_info", [])

        if not activity_changes or day_timestamp is None:
            continue

        # Reconstruire les activités à partir des changements
        for i, change in enumerate(activity_changes):
            # Supporter work_type (réel) et activity/activity_type (fallback)
            activity_type_val = change.get("work_type", change.get("activity", change.get("activity_type")))
            slot_begin = change.get("minutes", change.get("time", change.get("minutes_since_midnight", 0)))

            act_type = _resolve_activity_type(activity_type_val)

            # Calculer le début et la fin
            if isinstance(slot_begin, int) and slot_begin < 1440:
                # Minutes depuis minuit
                start = day_timestamp.replace(hour=0, minute=0, second=0) + timedelta(minutes=slot_begin)
            else:
                start = _parse_timestamp(slot_begin)
                if start is None:
                    continue

            # La fin est le début de l'activité suivante, ou fin de journée
            if i + 1 < len(activity_changes):
                next_change = activity_changes[i + 1]
                next_begin = next_change.get("minutes", next_change.get("time", next_change.get("minutes_since_midnight", 0)))
                if isinstance(next_begin, int) and next_begin < 1440:
                    end = day_timestamp.replace(hour=0, minute=0, second=0) + timedelta(minutes=next_begin)
                else:
                    end = _parse_timestamp(next_begin)
                    if end is None:
                        end = start + timedelta(minutes=1)
            else:
                # Dernière activité de la journée -> fin à 23:59
                end = day_timestamp.replace(hour=23, minute=59, second=0)

            if end <= start:
                continue

            duration_minutes = int((end - start).total_seconds() / 60)
            if duration_minutes <= 0:
                continue

            vehicle_reg = record.get("vehicle_registration", {}).get(
                "vehicle_registration_number", {}).get("code_page_and_text", None
            )

            activities.append(Activity(
                type=act_type,
                start=start,
                end=end,
                duration_minutes=duration_minutes,
                vehicle_registration=vehicle_reg,
            ))

    return activities


def _extract_activities_from_card_gen2(data: dict) -> List[Activity]:
    """Extrait les activités depuis card_driver_activity_2."""
    # Structure similaire à Gen1, avec des champs potentiellement différents
    activities = []
    card_activity = data.get("card_driver_activity_2", {})
    if not card_activity:
        return activities

    # Essayer decoded_activity_daily_records d'abord (structure réelle)
    daily_records = card_activity.get("decoded_activity_daily_records") or []
    if not daily_records:
        daily_records = card_activity.get("card_driver_activity_daily_records") or []
    if not daily_records:
        daily_records = card_activity.get("activity_daily_records") or []

    for record in daily_records:
        record_date = record.get("activity_record_date", {})
        day_timestamp = _parse_timestamp(record_date)

        activity_changes = record.get("activity_change_info", [])
        if not activity_changes:
            activity_changes = record.get("card_activity_change_info", [])

        if not activity_changes or day_timestamp is None:
            continue

        for i, change in enumerate(activity_changes):
            # Supporter work_type (réel) et activity/activity_type (fallback)
            activity_type_val = change.get("work_type", change.get("activity", change.get("activity_type")))
            slot_begin = change.get("minutes", change.get("time", change.get("minutes_since_midnight", 0)))

            act_type = _resolve_activity_type(activity_type_val)

            if isinstance(slot_begin, int) and slot_begin < 1440:
                start = day_timestamp.replace(hour=0, minute=0, second=0) + timedelta(minutes=slot_begin)
            else:
                start = _parse_timestamp(slot_begin)
                if start is None:
                    continue

            if i + 1 < len(activity_changes):
                next_change = activity_changes[i + 1]
                next_begin = next_change.get("minutes", next_change.get("time", next_change.get("minutes_since_midnight", 0)))
                if isinstance(next_begin, int) and next_begin < 1440:
                    end = day_timestamp.replace(hour=0, minute=0, second=0) + timedelta(minutes=next_begin)
                else:
                    end = _parse_timestamp(next_begin)
                    if end is None:
                        end = start + timedelta(minutes=1)
            else:
                end = day_timestamp.replace(hour=23, minute=59, second=0)

            if end <= start:
                continue

            duration_minutes = int((end - start).total_seconds() / 60)
            if duration_minutes <= 0:
                continue

            activities.append(Activity(
                type=act_type,
                start=start,
                end=end,
                duration_minutes=duration_minutes,
            ))

    return activities


def normalize_card_data(raw_json: dict) -> DriverActivity:
    """Normalise les données d'une carte conducteur (C1B) vers DriverActivity.

    Essaie Gen2 d'abord, puis Gen1 en fallback.
    """
    # Tenter d'extraire les infos conducteur
    driver_name, card_number = _extract_driver_info_gen2(raw_json)
    if not driver_name:
        driver_name, card_number = _extract_driver_info_gen1(raw_json)

    # Extraire les activités (fusionner Gen1 et Gen2 si les deux existent)
    activities = _extract_activities_from_card_gen2(raw_json)
    if not activities:
        activities = _extract_activities_from_card_gen1(raw_json)

    # Trier par date de début
    activities.sort(key=lambda a: a.start)

    return DriverActivity(
        driver_name=driver_name or "Inconnu",
        card_number=card_number or "UNKNOWN",
        activities=activities,
    )


def normalize_vu_data(raw_json: dict) -> List[DriverActivity]:
    """Normalise les données véhicule (DDD/V1B) vers une liste de DriverActivity.

    Un fichier VU peut contenir les activités de plusieurs conducteurs.
    Retourne une DriverActivity par conducteur identifié.
    """
    drivers: Dict[str, DriverActivity] = {}

    # Parcourir les blocs d'activités VU (Gen1 et Gen2)
    for key in ("vu_activities_1", "vu_activities_2", "vu_activities_2_v2"):
        vu_activities = raw_json.get(key)
        if not vu_activities:
            continue

        if isinstance(vu_activities, list):
            for block in vu_activities:
                _process_vu_activity_block(block, drivers)
        elif isinstance(vu_activities, dict):
            _process_vu_activity_block(vu_activities, drivers)

    return list(drivers.values())


def _process_vu_activity_block(block: dict, drivers: Dict[str, DriverActivity]) -> None:
    """Traite un bloc d'activités VU et ajoute aux conducteurs."""
    daily_records = block.get("vu_activity_daily_data", [])
    if not daily_records:
        daily_records = block.get("activity_data", [])

    for record in daily_records:
        # Identifier le conducteur
        slot1 = record.get("card_slot_1", {})
        card_number = slot1.get("card_number", {}).get("driver_identification", "UNKNOWN")
        driver_name = slot1.get("card_holder_name", {}).get("name", card_number)

        if card_number not in drivers:
            drivers[card_number] = DriverActivity(
                driver_name=driver_name,
                card_number=card_number,
                activities=[],
            )

        # Extraire les activités
        activity_changes = record.get("activity_change_info", [])
        record_date = _parse_timestamp(record.get("activity_record_date"))

        if not activity_changes or record_date is None:
            continue

        for i, change in enumerate(activity_changes):
            activity_type_val = change.get("activity", change.get("activity_type"))
            slot_begin = change.get("time", change.get("minutes_since_midnight", 0))

            act_type = _resolve_activity_type(activity_type_val)

            if isinstance(slot_begin, int) and slot_begin < 1440:
                start = record_date.replace(hour=0, minute=0, second=0) + timedelta(minutes=slot_begin)
            else:
                start = _parse_timestamp(slot_begin)
                if start is None:
                    continue

            if i + 1 < len(activity_changes):
                next_begin = activity_changes[i + 1].get(
                    "time", activity_changes[i + 1].get("minutes_since_midnight", 0)
                )
                if isinstance(next_begin, int) and next_begin < 1440:
                    end = record_date.replace(hour=0, minute=0, second=0) + timedelta(minutes=next_begin)
                else:
                    end = _parse_timestamp(next_begin)
                    if end is None:
                        end = start + timedelta(minutes=1)
            else:
                end = record_date.replace(hour=23, minute=59, second=0)

            if end <= start:
                continue

            duration_minutes = int((end - start).total_seconds() / 60)
            if duration_minutes <= 0:
                continue

            vehicle_reg = record.get("vehicle_registration_number", {}).get(
                "code_page_and_text", None
            )

            drivers[card_number].activities.append(Activity(
                type=act_type,
                start=start,
                end=end,
                duration_minutes=duration_minutes,
                vehicle_registration=vehicle_reg,
            ))
