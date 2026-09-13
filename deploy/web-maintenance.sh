#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DO_APP_ID:?}" "${DO_REGISTRY:?}" "${UW_PUBLIC_URL:?}" "${GITHUB_SHA:?}"
export RELEASE_VERSION="$(node -p 'require("./package.json").version')"
export COMMIT_SHA="$GITHUB_SHA" IMAGE_TAG="web-$GITHUB_SHA"
[[ "$(git rev-parse HEAD)" == "$COMMIT_SHA" ]]
umask 077
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl --fail --silent --show-error "${UW_PUBLIC_URL%/}/engine/api/health" > "$work/engine.json"
python3 - "$work/engine.json" <<'PY'
import json, os, sys
j=json.load(open(sys.argv[1]))
if j.get('version') != os.environ['RELEASE_VERSION']: raise SystemExit('Engine release mismatch; use normal release deployment')
PY
doctl registry login --expiry-seconds 3600
docker build --platform linux/amd64 -f apps/web/Dockerfile \
  --build-arg RELEASE_VERSION --build-arg COMMIT_SHA \
  --build-arg NEXT_PUBLIC_API_URL="${UW_PUBLIC_URL%/}/engine" \
  --build-arg NEXT_PUBLIC_SUPABASE_URL --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY \
  -t "registry.digitalocean.com/$DO_REGISTRY/unwatched-web:$IMAGE_TAG" .
docker push "registry.digitalocean.com/$DO_REGISTRY/unwatched-web:$IMAGE_TAG"
doctl apps spec get "$DO_APP_ID" --format json > "$work/live.json"
python3 - "$work/live.json" "$work/next.json" <<'PY'
import json, os, sys
spec=json.load(open(sys.argv[1]))
web=next(s for s in spec['services'] if s['name']=='web')
image=web['image']
if image.get('registry') != os.environ['DO_REGISTRY'] or image.get('repository') != 'unwatched-web': raise SystemExit('Unexpected web image')
image['tag']=os.environ['IMAGE_TAG']
image.pop('digest',None)
image['deploy_on_push']={'enabled':False}
json.dump(spec,open(sys.argv[2],'w'))
PY
doctl apps update "$DO_APP_ID" --spec "$work/next.json" --wait > /dev/null
python3 - "$work/engine.json" <<'PY'
import json, os, sys, time, urllib.request
old=json.load(open(sys.argv[1]))
for attempt in range(30):
    try:
        def read(path):
            req=urllib.request.Request(os.environ['UW_PUBLIC_URL'].rstrip('/')+path,headers={'Cache-Control':'no-cache'})
            with urllib.request.urlopen(req,timeout=15) as r: return json.load(r)
        web=read('/api/version'); engine=read('/engine/api/health')
        assert web['commit']==os.environ['COMMIT_SHA'] and web['version']==os.environ['RELEASE_VERSION']
        assert engine['commit']==old['commit'] and engine['version']==old['version']
        print('Maintenance web deployed; engine version preserved.')
        break
    except Exception:
        if attempt==29: raise SystemExit('Production version verification failed')
        time.sleep(10)
PY
