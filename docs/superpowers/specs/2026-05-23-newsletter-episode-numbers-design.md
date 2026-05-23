# Newsletter: Show Which Episodes Were Added — Design

**Date:** 2026-05-23
**Status:** Approved (design), pending spec review

## Summary

TV episodes currently lose their identity in the newsletter. The pipeline captures
`seasonNumber` but not the episode number, and `dedupe_episodes_into_seasons` (the
default) rolls all of a season's new episodes into one card reading
`Season 2 · 3 new episodes`. This feature surfaces *which* episodes were added as a
compact range in the item kicker.

Target output:

- Roll-up ON (default): `Series · Season 2 · Episodes 5–7` (consecutive), or
  `Series · Season 3 · E2, E5, E8` (non-consecutive), or `1–3, 7` (mixed).
- Roll-up OFF (each episode its own card): kicker `Series · Season 2 · E5`, with the
  episode title as the card title (already present).

The change is confined to data capture, the roll-up accumulator, and the kicker
string — so all four layouts × four themes inherit it with no per-layout work.

## Data flow today (for reference)

`tautulli.ts` → raw items (`title`, `parentTitle`, `grandparentTitle`, …) →
`enrich.ts` → `EnrichedItem` (`seasonNumber` from `parent_media_index`; episode
number **not** captured) → `filters.ts` roll-up → `digest.tsx` → `item-format.ts`
`itemKicker`.

## Changes

### 1. Capture the episode number

The Tautulli client already attaches the full raw payload as `item.raw`, and
`enrich.ts` already reads `item.raw.parent_media_index` for `seasonNumber`. The
episode number is `item.raw.media_index` — so no `tautulli.ts` change is needed; read
it the same way in `enrich.ts`.

- **`src/modules/newsletter/types.ts`**: add to `EnrichedItem`:
  - `episodeNumber?: number` — for a single episode item.
  - `episodeNumbers?: number[]` — for a rolled-up season item (sorted ascending).

- **`src/modules/newsletter/pipeline/enrich.ts`**: derive an `episodeNumber` from
  `item.raw.media_index` (coerce string/number to a number; `undefined` when absent or
  non-numeric), and set it on the enriched item for episodes (mirror the existing
  `seasonNumber` parsing of `parent_media_index`). On a cache hit, backfill
  `episodeNumber` from the freshly-parsed raw item the same way `ratingKey` is
  refreshed today (`return { ...prior, addedAt, ratingKey: ..., episodeNumber }`), so
  already-cached episodes still get numbers without a full cache rebuild.

### 2. Roll-up accumulates numbers (`src/modules/newsletter/filters.ts`)

In the `dedupe_episodes_into_seasons` branch, when collapsing episodes into a season:

- Seed the season's `episodeNumbers` with the first episode's `episodeNumber` (as a
  one-element array, or empty if it had none).
- For each subsequent episode in the same season, push its `episodeNumber`.
- Keep incrementing `episodeCount` exactly as today (it remains the source of truth
  for the count and the fallback display).
- After the loop, sort each season's `episodeNumbers` ascending. (Equivalent: sort at
  format time — pick one; sorting once after accumulation is cheaper and clearer.)

`episodeNumbers` therefore has length ≤ `episodeCount`. If every episode contributed a
number, they are equal.

### 3. Formatting (`src/modules/newsletter/templates/item-format.ts`)

New exported helper:

```ts
// Collapses sorted episode numbers into a compact human string.
// [5,6,7] -> "5–7"; [2,5,8] -> "2, 5, 8"; [1,2,3,7] -> "1–3, 7"; [5] -> "5".
// Assumes input is sorted ascending and non-empty; caller guards emptiness.
export function formatEpisodeRange(nums: number[]): string
```

`itemKicker` changes:

- For a `season` item: if `episodeNumbers` is present, non-empty, **and** its length
  equals `episodeCount` (i.e. every rolled-up episode had a number — the
  "fall back to count if any are missing" rule), emit
  `Season {seasonNumber} · Episodes {formatEpisodeRange(...)}` when the range
  contains a dash, otherwise `Season {seasonNumber} · {formatEpisodeRange(...)}`
  prefixed with `E` for the single/short list form. Concretely:
  - consecutive run → `Season 2 · Episodes 5–7`
  - non-consecutive → `Season 3 · E2, E5, E8`
  - single episode in the season → `Season 2 · E5`
  Otherwise (numbers missing/partial) fall back to the current
  `Season 2 · 3 new episodes`.
- For a single `episode` item with `episodeNumber`: append `· E{episodeNumber}` to the
  existing Season segment, e.g. `Series · Season 2 · E5`.

The "Film/Series" prefix and `year` handling in `itemKicker` are unchanged.

### Fallback rule (decided)

If **any** episode in a roll-up lacks a number (`episodeNumbers.length < episodeCount`),
show the existing `· N new episodes` count and **no** range — never a misleading
partial range.

## Testing

- **`item-format` unit tests** (new or extended):
  - `formatEpisodeRange`: `[5]`→`"5"`; `[5,6,7]`→`"5–7"`; `[2,5,8]`→`"2, 5, 8"`;
    `[1,2,3,7]`→`"1–3, 7"`; `[1,2,4,5]`→`"1–2, 4–5"`.
  - `itemKicker` for a season: all-numbered consecutive → `Season 2 · Episodes 5–7`;
    all-numbered non-consecutive → `Season 3 · E2, E5, E8`; partial (length <
    episodeCount) → `Season 2 · 3 new episodes`; no numbers → same fallback.
  - `itemKicker` for a single episode → `Series · Season 2 · E5`.
- **`enrich` test**: episode raw with `media_index` → `episodeNumber` set; cache-hit
  path backfills `episodeNumber`.
- **`filters` test**: three episodes of one season roll up to a season with
  `episodeNumbers` sorted ascending and `episodeCount === 3`; an episode missing its
  number yields `episodeNumbers.length < episodeCount`.

## Scope guards (YAGNI)

- No config or schema changes; no new settings.
- Episode *titles* are not added to the range view (only the dedupe-OFF single-episode
  card shows a title, which it already does).
- No per-layout edits — the kicker is shared chrome consumed by every layout.
- En dash `–` (U+2013) for ranges, matching existing typographic style in the
  templates.

## Files touched

- `src/modules/newsletter/types.ts`
- `src/modules/newsletter/pipeline/enrich.ts` (+ `enrich.test.ts`)
- `src/modules/newsletter/filters.ts` (+ `filters.test.ts` — exists)
- `src/modules/newsletter/templates/item-format.ts` (+ new `item-format.test.ts` —
  none exists yet)
