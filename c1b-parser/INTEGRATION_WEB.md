# Intégration dans une application web

## 🎯 Vue d'ensemble

Ce système analyse des fichiers tachygraphiques (C1B/DDD/V1B) et détecte automatiquement les infractions au Règlement 561/2006. Il expose une **API REST FastAPI** que vous pouvez intégrer dans votre application web.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VOTRE APPLICATION WEB                     │
│                    (React, Vue, Angular...)                  │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP REST
                 │
┌────────────────▼────────────────────────────────────────────┐
│               API FastAPI (Python)                           │
│  - POST /upload          : Upload fichier C1B               │
│  - GET  /infringements   : Liste des infractions            │
│  - GET  /report/pdf      : Génération PDF                   │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│          Parser tachoparser (Go binaire)                     │
│  - Extrait les données brutes du fichier C1B                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Déploiement

### Option 1 : Docker (recommandé)

```bash
cd tachograph-analyzer

# Build de l'image
docker build -t tachograph-api .

# Lancement
docker run -d \
  -p 8000:8000 \
  -v $(pwd)/data:/app/data \
  --name tachograph-api \
  tachograph-api

# Vérifier que ça tourne
curl http://localhost:8000/
```

**Avantages** :
- Isolation complète
- Pas de dépendances système
- Facile à déployer en production

### Option 2 : Serveur direct (développement)

```bash
cd tachograph-analyzer

# Installer dépendances
pip3 install -r requirements.txt

# Lancer l'API
PYTHONPATH=. uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Option 3 : Production avec Gunicorn

```bash
# Installer Gunicorn
pip3 install gunicorn

# Lancer avec 4 workers
gunicorn api.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 300
```

---

## 📡 API REST — Endpoints

### 1. Health check

```http
GET /
```

**Réponse** :
```json
{
  "name": "Tachograph Analyzer",
  "version": "1.0.0",
  "description": "Analyse d'infractions Règlement (CE) 561/2006"
}
```

---

### 2. Upload et analyse d'un fichier

```http
POST /upload
Content-Type: multipart/form-data

file: <fichier C1B/DDD/V1B>
```

**Exemple JavaScript (fetch)** :
```javascript
const fileInput = document.getElementById('file');
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:8000/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

**Réponse** :
```json
{
  "filename": "fichier.C1B",
  "file_type": "card",
  "drivers_found": 1,
  "results": [
    {
      "driver_name": "FLORIAN PIERRE NIGI",
      "card_number": "1000000650871003",
      "driver_id": 1,
      "analysis_id": 1,
      "total_activities": 1169,
      "total_infringements": 46,
      "infringements": [
        {
          "article": "Art. 6.1",
          "rule_description": "Temps de conduite journalier",
          "severity": "MI",
          "value": 9.2,
          "limit": 9.0,
          "excess": 0.2,
          "date": "2025-09-26",
          "driver_name": "FLORIAN PIERRE NIGI",
          "card_number": "1000000650871003",
          "details": null
        }
      ]
    }
  ]
}
```

**Codes d'erreur** :
- `422` : Erreur de parsing du fichier
- `500` : Erreur serveur (binaire dddparser manquant)

---

### 3. Liste des conducteurs

```http
GET /drivers
```

**Réponse** :
```json
{
  "drivers": [
    {
      "id": 1,
      "driver_name": "FLORIAN PIERRE NIGI",
      "card_number": "1000000650871003",
      "created_at": "2026-02-09 17:00:00"
    }
  ]
}
```

---

### 4. Infractions d'un conducteur

```http
GET /infringements/{driver_id}
```

**Exemple** :
```bash
curl http://localhost:8000/infringements/1
```

**Réponse** :
```json
{
  "driver": {
    "id": 1,
    "driver_name": "FLORIAN PIERRE NIGI",
    "card_number": "1000000650871003"
  },
  "total": 46,
  "infringements": [
    {
      "id": 1,
      "article": "Art. 8.2",
      "rule_description": "Repos journalier insuffisant",
      "severity": "SI",
      "value": 7.4,
      "limit_value": 9.0,
      "excess": 1.6,
      "infringement_date": "2025-09-15",
      "details": null
    }
  ]
}
```

