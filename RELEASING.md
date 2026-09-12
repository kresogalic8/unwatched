# Releasing

The island is one version. Every package and app carries the same number, and a release is a tag on `main`.

## What a version number means here

- **Major** when a message in the own-brain protocol changes incompatibly, or the sealed record's canonical form changes. Own brains and anyone recomputing seals must update.
- **Minor** when the island gains something an owner or a citizen can notice: a verb, a place, an institution, a mechanic, a page, a plan.
- **Patch** for fixes, copy, prompts and tooling that change nothing an owner would name.

Changing a prompt is a patch even when it changes how a citizen talks. The rule is whether an owner could point at a new thing.

Optional additive fields that keep existing messages valid are minor when they introduce a mechanic, and patch when they only expose existing context. Document defaults and keep older snapshots readable.

## When to cut one

After every merged round that changes what an owner reads tomorrow, and at least once a month while the island is alpha. Small releases with honest notes beat big ones with vague ones.

## How

1. Every pull request that changes something noticeable adds a line under `Unreleased` in `CHANGELOG.md`, in the section it belongs to (Added, Changed, Fixed, or Breaking). One line, plain, the way the Gazette would print it.
2. On `main`, with a clean tree:

   ```bash
   pnpm release minor      # or patch, major, or an exact version like 0.3.0
   ```

   The script runs typecheck and the tests, bumps every `package.json`, turns `Unreleased` into the version with today's date, commits `Release vX.Y.Z` and makes an annotated tag. It does not push.
3. Push the branch and the tag together:

   ```bash
   git push origin main vX.Y.Z
   ```

4. The `release` workflow runs typecheck and the tests once more, takes that version's section of `CHANGELOG.md` as the notes, appends the merged pull requests grouped by label (`.github/release.yml`), and publishes the GitHub release.
5. The successful stable release automatically calls the production workflow. It builds both services from the tag, preserves the live DigitalOcean app configuration, deploys, and verifies the release version and commit on both public endpoints. Check the deploy job before announcing that the release is live. See [deployment](docs/deployment.md) for configuration and retries.
6. Post the release in [Announcements](https://github.com/kresogalic8/unwatched/discussions/categories/announcements) with the two or three lines that matter to an owner.

## How people follow what is new

- **Watch → Custom → Releases** on GitHub sends one email per release and nothing else.
- [Releases](https://github.com/kresogalic8/unwatched/releases) has the notes; [CHANGELOG.md](CHANGELOG.md) has the same in one file, including what is merged but not yet released.
- [Announcements](https://github.com/kresogalic8/unwatched/discussions/categories/announcements) carries the short version, written for owners rather than contributors.

## Labels that shape the notes

`breaking`, `world`, `physics`, `minds`, `owner`, `picture`, `bug`. A pull request without one lands under "Everything else", which is fine for tooling. `dependencies`, `duplicate`, `invalid` and `wontfix` are left out of the notes.
