'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type { PortalConfig, PortalCustomEntry, PortalPageConfigSchema } from '@/kernel/config/schema';
import { z } from 'zod';
import { Button, Card, CardHeader } from '../../_components/ui';
import { savePortalSettings, revertPortalSettings, type SaveState } from './actions';
import { CustomEntriesEditor } from './CustomEntriesEditor';
import { PortalAppearanceEditor } from './PortalAppearanceEditor';

type PortalPageConfig = z.infer<typeof PortalPageConfigSchema>;

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[14px] text-fg focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30';

const initial: SaveState = { status: 'idle' };

const BUILT_IN_PAGES: Array<{ key: 'getting_started' | 'rules' | 'report_issue'; label: string; hint: string }> = [
  { key: 'getting_started', label: 'Getting Started', hint: 'Invite → install app → pick server → stream.' },
  { key: 'rules', label: 'Rules', hint: 'House rules for sharing the server.' },
  { key: 'report_issue', label: 'Report an Issue', hint: 'Points visitors at the request service’s issue flow.' },
];

export function PortalForm({ config }: { config: PortalConfig }) {
  const [working, setWorking] = useState<PortalConfig>(config);
  const [state, setState] = useState<SaveState>(initial);
  const [isSaving, startSaving] = useTransition();
  const [isReverting, startReverting] = useTransition();
  const [revertError, setRevertError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const err = state.status === 'error' ? state.errors : {};

  function patch(next: Partial<PortalConfig>) {
    setWorking(prev => ({ ...prev, ...next }));
  }

  function patchLinks(next: Partial<PortalConfig['links']>) {
    setWorking(prev => ({ ...prev, links: { ...prev.links, ...next } }));
  }

  function patchPage(key: 'getting_started' | 'rules' | 'report_issue', next: Partial<PortalPageConfig>) {
    setWorking(prev => ({ ...prev, pages: { ...prev.pages, [key]: { ...prev.pages[key], ...next } } }));
  }

  function handleCustomChange(custom: PortalCustomEntry[]) {
    patch({ custom });
  }

  function handleSave() {
    setState(initial);
    startSaving(async () => {
      const result = await savePortalSettings(initial, working);
      setState(result);
    });
  }

  function confirmRevert() {
    dialogRef.current?.close();
    setRevertError(null);
    startReverting(async () => {
      try {
        const reverted = await revertPortalSettings();
        setWorking(reverted);
      } catch {
        setRevertError('Revert failed. Please try again.');
      }
    });
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader
          title="Portal"
          description="A small branded public site (buttons + a few content pages) served on your own domain."
        />
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
          <div className="flex items-end">
            <Link href="/portal" target="_blank" className="text-[13px] font-medium text-gold transition hover:text-gold-hi">
              Preview portal →
            </Link>
          </div>
        </div>
        <div className="mt-3">
          <label className="flex items-start gap-2.5 py-1">
            <input
              className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent-gold"
              type="checkbox"
              checked={working.enabled}
              onChange={e => patch({ enabled: e.target.checked })}
            />
            <span>
              <span className="block text-[13.5px] text-fg">Enable the portal</span>
              <span className="mt-0.5 block text-[11.5px] text-muted">
                Off 404s the portal everywhere, on the domain and via the preview link above.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Links" description="Big buttons on the portal home page." />
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
        <CardHeader title="Pages" description="Each ships with built-in copy; a markdown override replaces the body entirely." />
        <div className="grid gap-4">
          {BUILT_IN_PAGES.map(({ key, label, hint }) => (
            <div key={key} className="rounded-lg border border-line p-3">
              <label className="flex items-start gap-2.5 py-1">
                <input
                  className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent-gold"
                  type="checkbox"
                  checked={working.pages[key].enabled}
                  onChange={e => patchPage(key, { enabled: e.target.checked })}
                />
                <span>
                  <span className="block text-[13.5px] text-fg">{label}</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">{hint}</span>
                </span>
              </label>
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
        <CardHeader title="Custom entries" description="Extra buttons on the home grid: external links or your own content pages." />
        <CustomEntriesEditor
          value={working.custom}
          onChange={handleCustomChange}
          errors={pluckIndexedErrors(err, 'custom')}
        />
      </Card>

      <Card>
        <CardHeader title="Appearance" description="Theme for the portal's chrome — inherit the newsletter's look, or pick your own." />
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
