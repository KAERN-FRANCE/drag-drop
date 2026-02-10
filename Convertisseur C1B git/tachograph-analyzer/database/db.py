"""Couche base de données SQLite pour stocker les résultats d'analyse."""

import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

from models.infringement import Infringement, Severity

DB_PATH = Path(__file__).parent.parent / "data" / "tachograph.db"


def init_db(db_path: Optional[str] = None) -> None:
    """Initialise la base de données et crée les tables."""
    path = db_path or str(DB_PATH)
    conn = sqlite3.connect(path)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_name TEXT NOT NULL,
            card_number TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_infringements INTEGER DEFAULT 0,
            FOREIGN KEY (driver_id) REFERENCES drivers(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS infringements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER NOT NULL,
            driver_id INTEGER NOT NULL,
            article TEXT NOT NULL,
            rule_description TEXT NOT NULL,
            severity TEXT NOT NULL,
            value REAL NOT NULL,
            limit_value REAL NOT NULL,
            excess REAL NOT NULL,
            infringement_date DATE NOT NULL,
            details TEXT,
            FOREIGN KEY (analysis_id) REFERENCES analyses(id),
            FOREIGN KEY (driver_id) REFERENCES drivers(id)
        )
    """)

    conn.commit()
    conn.close()


@contextmanager
def get_connection(db_path: Optional[str] = None):
    """Context manager pour obtenir une connexion SQLite."""
    path = db_path or str(DB_PATH)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_or_create_driver(conn: sqlite3.Connection, driver_name: str, card_number: str) -> int:
    """Retourne l'ID du conducteur, le crée si nécessaire."""
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM drivers WHERE card_number = ?", (card_number,))
    row = cursor.fetchone()
    if row:
        return row[0]

    cursor.execute(
        "INSERT INTO drivers (driver_name, card_number) VALUES (?, ?)",
        (driver_name, card_number),
    )
    return cursor.lastrowid


def save_analysis(
    conn: sqlite3.Connection,
    driver_id: int,
    filename: str,
    file_type: str,
    infringements: List[Infringement],
) -> int:
    """Sauvegarde une analyse et ses infractions."""
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO analyses (driver_id, filename, file_type, total_infringements) VALUES (?, ?, ?, ?)",
        (driver_id, filename, file_type, len(infringements)),
    )
    analysis_id = cursor.lastrowid

    for inf in infringements:
        cursor.execute(
            """INSERT INTO infringements
               (analysis_id, driver_id, article, rule_description, severity,
                value, limit_value, excess, infringement_date, details)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                analysis_id, driver_id, inf.article, inf.rule_description,
                inf.severity.value, inf.value, inf.limit, inf.excess,
                inf.date.isoformat(), inf.details,
            ),
        )

    return analysis_id


def get_infringements_by_driver(conn: sqlite3.Connection, driver_id: int) -> List[dict]:
    """Récupère toutes les infractions d'un conducteur."""
    cursor = conn.cursor()
    cursor.execute(
        """SELECT i.*, d.driver_name, d.card_number
           FROM infringements i
           JOIN drivers d ON i.driver_id = d.id
           WHERE i.driver_id = ?
           ORDER BY i.infringement_date DESC""",
        (driver_id,),
    )
    return [dict(row) for row in cursor.fetchall()]


def get_summary(conn: sqlite3.Connection) -> Dict:
    """Résumé global des infractions."""
    cursor = conn.cursor()

    cursor.execute("SELECT severity, COUNT(*) FROM infringements GROUP BY severity")
    by_severity = {row[0]: row[1] for row in cursor.fetchall()}

    cursor.execute("SELECT article, COUNT(*) FROM infringements GROUP BY article")
    by_article = {row[0]: row[1] for row in cursor.fetchall()}

    cursor.execute("SELECT COUNT(*) FROM infringements")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT driver_id) FROM infringements")
    drivers_with_infringements = cursor.fetchone()[0]

    return {
        "total_infringements": total,
        "drivers_with_infringements": drivers_with_infringements,
        "by_severity": by_severity,
        "by_article": by_article,
    }


def get_driver_by_id(conn: sqlite3.Connection, driver_id: int) -> Optional[dict]:
    """Récupère un conducteur par son ID."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM drivers WHERE id = ?", (driver_id,))
    row = cursor.fetchone()
    return dict(row) if row else None


def get_all_drivers(conn: sqlite3.Connection) -> List[dict]:
    """Récupère tous les conducteurs."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM drivers ORDER BY driver_name")
    return [dict(row) for row in cursor.fetchall()]
