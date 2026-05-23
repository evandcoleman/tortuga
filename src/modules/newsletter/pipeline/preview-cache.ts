// In-memory cache of the latest dry-run preview rendered across every theme.
// Transient by design: it lets the preview page swap themes instantly without
// re-fetching data or re-running the AI intro. Cleared on process restart —
// the preview page just regenerates on demand, so persistence isn't needed.

export interface ThemedPreview {
  id: string;
  label: string;
  html: string;
}

interface PreviewEntry {
  digestId: string;
  previews: ThemedPreview[];
}

let latest: PreviewEntry | null = null;

export function setThemedPreviews(entry: PreviewEntry | null): void {
  latest = entry;
}

export function getThemedPreviews(): PreviewEntry | null {
  return latest;
}
