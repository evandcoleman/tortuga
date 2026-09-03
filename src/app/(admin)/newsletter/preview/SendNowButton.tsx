'use client';

import { useRef, useState, useTransition } from 'react';

import { sendNowDigest, type SendNowResult } from './actions';

interface SendNowButtonProps {
  /** Theme selected in the preview switcher — sent for this run only. */
  themeId: string;
  /** Layout selected in the preview switcher — sent for this run only. */
  layoutId: string;
  /** Number of currently-active recipients, shown in the confirmation prompt. */
  recipientCount: number;
}

function describeOutcome(result: Extract<SendNowResult, { success: true }>): string {
  if (result.status === 'skipped') {
    return 'Nothing to send — no items in the window.';
  }
  if (result.status === 'failed') {
    return `Send failed${result.sentCount > 0 ? ` after reaching ${result.sentCount} recipient${result.sentCount === 1 ? '' : 's'}` : ''}. Check history for details.`;
  }
  return `Sent to ${result.sentCount} recipient${result.sentCount === 1 ? '' : 's'}.`;
}

export function SendNowButton({ themeId, layoutId, recipientCount }: SendNowButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isSending, startSending] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openConfirm = () => {
    setMessage(null);
    setError(null);
    dialogRef.current?.showModal();
  };

  const cancel = () => dialogRef.current?.close();

  const confirmSend = () => {
    dialogRef.current?.close();
    setMessage(null);
    setError(null);
    startSending(async () => {
      try {
        const result = await sendNowDigest(themeId, layoutId);
        if (result.success) {
          setMessage(describeOutcome(result));
        } else {
          setError(result.error);
        }
      } catch {
        setError('Send failed — emails may not have gone out. Check history.');
      }
    });
  };

  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
      <span className="mr-1 w-14 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        Send
      </span>
      <button
        type="button"
        onClick={openConfirm}
        disabled={isSending}
        aria-busy={isSending}
        title="Email this theme + layout to all active recipients now"
        className={[
          'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
          'bg-accent text-accent-ink hover:opacity-90 disabled:opacity-60',
        ].join(' ')}
      >
        {isSending ? 'Sending…' : 'Send now'}
      </button>
      {message ? <span className="text-[12px] font-medium text-muted">{message}</span> : null}
      {error ? <span className="text-[12px] font-medium text-red-600">{error}</span> : null}

      <dialog
        ref={dialogRef}
        className="rounded-[10px] border border-line bg-canvas p-0 text-fg backdrop:bg-black/40"
      >
        <div className="w-[min(92vw,420px)] p-5">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-fg">
            Send the digest now?
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            This will email{' '}
            <strong className="text-fg">
              {recipientCount} active recipient{recipientCount === 1 ? '' : 's'}
            </strong>{' '}
            right now, using the currently previewed theme and layout. This cannot be undone.
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
              onClick={confirmSend}
              className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-ink transition-colors hover:opacity-90"
            >
              Yes, send now
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
