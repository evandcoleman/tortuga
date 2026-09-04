# Contributing

CI checks, what's actually enforced before a change lands, and the release
flow.

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to
`main`:

```
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

That's it — CI does **not** run `pnpm lint` or `pnpm e2e`; those are
available as local commands (see [Development](./index.md#lint) and
[Development — end-to-end](./index.md#end-to-end-playwright)) but aren't
gated in CI as of this writing. Run them locally before opening a PR anyway.

## Commit and PR expectations

There is no `CONTRIBUTING.md` or PR template in this repository beyond the
CI checks above. In practice: keep changes scoped, make sure `pnpm test` and
`pnpm build` pass locally before pushing (CI blocks merge on a `pull_request`
trigger if either fails), and prefer small, reviewable diffs.

## Release flow

`.github/workflows/release.yml` builds and publishes the Docker image to
`ghcr.io/evandcoleman/tortuga` on:

- **Push to `main`** — tags the image `sha-<short-sha>` and, since this is
  the default branch, also updates the `latest` tag.
- **Push of a `v*` tag** — tags the image with the semver value extracted
  from the tag (`type=semver,pattern={{version}}`), in addition to the
  `sha-*` tag for that commit.

Image tagging is handled entirely by `docker/metadata-action`; there's no
separate version bump step or changelog generation in this workflow.

## Roadmap

Planned and shipped feature work is tracked in
[ROADMAP.md](https://github.com/evandcoleman/tortuga/blob/main/ROADMAP.md).

## Related

- [Development setup](./index.md)
- [Architecture](./architecture.md)
- [Upgrading](../operations/upgrading.md)
