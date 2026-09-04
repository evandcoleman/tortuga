# Upgrading

## Pull the new image

Pull a new tag and recreate the container:

```bash
docker compose pull
docker compose up -d
```

(or `docker pull ghcr.io/evandcoleman/tortuga:<tag>` and recreate the container, if you're
not using Compose).

## Choosing a tag

- `latest` tracks the tip of `main` — every merge. Suitable for a low-stakes personal
  instance; expect occasional in-development changes.
- `<version>` (semver, e.g. `1.4.0`) tracks tagged releases — the more conservative choice.
- `sha-<commit>` pins an exact commit, useful for pinning to a known-good build or bisecting
  a regression.

See [Deployment](/operations/deployment#image) for how these tags are published.

## Migrations

Drizzle migration files are baked into the image and applied automatically against
`/config/tortuga.db` on the next startup — there's no separate migration step to run.
Back up `tortuga.db` before a major version upgrade if you want a rollback point; see
[Backup & restore](/operations/backup-restore).

## Config compatibility

New required or renamed `tortuga.yml` fields are called out in release notes. On startup,
Tortuga validates the YAML against its schema and fails fast with a specific
`Invalid tortuga.yml: ...` error if a field is missing or the wrong type — see
[Troubleshooting](/operations/troubleshooting).

## Rolling back

Recreate the container with the previous image tag. If a migration in the new version
changed the database schema in a way the old version doesn't understand, restore
`tortuga.db` from the backup taken before upgrading.

## Related

- [Deployment](/operations/deployment)
- [Backup & restore](/operations/backup-restore)
- [Troubleshooting](/operations/troubleshooting)
