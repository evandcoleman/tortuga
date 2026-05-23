# Preview Page: Save Theme/Layout as Default — Design

**Date:** 2026-05-23
**Status:** Approved (design), pending spec review

## Summary

The newsletter preview page lets you flip between themes and layouts via the
`PreviewSwitcher` (two button rows), but the selection is client-only — to actually
make a combo the default you have to go to Settings. Add a **"Save as default"** button
to the preview that persists the currently-selected theme + layout into the config
override, preserving every other setting.

## Behavior

- Button lives in a small action bar below the two axis rows in `PreviewSwitcher`.
- Always enabled. On click it persists the active `themeId` + `layoutId`.
- While the server action runs: button shows "Saving…" (via `useTransition`).
- On success: shows "Saved ✓"; the confirmation resets when the user changes the
  theme or layout selection again.
- No re-render is triggered — all theme×layout combos are already in the preview cache,
  so the iframe needs nothing new.

## Architecture

### Server action — `src/app/(admin)/newsletter/preview/actions.ts` (new, `'use server'`)

Mirrors `src/app/(admin)/settings/actions.ts`'s `saveSettings`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { writeConfigOverride } from '@/kernel/config/overrides';

export async function savePreviewDefault(themeId: string, layoutId: string): Promise<void> {
  const ctx = getAppContext();
  writeConfigOverride(ctx.db, { ...ctx.config.newsletter, theme: themeId, layout: layoutId });
  await invalidateAppContext();
  revalidatePath('/newsletter/preview');
  revalidatePath('/settings');
  revalidatePath('/');
}
```

`writeConfigOverride` takes a full `NewsletterConfig`; spreading the current
`ctx.config.newsletter` and overriding only `theme`/`layout` keeps all other settings
intact. `invalidateAppContext` + `revalidatePath` make the new default take effect on
the next render of preview, settings, and the dashboard — same as the settings save.

### Client — `src/app/(admin)/newsletter/preview/PreviewSwitcher.tsx`

`PreviewSwitcher` already owns `themeId`/`layoutId` via `useState`. Add:

- `import { savePreviewDefault } from './actions';`
- `const [isSaving, startSaving] = useTransition();`
- `const [saved, setSaved] = useState(false);`
- An action bar (a third bordered row, consistent with the `AxisRow` styling) containing
  a gold pill button: label `Save as default` / `Saving…` (when `isSaving`), and a
  `Saved ✓` confirmation shown when `saved` is true.
- Clicking calls `startSaving(async () => { await savePreviewDefault(themeId, layoutId); setSaved(true); })`.
- Reset `saved` to `false` whenever `themeId` or `layoutId` changes (so the confirmation
  doesn't linger over a different, unsaved selection). Implement by clearing `saved` in
  the existing `setThemeId`/`setLayoutId` handlers (wrap them) — no `useEffect` needed.

Styling: gold pill (`bg-gold text-gold-ink`) matching the active-pill style already used
in the switcher; disabled visual only while `isSaving`.

## Testing

- The server action is a thin, context-bound wrapper of the same shape as the existing
  (untested) `saveSettings`; verify via `npx tsc --noEmit`, `npm run build`, and a manual
  click-through in the running app (confirm the saved default round-trips to the Settings
  dropdowns and a fresh preview).
- No new pure logic worth a unit test (the merge is a one-line spread). No contrived
  helper/test seam (YAGNI).

## Scope guards (YAGNI)

- Saves only `theme` + `layout`; touches no other config field.
- No schema/config changes (`theme` and `layout` already exist).
- No re-render or send side effects.
- Button always enabled (no disabled-when-unchanged state) per decision.

## Files touched

- `src/app/(admin)/newsletter/preview/actions.ts` (new)
- `src/app/(admin)/newsletter/preview/PreviewSwitcher.tsx` (modified)
