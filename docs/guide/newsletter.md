# Newsletter

The newsletter is a recurring digest of recently-added content, enriched with TMDB
metadata, filtered per your rules, rendered as email + a hosted web page, and sent
to active recipients. This page covers how an admin runs it from `/newsletter`.

## Pipeline

Each run (`runDigest` in `src/modules/newsletter/pipeline/run.ts`) does, in order:

1. **Sync recipients from Tautulli** — `syncRecipients()` calls `tautulli.getUsers()`
   and upserts each user with an email into the recipients cache. Existing
   `manual` recipients (added by hand, not via Plex) are never overwritten by
   this sync. See [Recipients](./recipients.md).
2. **Fetch recently-added items** — `tautulli.getRecentlyAdded()` for the window
   `[now - lookback_days, now]`.
3. **TMDB enrichment** — each item is enriched with TMDB metadata (poster,
   rating, overview) and cached.
4. **Filters** — `applyFilters()` (`src/modules/newsletter/filters.ts`) applies
   `newsletter.filters` (minimum TMDB rating, genre exclusions, episode-to-season
   dedupe) and `newsletter.include_libraries`. If nothing survives filtering, the
   digest is recorded as `skipped` — no email is sent, no error is raised.
5. **Leaving soon** (optional) — if `newsletter.leaving.enabled` and Maintainerr
   is configured, fetches items scheduled for deletion within
   `newsletter.leaving.days`, enriched the same way as the main list. A fetch
   failure here is logged and swallowed — the rest of the digest still sends.
6. **AI commentary** (optional) — if `newsletter.commentary.enabled`, an
   LLM-generated intro paragraph is produced by `generateIntro()` using the
   configured provider/model/voice.
7. **Render** — the digest renders twice: an **email variant** (per-section item
   caps from `newsletter.filters.max_items_per_section` /
   `max_items_leaving_soon`, includes an unsubscribe link, links back to the full
   hosted issue) and a **web variant** (every item, no caps, no unsubscribe link)
   used for the hosted `/issues/[slug]` page.
8. **Send** — for each active, deliverable recipient, their per-library
   preference (set on `/preferences`) filters which items they see; a recipient
   whose preferences match nothing in this digest is skipped entirely (no send
   row, no email). The digest's final status is `sent` if at least one recipient
   received it (or already had, on a retry), otherwise `failed`.

::: tip
Each item's "Open in Plex" deep link only appears when `newsletter.plex.server_id`
is set — see [tortuga.yml reference](../configuration/tortuga-yml.md).
:::

## Schedule

The digest runs on an in-process cron job (via [croner](https://github.com/Hexagon/croner)),
registered at startup in `src/modules/newsletter/module.ts`. The cron
expression and timezone come from `newsletter.schedule` and `newsletter.timezone`.

Set `newsletter.schedule_enabled: false` to disable automatic sends entirely —
the module simply does not register the cron job. Manual "Generate preview" /
"Send now" from the admin UI and the external trigger endpoint both keep
working regardless of this flag.

## Preview and dry run

`/newsletter` redirects to `/newsletter/preview`, which shows the most recently
rendered digest (any of `rendered`, `sent`, `failed` status) — subject, item
count, the render window, and an inline iframe preview. **Generate fresh
preview** runs the pipeline as a dry run: it renders (and caches themed
previews across every theme/layout combination) but never sends. Use **Send
test to me** (in the preview switcher) to deliver a single copy to your admin
address before sending for real.

## Customize

`/newsletter/customize` edits the digest's theme, layout, and appearance
(colors, fonts, spacing overrides) — backed by `newsletter.theme`,
`newsletter.layout`, and `newsletter.appearance` in
[tortuga.yml](../configuration/tortuga-yml.md). Known library names (pulled from
the cached recently-added items) are offered wherever a library picker is
needed.

## History

`/newsletter/history` lists past digest runs with their status
(`pending` / `rendered` / `sending` / `sent` / `skipped` / `failed`), item
count, and — for failed runs — the recorded error.

## Hosted web issues

Every rendered digest gets a permanent URL: `{APP_URL}/issues/[slug]`. It is
**visible only to signed-in admins** until the digest's status becomes `sent`,
at which point it becomes public — a shareable, unauthenticated page showing
every item in that issue (no per-recipient caps, no unsubscribe link). The
slug is generated per digest by `src/modules/newsletter/slug.ts`.

## Leaving soon

Requires a configured [Maintainerr](https://github.com/jorenn92/Maintainerr)
instance (`maintainerr.url` service setting). When enabled
(`newsletter.leaving.enabled`, default `true`), the digest adds a
"Leaving soon" section (heading configurable via `newsletter.leaving.heading`)
listing items scheduled for deletion within `newsletter.leaving.days` days,
excluding any collection IDs in `newsletter.leaving.excluded_collection_ids`.

## AI commentary

When `newsletter.commentary.enabled` is set, an LLM-generated intro paragraph
is prepended to the digest. Configure `newsletter.commentary.provider`
(`anthropic` or `openai`), `newsletter.commentary.model`, and an optional
`newsletter.commentary.voice` string that steers tone. The matching API key
(`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) must be set, or the run fails fast
with a "not configured" error rather than sending without commentary.
`newsletter.commentary.disclaimer` adds a small "AI-generated" note to the
rendered email.

## External trigger

`POST /api/digests/run` runs the same pipeline as the scheduled job, useful
for driving sends from an external cron system instead of (or in addition to)
the in-process schedule. Full request/auth/payload details:
[API reference](../reference/api.md).

## Related

- [Recipients](./recipients.md)
- [Announcements](./announcements.md)
- [tortuga.yml reference](../configuration/tortuga-yml.md)
- [API reference](../reference/api.md)
