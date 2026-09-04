# "Leaving soon" section from Maintainerr

**Status:** approved 2026-08-30
**Goal:** The weekly digest gains a section listing media that Maintainerr will delete within the next N days, rendered with the same item cards as the "new on Plex" sections.

## Scope

In: Maintainerr client, Tautulli metadata lookup, pipeline step, `leaving` block, settings fields, customize-page block support, tests.
Out: explaining why an item is leaving, per-user targeting, a "removed since last digest" recap, any write to Maintainerr.

## Data sources

Maintainerr (no auth; LAN/Consul only; version 3.21.x):
- `GET /api/collections` → `{ id, title, deleteAfterDays: number|null, manualCollection, libraryId, type }[]`
- `GET /api/collections/media?collectionId=<id>` → `{ id, mediaServerId: string (Plex ratingKey), tmdbId?: number, addDate: string (ISO) }[]`

Removal date: `leavesAt = addDate + deleteAfterDays days`. Collections with `deleteAfterDays` null or ≤ 0 are ignored.

Tautulli: `GET /api/v2?cmd=get_metadata&rating_key=<ratingKey>` → map to the existing `TautulliItem` shape (title, media_type, library_name, year, summary, thumb, parent/grandparent titles, guid). Only `movie` and `show` items are rendered; a `season`/`episode` ratingKey is rendered as-is with the parent titles the mapper already supports.

## Config

Env (`src/kernel/config/schema.ts` EnvSchema): `MAINTAINERR_URL` optional URL. Absent → feature disabled, no settings shown beyond an explanatory note. Nomad job gets `MAINTAINERR_URL=http://maintainerr.service.consul:6246` (deployment cluster repo change, separate commit).

`newsletter.leaving` (NewsletterConfigSchema, all overridable via `config_overrides`/Settings page):

| key | type | default |
|---|---|---|
| enabled | boolean | true |
| days | integer 1–90 | 7 |
| excluded_collection_ids | number[] | [] |
| heading | string 1–80 | "Leaving soon" |

Settings page: checkbox, number field, text field, and a checklist of Maintainerr collections (fetched live; on fetch failure show the stored ids as plain text with an error note; never block saving other settings).

## Pipeline

New `src/modules/newsletter/pipeline/leaving.ts`:

```ts
fetchLeavingItems(deps: { maintainerr: MaintainerrClient; tautulli: TautulliClient; log }, args: {
  windowEnd: Date; days: number; excludedCollectionIds: number[];
}): Promise<TautulliItem[]>   // each carries leavesAt via a new optional field on TautulliItem
```

Steps: list collections → keep `deleteAfterDays > 0` and id ∉ excluded → media for each → compute `leavesAt` → keep `windowEnd < leavesAt ≤ windowEnd + days` → dedupe by `mediaServerId` keeping the earliest `leavesAt` → `getMetadata` per item (concurrency ≤ 4; a failing lookup drops that item and logs) → return, sorted by `leavesAt` ascending.

`run.ts`: when `MAINTAINERR_URL` is set and `leaving.enabled`, call `fetchLeavingItems` right after the Tautulli recently-added fetch; run the result through `enrichItems` separately from the main list (so it is not subject to library filters or `maxItems` of the libraries block); pass as `leavingItems: EnrichedItem[]` (EnrichedItem gains optional `leavesAt: Date`). Any thrown error from the leaving step is caught, logged at error level, and yields `leavingItems: []` — the digest never fails because of Maintainerr. `itemCount` on the digest row counts only the main list.

## Rendering

- `appearance/schema.ts`: add block kind `leaving`. Default order: after `libraries`, before `freeform`. `resolveBlocks` fills it enabled by default.
- `templates/digest.tsx`: when the `leaving` block is enabled and `leavingItems.length > 0`, render one `ResolvedSection` with `title = config.leaving.heading` through the current layout's section component, same item display options. The per-item date label reads `Leaves <weekday, Mon D>` (using the digest timezone) instead of the added date. Empty list → block not rendered (no heading).
- Customize page: the block appears in the reorder/hide list with the label "Leaving soon"; no extra per-block options.

## Failure modes

| Failure | Behaviour |
|---|---|
| `MAINTAINERR_URL` unset | Step skipped, no block, no log noise |
| Maintainerr unreachable / non-2xx / bad JSON | Error logged once, `leavingItems: []`, digest proceeds |
| Tautulli metadata 404 for one ratingKey | Item dropped, warning logged, others proceed |
| Settings checklist fetch fails | Fields still save; checklist replaced by error note |

## Tests (vitest)

- `integrations/maintainerr.test.ts`: parses collections and media fixtures; non-2xx throws typed error.
- `integrations/tautulli.test.ts`: `getMetadata` maps movie and episode fixtures to `TautulliItem`.
- `pipeline/leaving.test.ts`: date math across DST boundary; window inclusive/exclusive edges; excluded and null-`deleteAfterDays` collections skipped; dedupe keeps earliest; metadata failure drops one item only.
- `pipeline/run.test.ts`: block present with items; absent when empty; absent and digest still `sent` when Maintainerr throws; disabled via config.
- `templates/digest.test.ts`: `leaving` block renders heading + "Leaves …" label in each layout; hidden block renders nothing; `resolveBlocks` default ordering.
- settings action test: rejects `days` 0 and 91; accepts exclusions list.
