# Getting started

Tortuga sends a Tautulli-driven, TMDB-enriched newsletter about your Plex server, plus
announcements, invites, and an optional public user portal. This section gets a working
instance running end to end.

## What you need

- A running [Tautulli](https://tautulli.com) instance and its API key (**Settings → Web
  Interface → API**).
- A [TMDB](https://www.themoviedb.org/settings/api) v3 API key, for artwork and ratings.
- An email provider account: [Resend](https://resend.com) (default) or
  [Mailgun](https://www.mailgun.com). See [Email providers](/guide/email-providers).
- Docker and Docker Compose, for the recommended install path. A from-source setup only
  needs Node.js 22+ and pnpm.

## The path

1. [Install](/getting-started/installation) Tortuga with Docker Compose (or another
   supported method).
2. [Complete first run](/getting-started/first-run): set required environment variables,
   write a minimal `tortuga.yml`, start the container, and verify it's healthy.
3. Sign in and configure services (Tautulli, TMDB, email) from the admin UI, or continue
   editing `tortuga.yml` — see [Configuration](/configuration/).
4. Generate a preview and send a test newsletter before turning on the schedule — see
   [Newsletter](/guide/newsletter).

## Related

- [Installation](/getting-started/installation)
- [First run](/getting-started/first-run)
- [Deployment](/operations/deployment)
