#!/usr/bin/env bash
# Deploy the checked-out main commit without publishing a release. Never reads local .env files.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DO_APP_ID:?}" "${DO_REGISTRY:?}" "${UW_PUBLIC_URL:?}" "${GITHUB_SHA:?}"
: "${NEXT_PUBLIC_SUPABASE_URL:?}" "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?}"
export RELEASE_VERSION="$(node -p 'require("./package.json").version')" COMMIT_SHA="$GITHUB_SHA"
[[ "$(git rev-parse HEAD)" == "$COMMIT_SHA" ]]
export IMAGE_TAG="maintenance-$COMMIT_SHA"
REGURL="registry.digitalocean.com/$DO_REGISTRY"
umask 077
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# Preflight before spending time building; all live settings stay private.
doctl apps spec get "$DO_APP_ID" --format json > "$work/live.json"
python3 deploy/release-spec.py "$work/live.json" "$work/next.json"
doctl registry login --expiry-seconds 3600
for service in town web; do
  if [[ "$service" == town ]]; then
    docker build --platform linux/amd64 -f Dockerfile \
      --build-arg RELEASE_VERSION --build-arg COMMIT_SHA -t "$REGURL/unwatched-town:$IMAGE_TAG" .
  else
    docker build --platform linux/amd64 -f apps/web/Dockerfile \
      --build-arg RELEASE_VERSION --build-arg COMMIT_SHA \
      --build-arg NEXT_PUBLIC_API_URL="${UW_PUBLIC_URL%/}/engine" \
      --build-arg NEXT_PUBLIC_SUPABASE_URL --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY \
      -t "$REGURL/unwatched-web:$IMAGE_TAG" .
  fi
  docker push "$REGURL/unwatched-$service:$IMAGE_TAG"
done
# Re-read immediately before update so settings changed during builds are retained.
doctl apps spec get "$DO_APP_ID" --format json > "$work/live.json"
python3 deploy/release-spec.py "$work/live.json" "$work/next.json"
doctl apps update "$DO_APP_ID" --spec "$work/next.json" --wait >/dev/null
python3 - <<'PY'
import json, os, time, urllib.request
base = os.environ['UW_PUBLIC_URL'].rstrip('/')
expected = {'version': os.environ['RELEASE_VERSION'], 'commit': os.environ['COMMIT_SHA']}
for attempt in range(30):
    try:
        for path in ('/engine/api/health', '/api/version'):
            req = urllib.request.Request(base + path, headers={'Cache-Control': 'no-cache'})
            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.load(response)
            if any(data.get(k) != v for k, v in expected.items()):
                raise ValueError('Public endpoint still serves a different release')
        print(f"Production verified: {base} v{expected['version']} ({expected['commit']})")
        break
    except Exception as error:
        if attempt == 29:
            raise SystemExit(f'Production verification failed: {error}')
        time.sleep(10)
PY