---

### 5. Résumé global

```http
GET /infringements/summary
```

**Réponse** :
```json
{
  "total_infringements": 46,
  "drivers_with_infringements": 1,
  "by_severity": {
    "MI": 15,
    "SI": 25,
    "VSI": 2,
    "MSI": 4
  },
  "by_article": {
    "Art. 8.2": 35,
    "Art. 6.1": 5,
    "Art. 6.3": 4,
    "Art. 8.6": 1,
    "Art. 7": 1
  }
}
```

---

### 6. Génération de rapport PDF

```http
GET /report/{driver_id}/pdf
```

**Exemple** :
```javascript
// Télécharger le PDF
const response = await fetch('http://localhost:8000/report/1/pdf');
const blob = await response.blob();

// Créer un lien de téléchargement
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'rapport_infractions.pdf';
a.click();
```

**Format PDF** :
- Infos conducteur (nom, carte)
- Résumé par gravité (tableau)
- Détail des infractions (date, article, valeurs)
- Footer avec date de génération

---

## 💻 Intégration frontend

### Exemple React

```typescript
// components/TachographAnalyzer.tsx
import React, { useState } from 'react';

interface Infringement {
  article: string;
  rule_description: string;
  severity: 'MI' | 'SI' | 'VSI' | 'MSI';
  value: number;
  limit: number;
  excess: number;
  date: string;
}

const TachographAnalyzer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('Erreur lors de l\'analyse du fichier');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      MI: 'bg-yellow-100 text-yellow-800',
      SI: 'bg-orange-100 text-orange-800',
      VSI: 'bg-red-100 text-red-800',
      MSI: 'bg-purple-100 text-purple-800'
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100';
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Analyse tachygraphique
      </h1>

      {/* Upload */}
      <div className="mb-6">
        <input
          type="file"
          accept=".C1B,.c1b,.DDD,.ddd,.V1B,.v1b"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-4"
        />
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Analyse en cours...' : 'Analyser'}
        </button>
      </div>

      {/* Résultats */}
      {results && results.results[0] && (
        <div>
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {results.results[0].driver_name}
            </h2>
            <p className="text-gray-600">
              Carte: {results.results[0].card_number}
            </p>
            <p className="text-gray-600">
              Activités: {results.results[0].total_activities}
            </p>
            <p className="text-lg font-bold mt-2">
              Infractions: {results.results[0].total_infringements}
            </p>
          </div>

          {/* Liste des infractions */}
          <div className="space-y-4">
            {results.results[0].infringements.map((inf: Infringement, idx: number) => (
              <div
                key={idx}
                className="bg-white shadow rounded-lg p-4 border-l-4 border-gray-300"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getSeverityColor(inf.severity)}`}
                    >
                      {inf.severity}
                    </span>
                    <span className="ml-2 font-semibold">{inf.article}</span>
                  </div>
                  <span className="text-gray-500">{inf.date}</span>
                </div>
                <p className="mt-2 text-gray-700">{inf.rule_description}</p>
                <div className="mt-2 text-sm text-gray-600">
                  <span>Valeur: {inf.value}h</span>
                  <span className="mx-2">|</span>
                  <span>Limite: {inf.limit}h</span>
                  <span className="mx-2">|</span>
                  <span className="text-red-600">Excès: +{inf.excess}h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TachographAnalyzer;
```

---

## 🔒 Sécurité & bonnes pratiques

### 1. Validation des fichiers

```python
# Limiter la taille des uploads (dans api/routes/upload.py)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

if file.size > MAX_FILE_SIZE:
    raise HTTPException(400, "Fichier trop volumineux")
```

### 2. CORS (si frontend sur domaine différent)

```python
# api/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://votre-app.com"],  # Limiter aux domaines autorisés
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3. Rate limiting

```bash
pip install slowapi

# api/main.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/upload")
@limiter.limit("5/minute")  # Max 5 uploads/min
async def upload_file(...):
    ...
```

### 4. Authentification (recommandée)

```python
# Ajouter JWT ou OAuth2
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/upload")
async def upload_file(
    file: UploadFile,
    token: str = Depends(oauth2_scheme)
):
    # Vérifier token avant analyse
    ...
```

