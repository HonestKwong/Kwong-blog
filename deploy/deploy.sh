#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.kwong.yml}"
HEALTH_URL="${HEALTH_URL:-http://kwong-web:3000/api/health}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-90}"

if [[ -z "${KWONG_WEB_IMAGE:-}" ]]; then
  echo "KWONG_WEB_IMAGE is required" >&2
  exit 1
fi

PREVIOUS_IMAGE="$(docker inspect -f '{{.Config.Image}}' kwong-web 2>/dev/null || true)"
echo "Deploying ${KWONG_WEB_IMAGE}"
echo "Previous image: ${PREVIOUS_IMAGE:-<none>}"

export KWONG_WEB_IMAGE
docker compose -f "$COMPOSE_FILE" pull kwong-web
docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate kwong-web

deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
until curl -fsS "$HEALTH_URL" >/tmp/kwong-health.json; do
  if (( SECONDS >= deadline )); then
    echo "Health check failed; starting rollback" >&2
    if [[ -n "${PREVIOUS_IMAGE}" ]]; then
      KWONG_WEB_IMAGE="$PREVIOUS_IMAGE" docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate kwong-web
      echo "Rolled back to ${PREVIOUS_IMAGE}" >&2
    fi
    exit 1
  fi
  sleep 3
done

echo "Deploy healthy: $(cat /tmp/kwong-health.json)"
docker image prune -f >/dev/null || true
