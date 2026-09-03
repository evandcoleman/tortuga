'use client';

import { useRef, useState, useTransition } from 'react';
import type { PortalConfig, PortalCopy, PortalPageConfigSchema } from '@/kernel/config/schema';
import { z } from 'zod';
import { DEFAULT_PAGE_COPY, DEFAULT_PORTAL_COPY } from '@/modules/portal/copy';
import { Button, Card, CardHeader } from '../_components/ui';
import { savePortalSettings, revertPortalSettings, type SaveState } from './actions';
import { IndexEditor } from './IndexEditor';
import { PortalAppearanceEditor } from './PortalAppearanceEditor';
import { deriveInitialEntries } from './validate';
import { toEntries, toEntryRows, type IndexEntryRowState } from './entryRows';

type PortalPageConfig = z.infer<typeof PortalPageConfigSchema>;

/**
 * Form working state. Same shape as `PortalConfig` except `entries` is always
 * a concrete array of id-tagged rows (the form has already applied the legacy
 * `custom` merge by the time it mounts — see `deriveInitialEntries` — and
 * assigned each row a stable id — see `toEntryRows`), so the editor never has
 * to handle the "entries is unset" case, or key rows by array index, itself.
 */
type PortalFormState = Omit<PortalConfig, 'entries'> & { entries: IndexEntryRowState[] };

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[14px] text-fg focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30';

const initial: SaveState = { status: 'idle' };

const BUILT_IN_PAGES: Array<{ key: 'getting_started' | 'rules' | 'report_issue'; label: string; hint: string }> = [
  { key: 'getting_started', label: 'Getting Started', hint: 'Invite → install app → pick server → stream.' },
  { key: 'rules', label: 'Rules', hint: 'House rules for sharing the server.' },
  { key: 'report_issue', label: 'Report an Issue', hint: 'Points visitors at the request service’s issue flow.' },
];

/**
 * Builds form state from a `PortalConfig`, applying the legacy `custom` → `entries`
 * merge on load (see spec §1) and assigning each row a stable id for the editor.
 */
function toFormState(config: PortalConfig): PortalFormState {
  return { ...config, entries: toEntryRows(deriveInitialEntries(config)) };
}

/** Builds the save candidate: `entries` always wins (ids stripped), and `custom` is dropped rather than round-tripped stale. */
function toCandidate(form: PortalFormState): PortalConfig {
  return { ...form, entries: toEntries(form.entries), custom: [] };
}

