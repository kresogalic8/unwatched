# Release to production

The production host is the existing DigitalOcean App Platform app, with `town` and `web` images in DOCR. GitHub releases alone historically did not deploy it.

The release workflow now calls the reusable production workflow after publishing the release. This is an explicit dependent job: GitHub's default workflow token does not trigger a separate workflow just by creating a release. Both Docker images are built from the checked-out tag commit, and receive an immutable `vX.Y.Z-<full commit>` image tag. The live app spec is fetched again immediately before rollout; only the two image references change. No secrets, domains, routes, scaling or simulation settings are replaced.

Production deployments are serialized and are not interrupted by a newer build. The workflow refuses a release older than the latest published stable release. Publishing a GitHub release manually outside the tag workflow does not automatically deploy: run the production workflow with its tag. The normal path is `pnpm release minor` followed by pushing `main` and that tag.

## Repository configuration

GitHub Actions secrets:

- `DIGITALOCEAN_ACCESS_TOKEN`: an explicitly authorized DigitalOcean token with registry push and App Platform read/update access.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the public client configuration needed at web build time. Never use a service-role key here.

GitHub Actions variables:

- `DO_APP_ID`: the existing production app ID.
- `DO_REGISTRY`: `unwatched`.
- `UW_PUBLIC_URL`: `https://unwatched.world`.

The `production` GitHub environment must allow the intended automatic deployment (no required manual reviewer if fully automatic releases are desired). Do not store these credentials in source control. `deploy/release.sh` deliberately does not load developer `.env` files.

## Verification and recovery

The workflow waits for App Platform, then polls both `/engine/api/health` and `/api/version` until their `version` and `commit` match the release. The production job fails if either service still serves another release. The health payload also retains the existing simulation clock and brain fields. Secrets and temporary app specifications are never uploaded as artifacts.

If a build fails, the running app is untouched. If deployment or verification fails, inspect the production job and DigitalOcean deployment before retrying. The production workflow accepts the latest release tag through `workflow_dispatch`, allowing a retry without another version. Older-version rollback is an explicit manual operation, not an automatic side effect of a late workflow run.

Local configuration tests: `python3 deploy/test-release-spec.py` and `bash -n deploy/release.sh`.
