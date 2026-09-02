'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';

import { Card, CardHeader } from '../_components/ui';
import { RecipientChecklist } from './RecipientChecklist';
import { SendMessageButton } from './SendMessageButton';
import { ScheduleSection, type ScheduleEditingInfo } from './ScheduleSection';
import {
  previewAnnouncement,
  sendAnnouncementToRecipients,
  sendTestAnnouncement,
} from './actions';

interface Recipient {
  email: string;
  name: string;
}

export interface MessageComposerEditing extends ScheduleEditingInfo {
  subject: string;
  body: string;
  recipientEmails: string[];
}

interface MessageComposerProps {
  recipients: Recipient[];
  /** Signed-in admin's email (or ADMIN_EMAIL fallback), may be empty. Display-only —
   * the server resolves the real test recipient from the session, ignoring this. */
  defaultTestEmail: string;
  /** The configured newsletter timezone, shown next to the schedule time input. */
  timezone: string;
  /** When set, the composer edits an existing scheduled announcement instead of composing a new one. */
  editing?: MessageComposerEditing;
}

type SendOutcome = { sent: number; failed: number; announcementId: string };

export function MessageComposer({ recipients, defaultTestEmail, timezone, editing }: MessageComposerProps) {
  const [subject, setSubject] = useState(editing?.subject ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [selected, setSelected] = useState<Set<string>>(() => {
    const active = recipients.map(r => r.email);
    if (!editing) return new Set(active);
    // Drop stored recipients that went inactive since scheduling so the
    // checklist count and the server's active-recipient check agree.
    const activeSet = new Set(active);
    return new Set(editing.recipientEmails.filter(email => activeSet.has(email)));
  });

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, startPreviewing] = useTransition();

  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSendingTest, startSendingTest] = useTransition();

  const [sendOutcome, setSendOutcome] = useState<SendOutcome | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  const canPreview = subject.trim().length > 0 && body.trim().length > 0 && !isPreviewing;
  const canSendTest = canPreview && defaultTestEmail.trim().length > 0 && !isSendingTest;
  const canSend = canPreview && selected.size > 0 && !isSending;

  const selectedEmails = useMemo(() => Array.from(selected), [selected]);

  const onPreview = () => {
    setPreviewError(null);
    startPreviewing(async () => {
      try {
        const result = await previewAnnouncement(subject.trim(), body);
        if (result.success) {
          setPreviewHtml(result.html);
        } else {
          setPreviewError(result.error);
        }
      } catch {
        setPreviewError('Preview failed. Please try again.');
      }
    });
  };

  const onSendTest = () => {
    setTestSent(false);
    setTestError(null);
    startSendingTest(async () => {
      try {
        const result = await sendTestAnnouncement(subject.trim(), body);
        if (result.success) {
          setTestSent(true);
        } else {
          setTestError(result.error);
        }
      } catch {
        setTestError('Send failed. Please try again.');
      }
    });
  };

  const onSend = () => {
    setSendOutcome(null);
    setSendError(null);
    startSending(async () => {
      try {
        const result = await sendAnnouncementToRecipients(subject.trim(), body, selectedEmails);
        if (result.success) {
          setSendOutcome({
            sent: result.sent,
            failed: result.failed,
            announcementId: result.announcementId,
          });
        } else {
          setSendError(result.error);
        }
      } catch {
        setSendError('Send failed — some recipients may not have received it. Check history.');
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Message" description="Subject and markdown body, rendered with the digest's theme." />
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="subject" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                maxLength={200}
                onChange={e => setSubject(e.target.value)}
                placeholder="What's new this week"
                className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-faint focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="body" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                Body (Markdown)
              </label>
              <textarea
                id="body"
                value={body}
                maxLength={20000}
                onChange={e => setBody(e.target.value)}
                rows={14}
                placeholder="Write your message in Markdown…"
                className="w-full resize-y rounded-md border border-line bg-canvas px-3 py-2 font-mono text-[12.5px] leading-relaxed text-fg placeholder:text-faint focus:border-gold focus:outline-none"
              />
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-[12px] font-medium text-muted">Preview</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPreview}
                disabled={!canPreview}
                aria-busy={isPreviewing}
                title={canPreview ? 'Render this message as a dry-run' : 'Enter a subject and body first'}
                className="rounded-full bg-gold px-3 py-1 text-[12px] font-medium text-gold-ink transition-colors hover:opacity-90 disabled:opacity-60"
              >
                {isPreviewing ? 'Rendering…' : 'Preview'}
              </button>
              {previewError ? (
                <span className="text-[12px] font-medium text-red-600">{previewError}</span>
              ) : null}
            </div>
          </div>
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              title="Message preview"
              className="block h-[560px] w-full rounded-b-[10px] bg-white"
            />
          ) : (
            <p className="px-4 py-10 text-center text-[13px] text-muted">
              Click “Preview” to render the message.
            </p>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <RecipientChecklist recipients={recipients} selected={selected} onChange={setSelected} />

        <Card>
          <CardHeader title="Send test" description="Send one copy to yourself before sending to recipients." />
          <div className="flex flex-col gap-2">
            <div
              aria-label="Test recipient email address"
              className="w-full rounded-md border border-line bg-elevated px-3 py-2 text-[13px] text-muted"
            >
              {defaultTestEmail || 'No admin email available'}
            </div>
            <button
              type="button"
              onClick={onSendTest}
              disabled={!canSendTest}
              aria-busy={isSendingTest}
              title={canSendTest ? 'Send a test copy to this address' : 'Enter a subject, body, and email'}
              className="rounded-md bg-elevated px-3.5 py-2 text-[13px] font-medium text-fg ring-1 ring-inset ring-line transition hover:bg-surface hover:ring-line-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSendingTest ? 'Sending…' : 'Send test to me'}
            </button>
            {testSent ? <span className="text-[12px] font-medium text-muted">Sent ✓</span> : null}
            {testError ? <span className="text-[12px] font-medium text-red-600">{testError}</span> : null}
          </div>
        </Card>

        {editing ? null : (
          <Card>
            <CardHeader title="Send" description="Delivers to every selected recipient. This cannot be undone." />
            <div className="flex flex-col gap-2">
              <SendMessageButton
                recipientCount={selected.size}
                disabled={!canSend}
                isSending={isSending}
                onConfirm={onSend}
              />
              {sendError ? <span className="text-[12px] font-medium text-red-600">{sendError}</span> : null}
              {sendOutcome ? (
                <div className="rounded-md bg-elevated px-3 py-2.5 text-[12.5px] text-fg ring-1 ring-inset ring-line">
                  <div>
                    Sent to <strong>{sendOutcome.sent}</strong>
                    {sendOutcome.failed > 0 ? (
                      <>
                        {' '}
                        · <strong className="text-danger">{sendOutcome.failed} failed</strong>
                      </>
                    ) : null}
                  </div>
                  <Link
                    href={`/messages/history/${sendOutcome.announcementId}`}
                    className="mt-1 inline-block font-medium text-gold hover:opacity-90"
                  >
                    View delivery details →
                  </Link>
                </div>
              ) : null}
            </div>
          </Card>
        )}

        <ScheduleSection
          subject={subject}
          body={body}
          recipientEmails={selectedEmails}
          timezone={timezone}
          editing={editing ? { id: editing.id, wallClock: editing.wallClock } : undefined}
        />
      </div>
    </div>
  );
}
