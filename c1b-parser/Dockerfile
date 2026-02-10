FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git

WORKDIR /build/tachoparser

# Copier le code source Go
COPY vendor/tachoparser/ .

# Télécharger les dépendances et compiler en binaire statique
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
