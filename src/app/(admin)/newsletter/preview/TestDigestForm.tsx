'use client';

import { useState, useTransition } from 'react';

import { sendTestDigest } from './actions';

interface TestDigestFormProps {
  /** Currently selected theme from the preview switcher. */
  themeId: string;
  /** Currently selected layout from the preview switcher. */
  layoutId: string;
  /** Default recipient (ADMIN_EMAIL or logged-in admin), may be empty. */
  defaultEmail: string;
}

export function TestDigestForm({ themeId, layoutId, defaultEmail }: TestDigestFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  const canSend = email.trim().length > 0 && !isSending;

  const onSend = () => {
    setSent(false);
    setError(null);
    startSending(async () => {
      try {
        const result = await sendTestDigest(themeId, layoutId, email.trim());
        if (result.success) {
          setSent(true);
        } else {
          setError(result.error ?? 'Test send failed — try again.');
        }
      } catch {
        setError('Test send failed — try again.');
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
      <span className="mr-1 w-14 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        Test
      </span>
      <input
        type="email"
        value={email}
        onChange={e => {
          setEmail(e.target.value);
          setSent(false);
          setError(null);
        }}
        placeholder="you@example.com"
        aria-label="Test recipient email address"
        className="min-w-0 flex-1 rounded-full border border-line bg-canvas px-3 py-1 text-[12px] text-fg placeholder:text-faint focus:border-gold focus:outline-none"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        aria-busy={isSending}
        title={canSend ? 'Send this theme + layout to one address' : 'Enter an email address'}
        className={[
          'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
          'bg-gold text-gold-ink hover:opacity-90 disabled:opacity-60',
        ].join(' ')}
      >
        {isSending ? 'Sending…' : 'Send test to me'}
      </button>
      {sent ? <span className="text-[12px] font-medium text-muted">Sent ✓</span> : null}
      {error ? <span className="text-[12px] font-medium text-red-600">{error}</span> : null}
    </div>
  );
}
