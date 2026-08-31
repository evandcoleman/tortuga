# Roadmap

Tortuga's goal: **front-of-house for your Plex server — every email it
sends and every page your users need, in one place.**

v1 ships the newsletter. The items below take it the rest of the way to a
one-stop shop for communicating with your Plex users, in priority order.

## Pre-launch email hygiene (launch-blocking)

Table stakes for anything that sends email on your behalf; all small.
**All shipped 2026-08-31.**

- ✅ **Auto-suppression on hard bounce/complaint** — webhook
  bounce/complaint events deactivate the recipient (hard bounces only;
  transient/undetermined bounces do not suppress).
- ✅ **RFC 8058 one-click unsubscribe** — `List-Unsubscribe` /
  `List-Unsubscribe-Post` headers on every recipient send, backed by a
  one-click POST handler.
- ✅ **Plain-text MIME alternative** — every email now carries a
  `text/plain` part derived from the rendered HTML.

## Planned

### 1. Invites & welcome onboarding
The first message anyone gets from a server owner is "here's your invite,
here's how to set up Plex" — today that happens outside Tortuga. Send (or
detect) the Plex invite, then fire a templated welcome email: apps to
install, how to request content, house rules.

### 2. User portal
The web half of front-of-house: a small set of opinionated, templated
public pages — getting started with Plex, recommended devices, request
link, server status link, report an issue. Driven by existing YAML
config and appearance theming, with an optional markdown blob per page
for custom prose. Not a CMS. Pairs with invites/welcome (#1), which is
what drives traffic to it; replaces hand-rolled portal sites like
plex.example.com. Scope to be brainstormed when we get there.

### 3. Resubscribe & recipient preferences
Unsubscribe is currently one-way. Add a resubscribe link and a minimal
per-recipient preferences page (frequency, which libraries) so opt-out
isn't a dead end that generates support email. Include message
categories (newsletter vs. announcements) so opting out of the digest
doesn't also suppress operational notices.

### 4. Scheduled announcement sends
Compose exists but is fire-now only. Let "maintenance Saturday 9pm" be
written Wednesday and sent Saturday.

### 5. Transactional templates library
Reusable templates for the recurring one-offs: welcome, "server is back
up", password help, removal notice. Include drafts, clone-previous-send,
and variables ({{name}}, {{server_name}}). Compose covers these manually
today.

## Later

- **Request-fulfilled notifications** — "the movie you asked for is now
  available" via Overseerr/Jellyseerr webhook.
- **Lifecycle nudges** — inactivity check-ins, removal notices.
- **Admin failure alerts** — surface scheduler failures, provider
  rejections, and bounce/complaint spikes somewhere other than logs.
- **Audience segments** — target announcements by library access,
  last-seen activity, or saved groups.
- **Message API** — let external automation (monitoring, scripts) send an
  approved template, the way `/api/digests/run` works for the digest.

## Not planned

- **Discord/Slack/RSS channels** — email is the opinionated choice;
  multi-channel doubles every feature's surface. Revisit only on repeated
  demand.
- **Sonarr/Radarr "coming soon" sections** — Tautulli + Maintainerr
  already cover added/leaving.
- **Multi-admin** — it's a problem when it's a problem.
- **Send-rate controls / queueing** — provider limits don't bite at
  homelab recipient counts; it's a problem when it's a problem.
