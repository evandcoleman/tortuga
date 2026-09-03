'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '../../../_components/ui';

interface TemplateSummary {
  slug: string;
  name: string;
  subject: string;
  body: string;
}

interface TemplateEditorProps {
  template: TemplateSummary;
  deletable: boolean;
}

const VARIABLES = [
  { token: '{{name}}', description: "recipient's name (falls back to the email's local part)" },
  { token: '{{email}}', description: "recipient's email address" },
  { token: '{{server_name}}', description: 'your server name' },
];

export function TemplateEditor({ template, deletable }: TemplateEditorProps) {
  const router = useRouter();
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, startPreviewing] = useTransition();

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const canSave = subject.trim().length > 0 && body.trim().length > 0 && !isSaving;

  const onSave = () => {
    setSaveError(null);
    setSaved(false);
    startSaving(async () => {
      try {
        const res = await fetch(`/api/templates/${template.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: subject.trim(), body }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSaveError(data.error ?? 'Save failed.');
          return;
        }
        setSaved(true);
      } catch {
        setSaveError('Save failed. Please try again.');
      }
    });
  };

  const onPreview = () => {
    setPreviewError(null);
    startPreviewing(async () => {
      try {
        const res = await fetch(`/api/templates/${template.slug}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, body }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPreviewError(data.error ?? 'Preview failed.');
          return;
        }
        setPreviewHtml(data.html);
      } catch {
        setPreviewError('Preview failed. Please try again.');
      }
    });
  };

  const onDelete = () => {
    setDeleteError(null);
    startDeleting(async () => {
      try {
        const res = await fetch(`/api/templates/${template.slug}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) {
          const data = await res.json().catch(() => ({}));
          setDeleteError(data.error ?? 'Delete failed.');
          return;
        }
        router.push('/messages/templates');
      } catch {
        setDeleteError('Delete failed. Please try again.');
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Content" />
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
                className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-faint focus:border-accent focus:outline-none"
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
                rows={18}
                className="w-full resize-y rounded-md border border-line bg-canvas px-3 py-2 font-mono text-[12.5px] leading-relaxed text-fg placeholder:text-faint focus:border-accent focus:outline-none"
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
                disabled={isPreviewing}
                aria-busy={isPreviewing}
                title="Renders the current (unsaved) subject and body with placeholder values"
                className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-ink transition-colors hover:opacity-90 disabled:opacity-60"
              >
                {isPreviewing ? 'Rendering…' : 'Preview'}
              </button>
              {previewError ? <span className="text-[12px] font-medium text-red-600">{previewError}</span> : null}
            </div>
          </div>
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              title="Template preview"
              className="block h-[560px] w-full rounded-b-[10px] bg-white"
            />
          ) : (
            <p className="px-4 py-10 text-center text-[13px] text-muted">
              Click “Preview” to render the current subject/body against placeholder recipient data.
            </p>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Variables" />
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-muted">
            {VARIABLES.map(v => (
              <li key={v.token}>
                <code className="rounded-sm bg-elevated px-1.5 py-0.5 font-mono text-[12px] text-fg">{v.token}</code>{' '}
                — {v.description}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Save" />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              aria-busy={isSaving}
              className="rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-ink transition hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
            {saved ? <span className="text-[12px] font-medium text-muted">Saved ✓</span> : null}
            {saveError ? <span className="text-[12px] font-medium text-red-600">{saveError}</span> : null}
          </div>
        </Card>

        {deletable ? (
          <Card>
            <CardHeader title="Delete" description="Permanently removes this template." />
            <button
              type="button"
              onClick={() => dialogRef.current?.showModal()}
              disabled={isDeleting}
              aria-busy={isDeleting}
              className="rounded-md bg-elevated px-3.5 py-2 text-[13px] font-medium text-danger ring-1 ring-inset ring-line transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? 'Deleting…' : 'Delete template'}
            </button>
            {deleteError ? <p className="mt-2 text-[12px] font-medium text-red-600">{deleteError}</p> : null}

            <dialog
              ref={dialogRef}
              className="rounded-[10px] border border-line bg-canvas p-0 text-fg backdrop:bg-black/40"
            >
              <div className="w-[min(92vw,420px)] p-5">
                <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-fg">
                  Delete this template?
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">This cannot be undone.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => dialogRef.current?.close()}
                    className="rounded-full px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dialogRef.current?.close();
                      onDelete();
                    }}
                    className="rounded-full bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger ring-1 ring-inset ring-danger/30 transition-colors hover:bg-danger/25"
                  >
                    Yes, delete
                  </button>
                </div>
              </div>
            </dialog>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Delete" description="This is a system default template and can't be deleted, only edited." />
          </Card>
        )}
      </div>
    </div>
  );
}
