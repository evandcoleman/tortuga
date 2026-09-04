# tortuga.yml: newsletter reference

All newsletter behavior is defined under the top-level `newsletter:` key in
`tortuga.yml`, validated against `NewsletterConfigSchema` in
`src/kernel/config/schema.ts`. See [Configuration overview](./index.md) for how
this file interacts with the database override and environment variables, and
[Portal configuration](./portal.md) for the top-level `portal:` key.

A complete annotated example lives in
[`tortuga.example.yml`](https://github.com/evandcoleman/tortuga/blob/main/tortuga.example.yml)
in the repo root. It omits the `newsletter.leaving` section (its defaults are
used) and the `portal` section is fully commented out — see the comparison at
the bottom of this page.

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

Provider credentials live in the environment (or Settings → service settings),
not YAML: `RESEND_API_KEY` (+ optional `RESEND_WEBHOOK_SECRET`) for Resend;
`MAILGUN_API_KEY` + `MAILGUN_WEBHOOK_SIGNING_KEY` for Mailgun. If the selected
provider's credentials are incomplete, `createEmailProvider()` returns `null`
(email disabled) rather than throwing — routes that need email respond `409`.
See [Email providers](../guide/email-providers.md).

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

Sending Plex invites from the People → Invites page (`/people/invites`) additionally requires a
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

## `leaving` (optional)

The "Leaving soon" section, sourced from Maintainerr collections when
`MAINTAINERR_URL` is configured.

```yaml
leaving:
  enabled: true
  days: 7
  excluded_collection_ids: []
  heading: "Leaving soon"
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | boolean | `true` | Toggle the whole section. |
| `days` | integer 1–90 | `7` | Only include items leaving within this many days. |
| `excluded_collection_ids` | number[] | `[]` | Maintainerr collection IDs to exclude. |
| `heading` | string, 1–80 chars | `Leaving soon` | Section heading text. |

`filters.max_items_leaving_soon` (optional positive integer, no default — unset
means uncapped) additionally caps how many leaving-soon items are shown; it
lives under `filters`, not `leaving`, in the schema.

## `appearance` (optional)

Deep visual customization of the email (color/typography overrides, block
order, per-library display rules) via `AppearanceSchema`
(`src/modules/newsletter/appearance/schema.ts`) — `theme_overrides`, `blocks`,
`libraries`, `item_display`. The admin UI's **Newsletter → Customize** editor
is the primary way to author this; hand-writing it in YAML is supported but not
covered field-by-field here. Unset means "use the `theme` preset with no
overrides."

## `extras` (optional)

Extra links and a freeform block in the digest footer.

```yaml
extras:
  request_url: "https://requests.example.com"
  request_label: "Make a request"
  personal_url: "https://example.com"
  personal_label: "example.com"
  freeform_markdown: |
    Reminder: please don't delete other people's watch history.
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `request_url` | url | — | Link to your request site (Overseerr/Ombi/etc). |
| `request_label` | string | `Make a request` | Label for the request link. |
| `personal_url` | url | — | Optional personal/site link. |
| `personal_label` | string | — | Label for the personal link. |
| `freeform_markdown` | string | — | Arbitrary Markdown rendered in the footer. |

## Validation notes

- URL fields (`request_url`, `personal_url`) must be valid URLs.
- Email fields (`from.email`, `reply_to`) must be valid email addresses.
- `mailgun.domain` is required when `provider=mailgun`.
- `timezone` must be a valid IANA zone name (validated with
  `Intl.DateTimeFormat`).
- Unknown/blank optional blocks fall back to the defaults above. Invalid values
  fail config load with a Zod error naming the offending path.

## Comparing against tortuga.example.yml

The repo's `tortuga.example.yml` is a good starting point but is not
exhaustive:

- It omits `newsletter.leaving` entirely (relies on the schema defaults:
  enabled, 7 days, no exclusions, heading "Leaving soon").
- It omits `newsletter.appearance` (relies on `theme: editorial` with no
  overrides).
- The entire `portal:` section is commented out — copy the block and remove
  the `#` prefixes to enable it; see [Portal configuration](./portal.md).
- It sets `provider: mailgun` in its `email` example; the schema default is
  `resend`.

## Related

- [Configuration overview](./index.md)
- [Portal configuration](./portal.md)
- [Environment variables](./environment.md)
- [Email providers](../guide/email-providers.md)
