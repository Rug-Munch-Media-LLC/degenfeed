# Conduit Matrix Homeserver — Self-hosted for DegenFeed Chat Hub
# Build: docker build -t conduit:latest .
# Uses: https://gitlab.com/famedly/conduit

FROM alpine:3.21 AS builder

WORKDIR /src
RUN apk add --no-cache curl tar

# Fetch latest Conduit binary
ARG CONDUIT_VERSION=0.9.0
RUN curl -L "https://gitlab.com/famedly/conduit/-/releases/v${CONDUIT_VERSION}/downloads/conduit-x86_64-unknown-linux-musl" \
    -o /usr/local/bin/conduit && \
    chmod +x /usr/local/bin/conduit

# Production image
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata rocksdb curl

COPY --from=builder /usr/local/bin/conduit /usr/local/bin/conduit

RUN addgroup -S conduit && adduser -S conduit -G conduit

# Conduit config
ENV CONDUIT_SERVER_NAME=degenfeed.xyz
ENV CONDUIT_PORT=8448
ENV CONDUIT_DATABASE_BACKEND=rocksdb
ENV CONDUIT_DATABASE_PATH=/var/lib/conduit/db
ENV CONDUIT_MAX_REQUEST_SIZE=20_000_000
ENV CONDUIT_ALLOW_FEDERATION=true
ENV CONDUIT_ALLOW_REGISTRATION=true
ENV CONDUIT_ALLOW_UNVERIFIED_EMAIL_REGISTRATION=true
ENV CONDUIT_TRUSTED_SERVERS=matrix.org
ENV CONDUIT_LOG=info,rocket=info,conduit_core=info
ENV RUST_LOG=info

RUN mkdir -p /var/lib/conduit/db /etc/conduit && \
    chown -R conduit:conduit /var/lib/conduit

COPY config/conduit.toml /etc/conduit/conduit.toml

EXPOSE 8448 4433

USER conduit

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8448/_matrix/client/v3/versions || exit 1

CMD ["conduit", "--config", "/etc/conduit/conduit.toml"]
