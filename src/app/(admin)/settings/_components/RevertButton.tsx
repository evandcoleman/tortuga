'use client';

import { useRef, useState, useTransition } from 'react';

import { Button } from '../../_components/ui';
import { revertToFileDefault } from '../_lib/revert-action';

/**
 * Destructive action: discards the DB config override for the ENTIRE newsletter
 * config — every settings section plus appearance/customize overrides — and
 * reverts to the YAML file default. Confirmed via a native <dialog>, mirroring
 * the SendNowButton confirm pattern, since this wipes far more than one field.
 */
export function RevertButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isReverting, startReverting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const openConfirm = () => {
    setError(null);
    dialogRef.current?.showModal();
  };

  const cancel = () => dialogRef.current?.close();

  const confirmRevert = () => {
    dialogRef.current?.close();
    setError(null);
    startReverting(async () => {
      try {
        await revertToFileDefault();
      } catch {
        setError('Revert failed. Please try again.');
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={openConfirm}
        disabled={isReverting}
        aria-busy={isReverting}
      >
        {isReverting ? 'Reverting…' : 'Revert to file default'}
      </Button>
      {error ? (
        <span className="ml-2 text-[12px] font-medium text-danger" role="alert">
          {error}
        </span>
      ) : null}

      <dialog
        ref={dialogRef}
        className="rounded-[10px] border border-line bg-canvas p-0 text-fg backdrop:bg-black/40"
      >
        <div className="w-[min(92vw,440px)] p-5">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-fg">
            Revert all settings to file default?
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            This discards the saved override for{' '}
            <strong className="text-fg">every settings section</strong> (general, content, email,
            services) <strong className="text-fg">and any appearance/customize changes</strong>,
            reverting everything to the YAML config file. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded-full px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRevert}
              className="rounded-full bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger ring-1 ring-inset ring-danger/30 transition-colors hover:bg-danger/25"
            >
              Yes, revert everything
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
