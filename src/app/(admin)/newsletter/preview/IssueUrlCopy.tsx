'use client';

import { useState } from 'react';
import { Badge } from '../../_components/ui';

/** Copyable hosted issue URL, shown once a digest has a slug (i.e. a web variant was rendered). */
export function IssueUrlCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context); the URL
      // text is still visible and selectable, so this is a soft failure.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="info" dot>
        issue url
      </Badge>
      <button
        type="button"
        onClick={copy}
        className="truncate rounded-md border border-line bg-canvas/60 px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-accent/60 hover:text-fg"
        title="Click to copy"
      >
        {url}
      </button>
      {copied ? <span className="text-[11px] text-success">Copied</span> : null}
    </div>
  );
}
