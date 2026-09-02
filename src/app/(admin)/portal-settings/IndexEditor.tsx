'use client';

import { PORTAL_BUILTIN_LINKS, PORTAL_BUILTIN_PAGES, type PortalEntry } from '@/kernel/config/schema';
import { DEFAULT_BUILTIN_LINK_COPY, DEFAULT_BUILTIN_PAGE_COPY } from '@/modules/portal/copy';
import { IndexEntryRow } from './IndexEntryRow';
import type { IndexEntryRowState } from './entryRows';

interface IndexEditorProps {
  value: IndexEntryRowState[];
  onChange: (next: IndexEntryRowState[]) => void;
  errors: Record<string, string>;
}

function emptyLink(): PortalEntry {
  return { type: 'link', label: '', url: '' };
}

function emptyPage(): PortalEntry {
  return { type: 'page', slug: '', label: '', markdown: '' };
}

const addButtonCls =
  'rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg';

/**
 * Ordered editor for `portal.entries`, the unified home-index list — see
 * docs/specs/2026-09-01-portal-copy-and-index.md §§1, 6. Built-in rows (a
 * page or link the kernel already knows how to resolve) can be hidden or
 * relabeled but not removed outright; custom `link`/`page` rows keep their
 * full field set and can be deleted. "Add" offers external link, page, and
 * whichever built-ins aren't already in the list.
 */
export function IndexEditor({ value, onChange, errors }: IndexEditorProps) {
  function update(id: string, patch: Partial<PortalEntry>) {
    const next = value.map(row => (row.id === id ? { ...row, entry: { ...row.entry, ...patch } as PortalEntry } : row));
    onChange(next);
  }

  function remove(id: string) {
    onChange(value.filter(row => row.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const index = value.findIndex(row => row.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  const entries = value.map(row => row.entry);
  const presentPages = new Set(entries.filter(e => e.type === 'builtin_page').map(e => e.page));
  const presentLinks = new Set(entries.filter(e => e.type === 'builtin_link').map(e => e.link));
  const missingPages = PORTAL_BUILTIN_PAGES.filter(page => !presentPages.has(page));
  const missingLinks = PORTAL_BUILTIN_LINKS.filter(link => !presentLinks.has(link));

  return (
    <div className="grid gap-3">
      {value.map((row, index) => (
        <IndexEntryRow
          key={row.id}
          entry={row.entry}
          index={index}
          total={value.length}
          error={errors[String(index)]}
          onChange={patch => update(row.id, patch)}
          onRemove={() => remove(row.id)}
          onMoveUp={() => move(row.id, -1)}
          onMoveDown={() => move(row.id, 1)}
        />
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([...value, { id: crypto.randomUUID(), entry: emptyLink() }])}
          className={addButtonCls}
        >
          + Add link
        </button>
        <button
          type="button"
          onClick={() => onChange([...value, { id: crypto.randomUUID(), entry: emptyPage() }])}
          className={addButtonCls}
        >
          + Add page
        </button>
        {missingPages.map(page => (
          <button
            key={page}
            type="button"
            onClick={() =>
              onChange([...value, { id: `builtin_page:${page}`, entry: { type: 'builtin_page', page, hidden: false } }])
            }
            className={addButtonCls}
          >
            + Add {DEFAULT_BUILTIN_PAGE_COPY[page].label}
          </button>
        ))}
        {missingLinks.map(link => (
          <button
            key={link}
            type="button"
            onClick={() =>
              onChange([...value, { id: `builtin_link:${link}`, entry: { type: 'builtin_link', link, hidden: false } }])
            }
            className={addButtonCls}
          >
            + Add {DEFAULT_BUILTIN_LINK_COPY[link].label}
          </button>
        ))}
      </div>
    </div>
  );
}
