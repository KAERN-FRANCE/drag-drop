"""Routes pour consulter les infractions."""

from fastapi import APIRouter, HTTPException

from database.db import (
    get_all_drivers,
    get_connection,
    get_driver_by_id,
    get_infringements_by_driver,
    get_summary,
)

router = APIRouter()


@router.get("/infringements/summary")
def infringements_summary():
    """Résumé global des infractions (par gravité, par article)."""
    with get_connection() as conn:
        return get_summary(conn)


@router.get("/infringements/{driver_id}")
def driver_infringements(driver_id: int):
    """Liste des infractions d'un conducteur."""
    with get_connection() as conn:
        driver = get_driver_by_id(conn, driver_id)
        if not driver:
            raise HTTPException(status_code=404, detail="Conducteur non trouvé")

        infringements = get_infringements_by_driver(conn, driver_id)

    return {
        "driver": driver,
        "total": len(infringements),
        "infringements": infringements,
    }


@router.get("/drivers")
def list_drivers():
    """Liste tous les conducteurs enregistrés."""
    with get_connection() as conn:
        drivers = get_all_drivers(conn)
    return {"drivers": drivers}
