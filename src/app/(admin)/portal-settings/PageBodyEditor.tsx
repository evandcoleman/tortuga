'use client';

import { useState } from 'react';
import type { PortalEntry } from '@/kernel/config/schema';

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[13.5px] text-fg focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30';

type PageEntry = Extract<PortalEntry, { type: 'page' }>;

/**
 * Markdown/HTML body editor for a custom `page` entry — exactly one of
 * `markdown`/`html` is set, enforced server-side by `PortalConfigSchema` and
 * surfaced via the row's `error` prop.
 */
export function PageBodyEditor({
  entry,
  bodyId,
  onChange,
}: {
  entry: PageEntry;
  bodyId: string;
  onChange: (patch: Partial<PageEntry>) => void;
}) {
  // The mode is tracked here rather than inferred from `entry.html.length > 0`:
  // a fresh page entry (or one whose html is still blank) would otherwise never
  // be able to switch to HTML mode, since typing into the HTML textarea while
  // it's still empty would keep re-deriving "markdown" and route keystrokes to
  // the wrong field. Initial value still infers from the entry so an existing
  // html-bodied entry opens in the right mode.
  const [bodyMode, setBodyMode] = useState<'markdown' | 'html'>(() =>
    typeof entry.html === 'string' && entry.html.length > 0 ? 'html' : 'markdown',
  );

  function switchTo(mode: 'markdown' | 'html') {
    setBodyMode(mode);
    // Keep the markdown-xor-html invariant: moving the current text across and
    // clearing the other field, same as before.
    onChange(
      mode === 'markdown'
        ? { markdown: entry.html ?? '', html: undefined }
        : { html: entry.markdown ?? '', markdown: undefined },
    );
  }

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Body</span>
        <div className="flex gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => switchTo('markdown')}
            className={bodyMode === 'markdown' ? 'font-semibold text-gold' : 'text-muted hover:text-fg'}
          >
            Markdown
          </button>
          <span className="text-faint">/</span>
          <button
            type="button"
            onClick={() => switchTo('html')}
            className={bodyMode === 'html' ? 'font-semibold text-gold' : 'text-muted hover:text-fg'}
          >
            HTML
          </button>
        </div>
      </div>
      <textarea
        id={bodyId}
        className={inputCls}
        rows={5}
        value={bodyMode === 'html' ? (entry.html ?? '') : (entry.markdown ?? '')}
        onChange={e => onChange(bodyMode === 'html' ? { html: e.target.value } : { markdown: e.target.value })}
      />
    </div>
  );
}
