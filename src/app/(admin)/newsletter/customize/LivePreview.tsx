'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { Appearance } from '@/modules/newsletter/appearance/schema';
import { renderAppearancePreview } from './actions';

interface LivePreviewProps {
  appearance: Appearance;
  theme: string;
  layout: string;
}

const DEBOUNCE_MS = 400;

export function LivePreview({ appearance, theme, layout }: LivePreviewProps) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Monotonic request id guards against out-of-order responses overwriting a
  // newer render (and against stale closures resolving late).
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = ++requestId.current;
      startTransition(() => {
        renderAppearancePreview(appearance, theme, layout)
          .then(result => {
            if (current !== requestId.current) return;
            if (result.success) {
              setHtml(result.html);
              setError(null);
            } else {
              setError(result.error);
            }
          })
          .catch((err: unknown) => {
            if (current !== requestId.current) return;
            setError(err instanceof Error ? err.message : 'Failed to render preview.');
          });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [appearance, theme, layout]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          Live preview
        </span>
        {isPending ? <span className="text-[12px] text-muted">Updating…</span> : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">
          {error}
        </div>
      ) : (
        <iframe
          srcDoc={html}
          sandbox="allow-same-origin"
          title="Newsletter preview"
          className="block h-[760px] w-full rounded-lg border border-line bg-white"
        />
      )}
    </div>
  );
}
