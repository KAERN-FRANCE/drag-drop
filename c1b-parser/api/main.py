"""Application FastAPI principale."""

import sys
from pathlib import Path

# Ajouter le répertoire racine au path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import infringements, reports, upload
from database.db import init_db

app = FastAPI(
    title="Tachograph Analyzer API",
    description="Analyse d'infractions tachygraphiques — Règlement (CE) 561/2006",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, tags=["Upload"])
app.include_router(infringements.router, tags=["Infractions"])
app.include_router(reports.router, tags=["Rapports"])


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def root():
    return {
        "name": "Tachograph Analyzer",
        "version": "1.0.0",
        "description": "Analyse d'infractions Règlement (CE) 561/2006",
    }
