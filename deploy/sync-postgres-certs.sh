#!/bin/sh
# Copies the TLS certificate the host's Caddy already manages into a place PostgreSQL
# can read, and keeps it current.
#
# Two constraints make a copy necessary rather than a direct mount:
#   - PostgreSQL refuses to start if the private key is group- or world-readable, and
#     Caddy's storage is owned by Caddy with its own permissions.
#   - The container's postgres user (uid 999) is not the owner of Caddy's files.
#
# Caddy renews roughly every 60 days without announcing it, so this re-checks on an
# interval and asks PostgreSQL to reload only when the certificate actually changed.
set -eu

DOMAIN="${CERT_DOMAIN:?CERT_DOMAIN is required}"
SOURCE_DIR="${CERT_SOURCE_DIR:-/caddy-certs}"
TARGET_DIR="${CERT_TARGET_DIR:-/certs}"
INTERVAL="${CERT_SYNC_INTERVAL:-43200}"   # 12 hours
# Ask the image rather than assuming: the Debian PostgreSQL image runs as uid 999 and
# the Alpine one as 70, and PostgreSQL rejects a key it does not own.
POSTGRES_UID="${POSTGRES_UID:-$(id -u postgres 2>/dev/null || echo 999)}"
# once  — install the certificate and exit, so PostgreSQL can start with it present
# watch — keep running and reinstall when Caddy renews
MODE="${CERT_SYNC_MODE:-watch}"
# How long the one-shot mode waits for Caddy to have issued a certificate at all.
WAIT_TIMEOUT="${CERT_WAIT_TIMEOUT:-120}"

find_cert() {
  # Caddy nests certificates under an issuer directory whose name changes between
  # staging and production ACME, so search rather than hard-coding the path.
  find "$SOURCE_DIR" -type f -name "${DOMAIN}.crt" 2>/dev/null | head -n 1
}

sync_once() {
  cert="$(find_cert)"
  if [ -z "$cert" ]; then
    echo "no certificate for ${DOMAIN} under ${SOURCE_DIR} yet"
    return 1
  fi
  key="${cert%.crt}.key"
  [ -f "$key" ] || { echo "certificate found but ${key} is missing"; return 1; }

  if [ -f "${TARGET_DIR}/server.crt" ] && cmp -s "$cert" "${TARGET_DIR}/server.crt"; then
    return 2   # unchanged
  fi

  cp "$cert" "${TARGET_DIR}/server.crt.tmp"
  cp "$key" "${TARGET_DIR}/server.key.tmp"
  chown "${POSTGRES_UID}:${POSTGRES_UID}" "${TARGET_DIR}/server.crt.tmp" "${TARGET_DIR}/server.key.tmp"
  chmod 644 "${TARGET_DIR}/server.crt.tmp"
  chmod 600 "${TARGET_DIR}/server.key.tmp"
  # Move into place only once both files are complete, so PostgreSQL never reads a
  # half-written pair during a reload.
  mv "${TARGET_DIR}/server.crt.tmp" "${TARGET_DIR}/server.crt"
  mv "${TARGET_DIR}/server.key.tmp" "${TARGET_DIR}/server.key"
  echo "installed certificate for ${DOMAIN}"
  return 0
}

if [ "$MODE" = "once" ]; then
  # PostgreSQL refuses to start when ssl=on and the files are missing, so block until
  # they exist rather than letting the database fail its healthcheck in a loop.
  waited=0
  while [ "$waited" -lt "$WAIT_TIMEOUT" ]; do
    set +e
    sync_once
    status=$?
    set -e
    [ "$status" -ne 1 ] && exit 0
    sleep 5
    waited=$((waited + 5))
  done
  echo "gave up waiting ${WAIT_TIMEOUT}s for a certificate for ${DOMAIN}" >&2
  exit 1
fi

while true; do
  set +e
  sync_once
  status=$?
  set -e
  if [ "$status" -eq 0 ] && [ -n "${PGHOST:-}" ]; then
    # A reload is enough; PostgreSQL picks up a new certificate without dropping
    # existing connections.
    PGPASSWORD="${PGPASSWORD:-}" psql -h "$PGHOST" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-postgres}" \
      -c 'SELECT pg_reload_conf()' >/dev/null 2>&1 \
      && echo "asked PostgreSQL to reload" \
      || echo "certificate installed; PostgreSQL will use it at next start"
  fi
  sleep "$INTERVAL"
done
