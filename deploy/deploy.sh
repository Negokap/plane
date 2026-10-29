#!/bin/bash
# On-server deploy for Setjoo Projects. Run as root (CodeBuild calls it with sudo) from
# /opt/setjoo-projects, after build.sh pushed the images for PLANE_TAG to ECR.
#
#   Redeploy:  sudo PLANE_IMAGE=<ecr repo> PLANE_TAG=<git sha> bash deploy.sh
#   Rollback:  same, with an older sha (the last good one is in .deployed-tag)
#
# Every check that can fail runs before the live containers are touched.
# Migrations only go forward: a rollback restores old images, not the old schema.
set -euo pipefail
cd "$(dirname "$0")"
: "${PLANE_IMAGE:?}" "${PLANE_TAG:?}"
export PLANE_IMAGE PLANE_TAG DOCKER_CONFIG="$PWD/.docker"
PUBLIC_URL="https://projects.setjoo.com"
KEEP_TAGS=3

# One deploy at a time on this box (same lock name as the mpp-server deploys).
exec 9>/var/lock/setjoo-deploy.lock
flock -w 1200 9 || { echo "FATAL: another deploy has held the lock for 20 minutes"; exit 1; }

echo "=== [Setjoo Projects deploy] $(date) tag $PLANE_TAG ==="

echo ">>> [1/5] Secrets from Infisical"
bash ./sync-env.sh plane

echo ">>> [2/5] Pre-flight"
for key in SECRET_KEY DATABASE_URL LIVE_SERVER_SECRET_KEY SETJOO_IDENTITY_ISSUER LISTEN_HTTP_PORT; do
  grep -q "^$key=" .env || { echo "FATAL: $key missing from Infisical plane/prod"; exit 1; }
done
docker compose config -q
docker compose pull --quiet

echo ">>> [3/5] Migrations"
docker compose run --rm migrator

PREV_TAG=$(cat .deployed-tag 2>/dev/null || true)
healthy() {
  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null --max-time 5 "$PUBLIC_URL/" \
      && curl -fsS -o /dev/null --max-time 5 "$PUBLIC_URL/api/instances/" && return 0
    sleep 4
  done
  return 1
}

echo ">>> [4/5] Starting $PLANE_TAG"
if docker compose up -d --no-build --remove-orphans && healthy; then
  echo "$PLANE_TAG" > .deployed-tag
else
  docker compose logs --tail 40 api web proxy || true
  if [ -n "$PREV_TAG" ]; then
    echo "!!! Unhealthy, rolling back to $PREV_TAG"
    PLANE_TAG="$PREV_TAG" docker compose up -d --no-build
    healthy && echo "!!! Rolled back, site is up on $PREV_TAG" || echo "!!! ROLLBACK ALSO UNHEALTHY, check by hand"
  fi
  exit 1
fi

echo ">>> [5/5] Removing images older than the newest $KEEP_TAGS deploys"
keep=$(docker images "$PLANE_IMAGE" --format '{{.Tag}}' | sed 's/^[a-z]*-//' | awk '!seen[$0]++' | head -n "$KEEP_TAGS")
docker images "$PLANE_IMAGE" --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
  grep -qx "${ref##*-}" <<<"$keep" || docker rmi "$ref" >/dev/null 2>&1 || true
done
docker image prune -f >/dev/null
echo "=== Done: $PUBLIC_URL is on $PLANE_TAG ==="
