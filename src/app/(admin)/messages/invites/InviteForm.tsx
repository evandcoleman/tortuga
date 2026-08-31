'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '../../_components/ui';

export interface InviteFormSection {
  id: string;
  title: string;
}

export interface InviteFormProps {
  sections: InviteFormSection[];
  /** True when `getSections()` itself failed — the checkbox list may be empty/stale. */
  sectionsUnavailable: boolean;
}

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[14px] text-fg focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30';

export function InviteForm({ sections, sectionsUnavailable }: InviteFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  // Every library checked by default, per spec.
  const [selected, setSelected] = useState<Set<string>>(new Set(sections.map(s => s.id)));
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [isSending, startSending] = useTransition();

  const toggleSection = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const canSend = email.trim().length > 0 && selected.size > 0 && !isSending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startSending(async () => {
      try {
        const res = await fetch('/api/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), sectionIds: Array.from(selected) }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 201) {
          setMessage({ tone: 'success', text: `Invited ${email.trim()} and sent the welcome email.` });
          setEmail('');
          router.refresh();
          return;
        }
        if (res.status === 207) {
          setMessage({
            tone: 'warning',
            text: `Invited ${email.trim()}, but the welcome email failed to send: ${data.welcomeError ?? 'unknown error'}. Use "Resend welcome" below once fixed.`,
          });
          setEmail('');
          router.refresh();
          return;
        }
        setMessage({ tone: 'error', text: data.error ?? 'Failed to send the invite.' });
      } catch {
        setMessage({ tone: 'error', text: 'Failed to send the invite.' });
      }
    });
  };

  return (
    <Card>
      <CardHeader title="Invite someone" description="Sends a Plex invite, then the welcome email to the same address." />
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Email</span>
          <input
            className={inputCls}
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="someone@example.com"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Libraries</span>
          {sectionsUnavailable ? (
            <p className="text-[12.5px] text-danger">Couldn&apos;t load libraries from plex.tv. Try again shortly.</p>
          ) : sections.length === 0 ? (
            <p className="text-[12.5px] text-faint">No shareable libraries found.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sections.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-[13px] text-fg">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleSection(s.id)}
                    className="h-4 w-4 rounded border-line accent-gold"
                  />
                  {s.title}
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSend}
          aria-busy={isSending}
          className="self-start rounded-md bg-gold px-3.5 py-2 text-[13px] font-medium text-gold-ink transition hover:bg-gold-hi disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? 'Sending…' : 'Send invite'}
        </button>

        {message ? (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={
              message.tone === 'success'
                ? 'text-[12.5px] text-success'
                : message.tone === 'warning'
                  ? 'text-[12.5px] text-gold'
                  : 'text-[12.5px] text-danger'
            }
          >
            {message.text}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