export function PortalForm({ config }: { config: PortalConfig }) {
  const [working, setWorking] = useState<PortalFormState>(() => toFormState(config));
  const [state, setState] = useState<SaveState>(initial);
  const [isSaving, startSaving] = useTransition();
  const [isReverting, startReverting] = useTransition();
  const [revertError, setRevertError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const err = state.status === 'error' ? state.errors : {};

  function patch(next: Partial<PortalFormState>) {
    setWorking(prev => ({ ...prev, ...next }));
  }

  function patchLinks(next: Partial<PortalConfig['links']>) {
    setWorking(prev => ({ ...prev, links: { ...prev.links, ...next } }));
  }

  function patchPage(key: 'getting_started' | 'rules' | 'report_issue', next: Partial<PortalPageConfig>) {
    setWorking(prev => ({ ...prev, pages: { ...prev.pages, [key]: { ...prev.pages[key], ...next } } }));
  }

  function patchCopy(next: Partial<PortalCopy>) {
    setWorking(prev => ({ ...prev, copy: { ...prev.copy, ...next } }));
  }

  function handleSave() {
    setState(initial);
    startSaving(async () => {
      const result = await savePortalSettings(initial, toCandidate(working));
      setState(result);
    });
  }

  function confirmRevert() {
    dialogRef.current?.close();
    setRevertError(null);
    startReverting(async () => {
      try {
        const reverted = await revertPortalSettings();
        setWorking(toFormState(reverted));
      } catch {
        setRevertError('Revert failed. Please try again.');
      }
    });
  }

  return (
    <div className="grid gap-5">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Domain</span>
            <input
              className={inputCls}
              value={working.domain ?? ''}
              placeholder="plex.example.com"
              onChange={e => patch({ domain: e.target.value || undefined })}
            />
            {err['domain'] ? <span className="mt-1 block text-[11.5px] text-danger">{err['domain']}</span> : null}
            <span className="mt-1 block text-[11.5px] text-muted">
              Requires the tunnel/router and Authelia bypass to be configured for this domain (see docs/CONFIG.md).
            </span>
          </label>
        </div>
        <div className="mt-3">
          <label className="flex items-start gap-2.5 py-1">
            <input
              className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent"
              type="checkbox"
              checked={working.enabled}
              onChange={e => patch({ enabled: e.target.checked })}
            />
            <span>
              <span className="block text-[13.5px] text-fg">Enable the portal</span>
              <span className="mt-0.5 block text-[11.5px] text-muted">
                Off 404s the portal on the domain; the preview link above still works for admins, with a
                disabled banner.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Links" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Plex URL</span>
            <input
              className={inputCls}
              value={working.links.plex_url}
              onChange={e => patchLinks({ plex_url: e.target.value })}
            />
            {err['links.plex_url'] ? <span className="mt-1 block text-[11.5px] text-danger">{err['links.plex_url']}</span> : null}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Status URL (optional)</span>
            <input
              className={inputCls}
              value={working.links.status_url ?? ''}
              placeholder="https://status.example.com"
              onChange={e => patchLinks({ status_url: e.target.value || undefined })}
            />
            {err['links.status_url'] ? <span className="mt-1 block text-[11.5px] text-danger">{err['links.status_url']}</span> : null}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Request URL (optional)</span>
            <input
              className={inputCls}
              value={working.links.request_url ?? ''}
              placeholder="Defaults from Content → Extras"
              onChange={e => patchLinks({ request_url: e.target.value || undefined })}
            />
            {err['links.request_url'] ? <span className="mt-1 block text-[11.5px] text-danger">{err['links.request_url']}</span> : null}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Request label (optional)</span>
            <input
              className={inputCls}
              value={working.links.request_label ?? ''}
              placeholder="Defaults from Content → Extras"
              onChange={e => patchLinks({ request_label: e.target.value || undefined })}
            />
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Home" />
        <div className="grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Tagline (optional)</span>
            <input
              className={inputCls}
              value={working.copy.tagline ?? ''}
              placeholder={DEFAULT_PORTAL_COPY.tagline}
              maxLength={160}
              onChange={e => patchCopy({ tagline: e.target.value || undefined })}
            />
            {err['copy.tagline'] ? <span className="mt-1 block text-[11.5px] text-danger">{err['copy.tagline']}</span> : null}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Intro (optional)</span>
            <textarea
              className={inputCls}
              rows={2}
              value={working.copy.intro ?? ''}
              placeholder={DEFAULT_PORTAL_COPY.intro}
              maxLength={400}
              onChange={e => patchCopy({ intro: e.target.value || undefined })}
            />
            {err['copy.intro'] ? <span className="mt-1 block text-[11.5px] text-danger">{err['copy.intro']}</span> : null}
          </label>
          <div>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Index</span>
            <IndexEditor
              value={working.entries}
              onChange={entries => patch({ entries })}
              errors={pluckIndexedErrors(err, 'entries')}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pages" />
        <p className="text-[12px] text-muted">Each ships with built-in copy; a markdown override replaces the body entirely.</p>
        <div className="grid gap-4">
          {BUILT_IN_PAGES.map(({ key, label, hint }) => (
            <div key={key} className="rounded-lg border border-line p-3">
              <label className="flex items-start gap-2.5 py-1">
                <input
                  className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent"
                  type="checkbox"
                  checked={working.pages[key].enabled}
                  onChange={e => patchPage(key, { enabled: e.target.checked })}
                />
                <span>
                  <span className="block text-[13.5px] text-fg">{label}</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">{hint}</span>
                </span>
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Title (optional)</span>
                  <input
                    className={inputCls}
                    value={working.pages[key].title ?? ''}
                    placeholder={DEFAULT_PAGE_COPY[key].title}
                    maxLength={80}
                    onChange={e => patchPage(key, { title: e.target.value || undefined })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Eyebrow (optional)</span>
                  <input
                    className={inputCls}
                    value={working.pages[key].eyebrow ?? ''}
                    placeholder={DEFAULT_PAGE_COPY[key].eyebrow}
                    maxLength={80}
                    onChange={e => patchPage(key, { eyebrow: e.target.value || undefined })}
                  />
                </label>
              </div>
              <div className="mt-2">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
                  Markdown override (optional)
                </span>
                <textarea
                  className={inputCls}
                  rows={4}
                  value={working.pages[key].markdown ?? ''}
                  placeholder="Leave blank to use the built-in copy."
                  onChange={e => patchPage(key, { markdown: e.target.value || null })}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Copy" />
        <p className="text-[12px] text-muted">Chrome text shown around every page — the header, footer, and the stuck-card prompt.</p>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Tab title (optional)</span>
              <input
                className={inputCls}
                value={working.copy.tab_title ?? ''}
                placeholder={DEFAULT_PORTAL_COPY.tab_title}
                maxLength={160}
                onChange={e => patchCopy({ tab_title: e.target.value || undefined })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">"On this page" heading (optional)</span>
              <input
                className={inputCls}
                value={working.copy.toc_heading ?? ''}
                placeholder={DEFAULT_PORTAL_COPY.toc_heading}
                maxLength={80}
                onChange={e => patchCopy({ toc_heading: e.target.value || undefined })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Back label (optional)</span>
              <input
                className={inputCls}
                value={working.copy.back_label ?? ''}
                placeholder={DEFAULT_PORTAL_COPY.back_label}
                maxLength={80}
                onChange={e => patchCopy({ back_label: e.target.value || undefined })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Custom-page eyebrow (optional)</span>
              <input
                className={inputCls}
                value={working.copy.custom_page_eyebrow ?? ''}
                placeholder={DEFAULT_PORTAL_COPY.custom_page_eyebrow}
                maxLength={80}
                onChange={e => patchCopy({ custom_page_eyebrow: e.target.value || undefined })}
              />
            </label>
          </div>

          <div className="rounded-lg border border-line p-3">
            <label className="flex items-start gap-2.5 py-1">
              <input
                className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent"
                type="checkbox"
                checked={working.copy.show_stuck_card}
                onChange={e => patchCopy({ show_stuck_card: e.target.checked })}
              />
              <span>
                <span className="block text-[13.5px] text-fg">Show the "stuck?" card</span>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  Also hidden automatically when the Report an Issue page is disabled.
                </span>
              </span>
            </label>
            <div className="mt-2 grid gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Title (optional)</span>
                <input
                  className={inputCls}
                  value={working.copy.stuck_title ?? ''}
                  placeholder={DEFAULT_PORTAL_COPY.stuck_title}
                  maxLength={80}
                  onChange={e => patchCopy({ stuck_title: e.target.value || undefined })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Body (optional)</span>
                <input
                  className={inputCls}
                  value={working.copy.stuck_body ?? ''}
                  placeholder={DEFAULT_PORTAL_COPY.stuck_body}
                  maxLength={300}
                  onChange={e => patchCopy({ stuck_body: e.target.value || undefined })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Link label (optional)</span>
                <input
                  className={inputCls}
                  value={working.copy.stuck_link_label ?? ''}
                  placeholder={DEFAULT_PORTAL_COPY.stuck_link_label}
                  maxLength={80}
                  onChange={e => patchCopy({ stuck_link_label: e.target.value || undefined })}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-line p-3">
            <label className="flex items-start gap-2.5 py-1">
              <input
                className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent"
                type="checkbox"
                checked={working.copy.show_footer}
                onChange={e => patchCopy({ show_footer: e.target.checked })}
              />
              <span className="block text-[13.5px] text-fg">Show the footer</span>
            </label>
            <div className="mt-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Footer text (optional)</span>
                <input
                  className={inputCls}
                  value={working.copy.footer ?? ''}
                  placeholder={DEFAULT_PORTAL_COPY.footer}
                  maxLength={160}
                  onChange={e => patchCopy({ footer: e.target.value || undefined })}
                />
              </label>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Appearance" />
        <PortalAppearanceEditor value={working.appearance} onChange={appearance => patch({ appearance })} />
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" variant="primary" onClick={handleSave} disabled={isSaving} aria-busy={isSaving}>
          {isSaving ? 'Saving…' : 'Save portal settings'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => dialogRef.current?.showModal()}
          disabled={isReverting}
          aria-busy={isReverting}
        >
          {isReverting ? 'Reverting…' : 'Revert portal to file default'}
        </Button>
        {state.status === 'success' ? <span className="text-[13px] text-success">Saved and reloaded.</span> : null}
        {state.status === 'error' ? <span className="text-[13px] text-danger">Fix the highlighted fields.</span> : null}
        {revertError ? <span className="text-[13px] text-danger">{revertError}</span> : null}
      </div>

      <dialog ref={dialogRef} className="rounded-[10px] border border-line bg-canvas p-0 text-fg backdrop:bg-black/40">
        <div className="w-[min(92vw,440px)] p-5">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-fg">Revert portal settings to file default?</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            This discards the saved override for the portal section only, reverting it to the YAML config file. This
            cannot be undone.
          </p>
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
              onClick={confirmRevert}
              className="rounded-full bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger ring-1 ring-inset ring-danger/30 transition-colors hover:bg-danger/25"
            >
              Yes, revert portal settings
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

/** Extracts `${prefix}.N...` field errors into a map keyed by `N` for a list editor's per-row error prop. */
function pluckIndexedErrors(errors: Record<string, string>, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, message] of Object.entries(errors)) {
    if (!path.startsWith(`${prefix}.`)) continue;
    const rest = path.slice(prefix.length + 1);
    const index = rest.split('.')[0];
    if (index !== undefined && !(index in out)) out[index] = message;
  }
  return out;
}
