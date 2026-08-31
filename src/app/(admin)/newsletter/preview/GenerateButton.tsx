'use client';

import { useState, useTransition } from 'react';
import { Button } from '../../_components/ui';
import { generatePreview } from './actions';

/**
 * Triggers a dry-run digest render. Wraps the server action in try/catch so an
 * upstream failure (Tautulli/TMDB/LLM outage) surfaces as an inline error
 * instead of crashing the page — mirroring sendNowDigest's error handling.
 */
export function GenerateButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generatePreview();
        if (!result.success) {
          setError(result.error);
        }
      } catch {
        setError('Preview generation failed. Please try again.');
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={onClick}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? (
          <>
            <Spinner /> Generating…
          </>
        ) : (
          <>
            <RefreshIcon /> Generate fresh preview
          </>
        )}
      </Button>
      {error ? (
        <span className="text-[12px] font-medium text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.5" />
      <path d="M3 4v4h4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
