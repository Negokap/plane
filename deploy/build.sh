#!/bin/bash
# Builds and pushes every Setjoo Projects image, tagged <service>-<commit>.
# Called by buildspec.yml; needs ECR_REPO, PUBLIC_URL and a docker login to ECR.
# One image at a time: parallel builds need more memory than the build box has.
set -euo pipefail
TAG="${TAG:-$CODEBUILD_RESOLVED_SOURCE_VERSION}"
HOST="${PUBLIC_URL#https://}"

# Docker Hub rate-limits CodeBuild's shared IPs (429 on 2026-10-29). Pull the official base images from
# AWS's mirror of them and tag them with their Docker Hub names, so `docker build` finds them locally.
# Read from the Dockerfiles, so upstream version bumps are picked up.
grep -hoE '^FROM [^ ]+' apps/web/Dockerfile.web apps/admin/Dockerfile.admin apps/space/Dockerfile.space apps/live/Dockerfile.live apps/api/Dockerfile.api apps/proxy/Dockerfile.ce \
  | awk '{print $2}' | grep ':' | sort -u | while read -r img; do
    docker pull -q "public.ecr.aws/docker/library/$img" && docker tag "public.ecr.aws/docker/library/$img" "$img"
  done

# Setjoo app launcher data, baked into the web bundle (the endpoint sends no CORS headers, so the browser can't fetch it).
# On any failure the checked-in copy stays.
apps_json=apps/web/core/components/navigation/setjoo-applications.json
if curl -fsS --max-time 20 https://auth.setjoo.com/api/v1/applications -o /tmp/setjoo-applications.json \
  && python3 -c 'import json,sys; a=json.load(open(sys.argv[1]))["applications"]; assert a and all(x["publicHost"] for x in a)' /tmp/setjoo-applications.json; then
  cp /tmp/setjoo-applications.json "$apps_json" && echo "Launcher: fetched Setjoo applications"
else
  echo "WARNING: could not fetch Setjoo applications, using the checked-in copy"
fi

vite_args=()
for v in API WEB ADMIN SPACE LIVE; do vite_args+=(--build-arg "VITE_${v}_BASE_URL=$PUBLIC_URL"); done

for svc in web admin space; do
  docker build -f "apps/$svc/Dockerfile.$svc" "${vite_args[@]}" -t "$ECR_REPO:$svc-$TAG" .
  # A rebuild once kept a stale baked-in value (SETJOO_INTEGRATION.md bug #2): check the bundle has our URL.
  docker run --rm --entrypoint sh "$ECR_REPO:$svc-$TAG" -c "grep -rqs '$HOST' /usr/share/nginx/html /app" \
    || { echo "FATAL: $svc image does not contain $HOST"; exit 1; }
  docker push "$ECR_REPO:$svc-$TAG"
done

docker build -f apps/live/Dockerfile.live -t "$ECR_REPO:live-$TAG" .
docker build -f apps/api/Dockerfile.api -t "$ECR_REPO:api-$TAG" apps/api
docker build -f apps/proxy/Dockerfile.ce -t "$ECR_REPO:proxy-$TAG" apps/proxy
for svc in live api proxy; do docker push "$ECR_REPO:$svc-$TAG"; done
