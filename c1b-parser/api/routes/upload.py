"""Route d'upload et d'analyse de fichiers tachygraphiques."""

import os
import shutil
import tempfile
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile

from database.db import get_connection, get_or_create_driver, save_analysis
from engine.infringement_engine import analyze
from models.infringement import Infringement
from parser.json_normalizer import normalize_card_data, normalize_vu_data
from parser.tacho_parser import TachoParserError, detect_file_type, parse_file

router = APIRouter()


@router.post("/parse")
async def parse_only(file: UploadFile = File(...)):
    """Parse un fichier C1B/DDD/V1B et retourne les activités brutes.

    Pas d'analyse d'infractions — le frontend utilise son propre algorithme.
    """
    suffix = os.path.splitext(file.filename or "file")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        file_type = detect_file_type(file.filename or tmp_path)

        try:
            raw_json = parse_file(tmp_path, file_type=file_type)
        except TachoParserError as e:
            raise HTTPException(status_code=422, detail=f"Erreur de parsing: {e}")
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=str(e))

        results = []

        if file_type == "card":
            driver_activity = normalize_card_data(raw_json)
            results.append({
                "driver_name": driver_activity.driver_name,
                "card_number": driver_activity.card_number,
                "activities": [
                    {
                        "type": a.type.value,
                        "start": a.start.isoformat(),
                        "end": a.end.isoformat(),
                        "duration_minutes": a.duration_minutes,
                        "vehicle_registration": a.vehicle_registration,
                    }
                    for a in driver_activity.activities
                ],
            })
        else:
            driver_activities = normalize_vu_data(raw_json)
            for driver_activity in driver_activities:
                results.append({
                    "driver_name": driver_activity.driver_name,
                    "card_number": driver_activity.card_number,
                    "activities": [
                        {
                            "type": a.type.value,
                            "start": a.start.isoformat(),
                            "end": a.end.isoformat(),
                            "duration_minutes": a.duration_minutes,
                            "vehicle_registration": a.vehicle_registration,
                        }
                        for a in driver_activity.activities
                    ],
                })

        return {
            "filename": file.filename,
            "file_type": file_type,
            "drivers_found": len(results),
            "results": results,
        }

    finally:
        os.unlink(tmp_path)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload un fichier C1B/DDD/V1B, le parse et analyse les infractions.

    Returns:
        Résultat de l'analyse avec les infractions détectées
    """
    # Sauvegarder le fichier temporairement
    suffix = os.path.splitext(file.filename or "file")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # Détecter le type et parser
        file_type = detect_file_type(file.filename or tmp_path)

        try:
            raw_json = parse_file(tmp_path, file_type=file_type)
        except TachoParserError as e:
            raise HTTPException(status_code=422, detail=f"Erreur de parsing: {e}")
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=str(e))

        # Normaliser et analyser
        results = []

        if file_type == "card":
            driver_activity = normalize_card_data(raw_json)
            infringements = analyze(driver_activity)

            # Sauvegarder en BDD
            with get_connection() as conn:
                driver_id = get_or_create_driver(
                    conn, driver_activity.driver_name, driver_activity.card_number
                )
                analysis_id = save_analysis(
                    conn, driver_id, file.filename or "unknown",
                    file_type, infringements
                )

            results.append({
                "driver_name": driver_activity.driver_name,
                "card_number": driver_activity.card_number,
                "driver_id": driver_id,
                "analysis_id": analysis_id,
                "total_activities": len(driver_activity.activities),
                "total_infringements": len(infringements),
                "infringements": [inf.dict() for inf in infringements],
            })

        else:
            # VU : peut contenir plusieurs conducteurs
            driver_activities = normalize_vu_data(raw_json)
            for driver_activity in driver_activities:
                infringements = analyze(driver_activity)

                with get_connection() as conn:
                    driver_id = get_or_create_driver(
                        conn, driver_activity.driver_name, driver_activity.card_number
                    )
                    analysis_id = save_analysis(
                        conn, driver_id, file.filename or "unknown",
                        file_type, infringements
                    )

                results.append({
                    "driver_name": driver_activity.driver_name,
                    "card_number": driver_activity.card_number,
                    "driver_id": driver_id,
                    "analysis_id": analysis_id,
                    "total_activities": len(driver_activity.activities),
                    "total_infringements": len(infringements),
                    "infringements": [inf.dict() for inf in infringements],
                })

        return {
            "filename": file.filename,
            "file_type": file_type,
            "drivers_found": len(results),
            "results": results,
        }

    finally:
        os.unlink(tmp_path)
