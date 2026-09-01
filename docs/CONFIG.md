# Configuration reference

All newsletter behavior is defined under the top-level `newsletter:` key in
`tortuga.yml`, validated against `NewsletterConfigSchema` in
`src/kernel/config/schema.ts`. Settings changed in the admin UI are written to
a database override that takes precedence over the YAML file.

A complete annotated example lives in
[`tortuga.example.yml`](../tortuga.example.yml).

## Top-level fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `schedule` | string (cron) | `0 9 * * SUN` | When automatic digests run, interpreted in `timezone`. |
| `schedule_enabled` | boolean | `true` | `false` pauses automatic sends. Manual UI and API runs still work. |
| `timezone` | string (IANA) | `America/New_York` | Timezone for `schedule`. |
| `lookback_days` | integer > 0 | `7` | How far back to pull newly added content. |
| `reply_to` | email | — | Optional `Reply-To` address. |
| `include_libraries` | string[] / null | — | Plex library names to include. Omit/null to include all. |
| `theme` | string | `editorial` | Email visual theme. |
| `layout` | string | `list` | Email content layout. |

## `email`

```yaml
email:
  provider: resend    # resend | mailgun
  mailgun:            # required only when provider=mailgun
    domain: example.com
    region: us         # us | eu
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `provider` | `resend` \| `mailgun` | `resend` | Selects the email backend. |
| `mailgun.domain` | string | — | **Required when `provider=mailgun`** (enforced by a `superRefine` and again by the provider factory). |
| `mailgun.region` | `us` \| `eu` | `us` | Mailgun API region; `eu` uses `api.eu.mailgun.net`. |

Provider credentials live in the environment, not YAML: `RESEND_API_KEY`
(+ optional `RESEND_WEBHOOK_SECRET`) for Resend; `MAILGUN_API_KEY` +
`MAILGUN_WEBHOOK_SIGNING_KEY` for Mailgun. See
[EMAIL-PROVIDERS.md](EMAIL-PROVIDERS.md).

## `from` (required)

```yaml
from:
  email: "orpheus@yourdomain.com"
  name: "Orpheus"
```

| Field | Type | Notes |
|---|---|---|
| `from.email` | email | Sending address. Its domain must be verified with your provider. |
| `from.name` | string | Display name. |

## `filters`

```yaml
filters:
  min_tmdb_rating: 6.0
  dedupe_episodes_into_seasons: true
  max_items_per_section: 12
  exclude_genres: []
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `min_tmdb_rating` | number 0–10 | `0` | Drop items below this TMDB rating. `0` disables the filter. |
| `dedupe_episodes_into_seasons` | boolean | `true` | Collapse multiple new episodes of a show into a single per-season entry. |
| `max_items_per_section` | integer > 0 | `12` | Cap items shown per section. |
| `exclude_genres` | string[] | `[]` | Genres to omit from the digest. |

## `featured`

```yaml
featured:
  enabled: false
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `featured.enabled` | boolean | `false` | Toggle the featured-item treatment. |

## `plex` (optional)

```yaml
plex:
  server_id: "abc123def4567890abc123def4567890abc12345"
```

When set, digest items render an "Open in Plex" deep link. `server_id` is your
server's `machineIdentifier` — find it at
`https://plex.tv/api/resources?X-Plex-Token=...` or in Plex Web → Settings →
Network → Show Advanced → Server ID. If present, `server_id` must be a non-empty
string.

Sending Plex invites from the Messages → Invites page additionally requires a
Plex auth token. Like the other provider API keys (Tautulli, TMDB, Resend,
etc.), the token is **not** stored in `tortuga.yml` — set it via the
`PLEX_TOKEN` environment variable. Without a token, the Invites page shows a
setup notice and the invite form is hidden.

## `commentary` (optional)

AI-generated editorial intro paragraph at the top of the digest.

```yaml
commentary:
  enabled: false
  provider: anthropic   # anthropic | openai
  model: ""             # optional; provider default if blank
  voice: ""             # optional freeform tone, e.g. "witty film-buff concierge"
  disclaimer: false
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | boolean | `false` | Turn AI commentary on. |
| `provider` | `anthropic` \| `openai` | `anthropic` | Requires `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` respectively when enabled. |
| `model` | string | `""` | Optional model override; provider default when blank. |
| `voice` | string | `""` | Optional freeform tone instructions. |
| `disclaimer` | boolean | `false` | Render an "AI-generated" disclaimer. |

## `extras` (optional)

Extra links and a freeform block in the digest footer.

```yaml
extras:
  request_url: "https://requests.example.com"
  request_label: "Request a title"
  personal_url: "https://example.com"
  personal_label: "example.com"
  freeform_markdown: |
    Reminder: please don't delete other people's watch history.
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `request_url` | url | — | Link to your request site (Overseerr/Ombi/etc). |
| `request_label` | string | `Request a title` | Label for the request link. |
| `personal_url` | url | — | Optional personal/site link. |
| `personal_label` | string | — | Label for the personal link. |
| `freeform_markdown` | string | — | Arbitrary Markdown rendered in the footer. |

