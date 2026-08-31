# Roadmap

Tortuga's goal: **every email your Plex server sends, in one place.**

v1 ships the newsletter. The items below take it the rest of the way to a
one-stop shop for communicating with your Plex users, in priority order.

## Planned

### 1. Invites & welcome onboarding
The first message anyone gets from a server owner is "here's your invite,
here's how to set up Plex" — today that happens outside Tortuga. Send (or
detect) the Plex invite, then fire a templated welcome email: apps to
install, how to request content, house rules.

### 2. Resubscribe & recipient preferences
Unsubscribe is currently one-way. Add a resubscribe link and a minimal
per-recipient preferences page (frequency, which libraries) so opt-out
isn't a dead end that generates support email.

### 3. Scheduled announcement sends
Compose exists but is fire-now only. Let "maintenance Saturday 9pm" be
written Wednesday and sent Saturday.

### 4. Transactional templates library
Reusable templates for the recurring one-offs: welcome, "server is back
up", password help, removal notice. Compose covers these manually today.

## Later

- **Request-fulfilled notifications** — "the movie you asked for is now
  available" via Overseerr/Jellyseerr webhook.
- **Lifecycle nudges** — inactivity check-ins, removal notices.

## Not planned

- **Discord/Slack/RSS channels** — email is the opinionated choice;
  multi-channel doubles every feature's surface. Revisit only on repeated
  demand.
- **Sonarr/Radarr "coming soon" sections** — Tautulli + Maintainerr
  already cover added/leaving.
- **Multi-admin** — it's a problem when it's a problem.
