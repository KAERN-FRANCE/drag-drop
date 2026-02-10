"""Wrapper Python autour de l'exécutable Go dddparser (tachoparser).

Appelle le binaire dddparser en subprocess et retourne le JSON brut.
"""

import json
import os
import subprocess
from pathlib import Path
from typing import Optional


# Chemin par défaut vers le binaire dddparser
DEFAULT_BINARY_PATH = Path(__file__).parent.parent / "bin" / "dddparser"


class TachoParserError(Exception):
    """Erreur lors du parsing d'un fichier tachygraphique."""
    pass


def detect_file_type(file_path: str) -> str:
    """Détecte le type de fichier tachygraphique.

    Returns:
        "card" pour les fichiers carte conducteur (C1B)
        "vu" pour les fichiers véhicule (DDD, V1B)
    """
    ext = Path(file_path).suffix.lower()
    if ext in (".c1b",):
        return "card"
    elif ext in (".ddd", ".v1b"):
        return "vu"
    else:
        # Tenter de détecter par le contenu
        # Les fichiers carte commencent généralement par des tags TLV spécifiques
        # Pour l'instant, on assume "card" par défaut pour les fichiers inconnus
        return "card"


def parse_file(
    file_path: str,
    file_type: Optional[str] = None,
    binary_path: Optional[str] = None,
    pretty: bool = False,
) -> dict:
    """Parse un fichier tachygraphique et retourne le JSON.

    Args:
        file_path: Chemin vers le fichier C1B/DDD/V1B
        file_type: "card" ou "vu" (auto-détecté si None)
        binary_path: Chemin vers le binaire dddparser (défaut: bin/dddparser)
        pretty: Si True, demande un JSON formaté (flag -format)

    Returns:
        Dictionnaire JSON parsé

    Raises:
        TachoParserError: Si le parsing échoue
        FileNotFoundError: Si le fichier ou le binaire n'existe pas
    """
    if binary_path is None:
        binary_path = str(DEFAULT_BINARY_PATH)

    if not os.path.isfile(binary_path):
        raise FileNotFoundError(
            f"Binaire dddparser non trouvé: {binary_path}. "
            "Compilez tachoparser avec: cd vendor/tachoparser/cmd/dddparser && go build ."
        )

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Fichier tachygraphique non trouvé: {file_path}")

    if file_type is None:
        file_type = detect_file_type(file_path)

    # Construire la commande
    cmd = [binary_path, f"-{file_type}", "-input", file_path]
    if pretty:
        cmd.append("-format")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        raise TachoParserError(f"Timeout lors du parsing de {file_path}")

    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")
        raise TachoParserError(
            f"dddparser a retourné le code {result.returncode}: {stderr}"
        )

    stdout = result.stdout.decode("utf-8", errors="replace")
    if not stdout.strip():
        raise TachoParserError(f"dddparser n'a produit aucune sortie pour {file_path}")

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as e:
        raise TachoParserError(f"JSON invalide retourné par dddparser: {e}")