## `portal` (optional)

A small branded public site served on its own domain — separate from the
newsletter/admin host. Configured via YAML like everything else, but also
editable at runtime from Settings → Portal, which persists a DB override for
the whole `portal` section (see "Config override shadows YAML" note below).

```yaml
portal:
  enabled: true
  domain: "plex.example.com"
  links:
    plex_url: "https://app.plex.tv"
    status_url: "https://status.example.com"
    request_url: "https://requests.example.com"
    request_label: "Request a title"
  pages:
    getting_started: { enabled: true }
    rules: { enabled: true }
    report_issue: { enabled: true }
  custom:
    - type: link
      label: "Wiki"
      url: "https://wiki.example.com"
    - type: page
      slug: "faq"
      label: "FAQ"
      markdown: "..."
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | boolean | `false` | Off 404s the portal everywhere, including the `/portal` admin preview. |
| `domain` | string | — | Host that serves the portal (see routing below). Required for the domain to actually route; the admin-host preview at `/portal` works regardless. |
| `links.plex_url` | url | `https://app.plex.tv` | "Go to Plex" button. |
| `links.status_url` | url | — | Optional server-status link. |
| `links.request_url` / `request_label` | url / string | falls back to `extras.request_url` / `extras.request_label` | Optional request-service link. |
| `pages.<key>.enabled` | boolean | `true` | Toggles each built-in page (`getting_started`, `rules`, `report_issue`). |
| `pages.<key>.markdown` | string | — | Replaces the built-in page body entirely when set. |
| `custom` | array | `[]` | Extra home-grid buttons: `type: link` (external URL) or `type: page` (a slug-addressed page with a body given as **exactly one** of `markdown` or `html`). Slugs must be lowercase alphanumeric-and-hyphen and may not collide with a built-in page slug or another custom entry. |
| `appearance` | object | inherits the newsletter's theme | Optional standalone theme for the portal's chrome. |

### Routing model

The portal is served two ways:

- **Admin host, behind auth** — `/portal` and `/portal/<page>` on the normal
  admin domain, for previewing as a logged-in admin.
- **Portal domain, public** — requests to `domain` are rewritten by
  `src/middleware.ts` (`/` → `/portal`, `/<page>` → `/portal/<page>`) and
  served with **no authentication** — that's the point, it's the public site.
  Every other path on that host (admin routes, nested paths, non-GET/HEAD
  requests, React server-action dispatch) 404s; the portal domain never
  serves anything else. Middleware also strips any inbound forward-auth
  header before rewriting, so a request to the portal domain can never smuggle
  a forged identity into the admin app.

### Ops checklist (deploying a portal domain)

Getting `domain` live requires infrastructure changes outside the app —
config alone will not route real traffic:

1. **Cloudflare Tunnel**: add a public hostname for the portal domain pointing
   at the same origin (Traefik) as the admin app.
2. **Traefik**: add a router/host rule for the portal domain to the same
   service as the main app. **The proxy chain must preserve the original
   `Host` header end-to-end.** Host-based routing here reads the inbound
   `Host` header directly — it does **not** consult `X-Forwarded-Host` — so a
   proxy that rewrites `Host` (e.g. terminating TLS and re-issuing the
   request under a different host) will make the portal fail closed (404
   everywhere on that domain) rather than accidentally exposing admin routes.
3. **Authelia**: add a bypass rule scoped to the portal domain **only** — do
   not widen an existing admin-host bypass rule to cover it. Authelia is the
   only thing standing between the public internet and the middleware guard
   described above for that host.
4. Verify: `enabled: true` + `domain` set in Settings → Portal, then load the
   domain in a private/incognito window (no session cookie) and confirm the
   home page renders, while an admin-only path like `/settings` on that same
   domain 404s.

## Validation notes

- URL fields (`request_url`, `personal_url`) must be valid URLs.
- Email fields (`from.email`, `reply_to`) must be valid email addresses.
- `mailgun.domain` is required when `provider=mailgun`.
- Unknown/blank optional blocks fall back to the defaults above. Invalid values
  fail config load with a Zod error naming the offending path.
