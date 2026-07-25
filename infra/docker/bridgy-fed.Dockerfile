# bridgy-fed.Dockerfile v9 — self-hosted Bridgy Fed
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git build-essential libffi-dev libssl-dev curl && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv gunicorn gevent

ARG BRIDGY_FED_VERSION=main
ARG BRIDGY_FED_REPO=https://github.com/snarfed/bridgy-fed.git

RUN git clone --depth 1 --branch "${BRIDGY_FED_VERSION}" "${BRIDGY_FED_REPO}" /app
WORKDIR /app

RUN uv pip install --system --no-cache --no-sources .[app]

# Remove PyPI problem packages and install snarfed forks
RUN pip uninstall -y negotiator httpsig granary 2>/dev/null || true
RUN pip install --no-cache-dir setuptools==75.8.2
RUN pip install --no-cache-dir git+https://github.com/snarfed/negotiator.git
RUN pip install --no-cache-dir git+https://github.com/snarfed/httpsig.git
RUN pip install --no-cache-dir git+https://github.com/snarfed/granary.git

# Patch httpsig to avoid pkg_resources issue
RUN python3 << 'PYEOF'
with open('/usr/local/lib/python3.12/site-packages/httpsig/__init__.py') as f:
    content = f.read()
content = content.replace(
    'from pkg_resources import get_distribution, DistributionNotFound',
    'from importlib.metadata import version as get_distribution, PackageNotFoundError as DistributionNotFound'
)
content = content.replace(
    "__version__ = get_distribution(__name__).version",
    '__version__ = "0.9.3"',
)
with open('/usr/local/lib/python3.12/site-packages/httpsig/__init__.py', 'w') as f:
    f.write(content)
print('httpsig patched')
PYEOF

RUN python3 -c "from negotiator import ContentNegotiator; print('negotiator OK')"
RUN python3 -c "from httpsig import HeaderSigner; print('httpsig OK')"

RUN mkdir -p /data && chown -R nobody:nogroup /data
RUN ln -sf /usr/local/lib/python3.12/site-packages/oauth_dropins/static /app/oauth_dropins_static

EXPOSE 8080
ENV FLASK_ENV=development
ENV PYTHONUNBUFFERED=1
ENV DATASTORE_EMULATOR_HOST=localhost:8089
ENV DATASTORE_DATASET=bridgy-federated
ENV DATASTORE_PROJECT_ID=bridgy-federated

USER nobody
VOLUME ["/data"]
ENTRYPOINT ["gunicorn", "app:app", "--bind", "0.0.0.0:8080", "--workers", "2", "--threads", "20", "--timeout", "120", "--log-level", "debug", "--access-logfile", "-", "--error-logfile", "-"]
