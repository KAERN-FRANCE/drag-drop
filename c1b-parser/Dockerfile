FROM golang:1.22-alpine AS builder

# Python + dépendances pour télécharger les certificats EU
RUN apk add --no-cache git python3 py3-pip py3-requests py3-lxml

WORKDIR /build/tachoparser

# Copier le code source Go
COPY vendor/tachoparser/ .

# Télécharger les certificats publics EU (nécessaires pour go:embed)
WORKDIR /build/tachoparser/scripts/pks1
RUN python3 dl_all_pks1.py || true

WORKDIR /build/tachoparser/scripts/pks2
RUN python3 dl_all_pks2.py || true

# Compiler le binaire Go statique
WORKDIR /build/tachoparser
RUN go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -o /build/dddparser ./cmd/dddparser

# === Image Python finale ===
FROM python:3.11-slim

WORKDIR /app

# Copier le binaire Go statique
COPY --from=builder /build/dddparser /app/bin/dddparser
RUN chmod +x /app/bin/dddparser

# Installer les dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code Python
COPY . .

# Créer le répertoire data
RUN mkdir -p /app/data/sample_files

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
