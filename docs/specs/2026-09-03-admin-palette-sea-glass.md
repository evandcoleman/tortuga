# Admin palette: Sea glass

Date: 2026-09-03
Status: approved 2026-09-03, implemented in 48bdd95

## Goal

Replace the admin UI's black-and-gold palette with a dark nautical one: low-chroma ink-blue surfaces and a sea-glass teal accent. Email themes and the portal theme are separate systems and are untouched.

## Scope

- `src/app/globals.css` `@theme` token values.
- Rename the `gold` token family to `accent` and update every usage under `src/app/`.
- The login page's hardcoded gold gradient overlay in `src/app/login/page.tsx`.

Nothing else. No layout, spacing, typography, or component changes.

## Token values (oklch, `oklch(L% C H)`)

| Token | Value |
|---|---|
| canvas | 14% 0.018 250 |
| panel | 17% 0.020 250 |
| surface | 20% 0.022 250 |
| elevated | 24% 0.024 250 |
| line | 29% 0.024 250 |
| line-strong | 37% 0.026 250 |
| fg | 96% 0.006 220 |
| muted | 75% 0.012 230 |
| subtle | 57% 0.016 235 |
| faint | 43% 0.018 240 |
| accent (was gold) | 80% 0.11 185 |
| accent-hi (was gold-hi) | 86% 0.10 185 |
| accent-lo (was gold-lo) | 65% 0.11 190 |
| accent-ink (was gold-ink) | 20% 0.05 195 |
| success | 78% 0.15 155 |
| warning | 82% 0.14 80 |
| danger | 72% 0.17 22 |
| info | 78% 0.12 230 |

Status sub-tokens (`*-fg` and any others) keep their current lightness and chroma and take the hue of their parent status color.

## Rename

`--color-gold`, `--color-gold-hi`, `--color-gold-lo`, `--color-gold-ink` become `--color-accent`, `--color-accent-hi`, `--color-accent-lo`, `--color-accent-ink`. Every Tailwind utility that references them (`text-gold`, `bg-gold`, `border-gold/60`, `text-gold-ink`, `from-gold`, etc.) is renamed mechanically. After the change, `grep -rn "gold" src/app` returns nothing.

## Login gradient

The two `oklch(80% 0.14 78 / 0.10)` overlays in `src/app/login/page.tsx` become `oklch(80% 0.11 185 / 0.10)`. If they can reference the accent token via `var(--color-accent)` with an alpha, prefer that.

## Testing

- Typecheck and full test suite pass; any test asserting a `gold` class name is updated.
- Grep check above returns nothing.
- Screenshot every admin page plus login on the seeded local instance; no page shows a leftover gold element, and text contrast on `canvas` and `surface` stays legible (fg on canvas at 96% vs 14% lightness is well above AA).
