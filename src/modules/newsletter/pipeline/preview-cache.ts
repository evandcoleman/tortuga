// In-memory cache of the latest dry-run preview rendered across every
// theme × layout combination. Transient by design: it lets the preview page
// swap theme/layout instantly without re-fetching data or re-running the AI
// intro. Cleared on process restart — the preview page regenerates on demand.

export interface MatrixPreview {
  themeId: string;
  themeLabel: string;
  layoutId: string;
  layoutLabel: string;
  html: string;
}

interface PreviewEntry {
  digestId: string;
  previews: MatrixPreview[];
}

let latest: PreviewEntry | null = null;

export function setThemedPreviews(entry: PreviewEntry | null): void {
  latest = entry;
}

export function getThemedPreviews(): PreviewEntry | null {
  return latest;
}
