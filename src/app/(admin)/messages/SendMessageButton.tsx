'use client';

import { useRef } from 'react';

interface SendMessageButtonProps {
  recipientCount: number;
  disabled: boolean;
  isSending: boolean;
  onConfirm: () => void;
}

// Confirmation dialog for a real (non-dry-run) announcement send. Mirrors the
// digest SendNowButton pattern — a native <dialog> confirm before firing the
// server action, since sending is irreversible.
export function SendMessageButton({ recipientCount, disabled, isSending, onConfirm }: SendMessageButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openConfirm = () => dialogRef.current?.showModal();
  const cancel = () => dialogRef.current?.close();
  const confirm = () => {
    dialogRef.current?.close();
    onConfirm();
  };

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        disabled={disabled || isSending}
        aria-busy={isSending}
        className="inline-flex items-center justify-center rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-ink transition hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending ? 'Sending…' : `Send to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}`}
      </button>

      <dialog
        ref={dialogRef}
        className="rounded-[10px] border border-line bg-canvas p-0 text-fg backdrop:bg-black/40"
      >
        <div className="w-[min(92vw,420px)] p-5">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-fg">
            Send this message now?
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            This will email{' '}
            <strong className="text-fg">
              {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
            </strong>{' '}
            right now. This cannot be undone.
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
              onClick={confirm}
              className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-ink transition-colors hover:opacity-90"
            >
              Yes, send now
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