---

## 📊 Monitoring & Logs

### Logs structurés

```python
# Ajouter dans api/main.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Dans les routes
logger.info(f"Upload fichier {file.filename} par utilisateur {user_id}")
logger.error(f"Erreur parsing: {e}")
```

### Métriques (Prometheus)

```bash
pip install prometheus-fastapi-instrumentator

# api/main.py
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)
```

Accès métriques : `http://localhost:8000/metrics`

---

## 🐛 Gestion des erreurs

### Codes d'erreur standardisés

| Code | Signification | Action frontend |
|------|---------------|-----------------|
| 200  | Succès | Afficher résultats |
| 400  | Fichier invalide | Message erreur utilisateur |
| 404  | Conducteur non trouvé | Rediriger |
| 422  | Erreur parsing C1B | "Fichier corrompu" |
| 500  | Erreur serveur | Réessayer plus tard |

### Exemple gestion erreur frontend

```typescript
try {
  const response = await fetch('/upload', { method: 'POST', body: formData });

  if (!response.ok) {
    const error = await response.json();

    if (response.status === 422) {
      alert('Fichier C1B corrompu ou non supporté');
    } else if (response.status === 500) {
      alert('Erreur serveur. Réessayez dans quelques instants.');
    } else {
      alert(error.detail || 'Erreur inconnue');
    }

    return;
  }

  const data = await response.json();
  // Traiter les résultats...

} catch (error) {
  alert('Erreur réseau. Vérifiez votre connexion.');
}
```

---

## 🚨 Limitations à communiquer aux utilisateurs

### Disclaimer à afficher

```html
<div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
  <div class="flex">
    <div class="flex-shrink-0">
      ⚠️
    </div>
    <div class="ml-3">
      <p class="text-sm text-yellow-700">
        <strong>Attention :</strong> Cette analyse automatique est indicative
        et doit être vérifiée manuellement. Ne pas utiliser comme unique preuve
        pour sanctions disciplinaires ou amendes.
      </p>
      <p class="text-xs text-yellow-600 mt-2">
        Fiabilité estimée : 65-70% • Système non certifié
      </p>
    </div>
  </div>
</div>
```

---

## 📦 Base de données

### Schéma SQLite (déjà implémenté)

```sql
CREATE TABLE drivers (
    id INTEGER PRIMARY KEY,
    driver_name TEXT,
    card_number TEXT UNIQUE,
    created_at TIMESTAMP
);

CREATE TABLE analyses (
    id INTEGER PRIMARY KEY,
    driver_id INTEGER,
    filename TEXT,
    file_type TEXT,
    analyzed_at TIMESTAMP,
    total_infringements INTEGER,
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
);

CREATE TABLE infringements (
    id INTEGER PRIMARY KEY,
    analysis_id INTEGER,
    driver_id INTEGER,
    article TEXT,
    severity TEXT,
    value REAL,
    limit_value REAL,
    excess REAL,
    infringement_date DATE,
    details TEXT,
    FOREIGN KEY (analysis_id) REFERENCES analyses(id)
);
```

### Migration vers PostgreSQL (si besoin)

```python
# Remplacer SQLite par PostgreSQL
# requirements.txt
asyncpg==0.28.0
psycopg2-binary==2.9.9

# database/db.py
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost/tachograph"
)
```

---

## ✅ Checklist d'intégration

Avant déploiement :

- [ ] API accessible (tester avec `curl http://localhost:8000/`)
- [ ] Upload fonctionne avec fichier C1B test
- [ ] CORS configuré pour votre domaine
- [ ] Disclaimer visible côté frontend
- [ ] Gestion d'erreurs robuste
- [ ] Logs activés
- [ ] Rate limiting configuré
- [ ] Base de données initialisée
- [ ] Docker image buildée et testée
- [ ] Documentation API accessible (`/docs`)

---

## 📞 Support

Questions d'intégration :
- Documentation OpenAPI : `http://localhost:8000/docs`
- Swagger UI : `http://localhost:8000/redoc`
- Issues GitHub : (lien vers repo)

---

**VERSION API : 1.0.0**
**COMPATIBILITÉ : FastAPI 0.104+, Python 3.9+**
