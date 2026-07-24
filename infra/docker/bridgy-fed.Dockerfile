# bridgy-fed.Dockerfile — self-hosted Bridgy Fed on Talos
# Bridges ActivityPub (GotoSocial/DegenFeed) ↔ Bluesky ↔ Nostr ↔ Farcaster
#
# Usage:
#   docker build -t bridgy-fed:latest -f infra/docker/bridgy-fed.Dockerfile .
#   docker run -d --name bridgy-fed -p 8085:8080 -v bridgy-fed-data:/data \
#     -e FLASK_ENV=production \
#     -e HOST=bridgy.talos.internal \
#     bridgy-fed:latest

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv gunicorn gevent

ARG BRIDGY_FED_VERSION=main
ARG BRIDGY_FED_REPO=https://github.com/snarfed/bridgy-fed.git

RUN git clone --depth 1 --branch "${BRIDGY_FED_VERSION}" "${BRIDGY_FED_REPO}" /app

WORKDIR /app

# Use a proper shell script for conditional install
RUN if [ -f pyproject.toml ]; then \
      uv pip install --system --no-cache . ; \
    elif [ -f requirements.txt ]; then \
      pip install --no-cache-dir -r requirements.txt ; \
    fi

RUN mkdir -p /data && chown nobody:nogroup /data

EXPOSE 8080

ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

USER nobody

VOLUME ["/data"]

ENTRYPOINT ["gunicorn", \
    "--workers", "2", \
    "--threads", "20", \
    "--worker-class", "gthread", \
    "--bind", "0.0.0.0:8080", \
    "--timeout", "120", \
    "--keep-alive", "5", \
    "--max-requests", "1000", \
    "--max-requests-jitter", "100", \
    "--access-logfile", "-", \
    "--error-logfile", "-", \
    "--log-level", "info", \
    "app:app"]
