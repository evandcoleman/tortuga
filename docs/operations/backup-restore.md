# Backup & restore

## What lives in `/config`

Everything Tortuga persists is under the `/config` volume:

- `tortuga.db` — the SQLite database: recipients, digest history, templates,
  announcements, admin users, and any config overrides saved from the UI.
- `tortuga.db-wal` / `tortuga.db-shm` — SQLite write-ahead-log files. The database runs in
  WAL mode, so these must be treated as part of the database, not ignored.
- `tortuga.yml` — the YAML config, if you're using file-based config (values saved from
  the admin UI are stored in the database instead, and take precedence — see
  [Configuration overview](/configuration/)).

Nothing else needs backing up; the image itself is stateless and reproducible from its tag.

## Taking a backup

Because the database runs in WAL mode, copying `tortuga.db` directly while the container
is running can capture an inconsistent snapshot. Use SQLite's own `.backup` command
instead, which the runtime image includes (`sqlite3` is installed alongside the app):

```bash
docker exec tortuga sqlite3 /config/tortuga.db ".backup '/config/tortuga.backup.db'"
docker cp tortuga:/config/tortuga.backup.db ./tortuga-$(date +%F).db
docker exec tortuga rm /config/tortuga.backup.db
```

Also copy `tortuga.yml` if you maintain one:

```bash
docker cp tortuga:/config/tortuga.yml ./tortuga-$(date +%F).yml
```

Run this on a schedule (cron, a Nomad periodic job, your NAS's own snapshot tooling — for
example a Synology scheduled task) against wherever `/config` is mounted from the host.

## Restoring

1. Stop the container:
   ```bash
   docker compose stop tortuga
   ```
2. Replace `/config/tortuga.db` (and `tortuga.yml`, if restoring it too) with the backup
   copy. Remove any stale `tortuga.db-wal` / `tortuga.db-shm` files left from the running
   instance — they don't apply to the restored file.
3. Start the container again:
   ```bash
   docker compose up -d tortuga
   ```

Tortuga applies any pending Drizzle migrations to the restored database automatically on
startup, the same as a normal boot.

## Related

- [Deployment](/operations/deployment)
- [Upgrading](/operations/upgrading)
