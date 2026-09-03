'use client';

import type { LibraryRule } from '@/modules/newsletter/appearance/schema';
import { LAYOUT_OPTIONS } from '@/modules/newsletter/templates/layouts';

interface LibraryEditorProps {
  rules: LibraryRule[];
  knownLibraries: string[];
  onChange: (next: LibraryRule[]) => void;
}

export function LibraryEditor({ rules, knownLibraries, onChange }: LibraryEditorProps) {
  function updateRule(index: number, patch: Partial<LibraryRule>) {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  function moveRule(index: number, direction: -1 | 1) {
    const next = [...rules];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const temp = next[index]!;
    next[index] = next[target]!;
    next[target] = temp;
    onChange(next);
  }

  function addLibrary(name: string) {
    if (!name.trim()) return;
    const alreadyPresent = rules.some(r => r.name === name.trim());
    if (alreadyPresent) return;
    onChange([...rules, { name: name.trim(), enabled: true }]);
  }

  // Libraries from knownLibraries not yet in rules
  const unaddedLibraries = knownLibraries.filter(lib => !rules.some(r => r.name === lib));

  return (
    <div className="space-y-3">
      {rules.length === 0 && (
        <p className="text-[12px] text-faint">
          No custom library rules — all libraries will appear in alphabetical order.
        </p>
      )}

      {rules.map((rule, i) => (
        <div
          key={`${rule.name}-${i}`}
          className="rounded-lg border border-line bg-surface p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[13px] font-medium text-fg truncate">{rule.name}</span>
            <label className="flex items-center gap-1 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={rule.enabled !== false}
                onChange={e => updateRule(i, { enabled: e.target.checked })}
                className="accent"
              />
              Visible
            </label>
            <button
              type="button"
              aria-label={`Move ${rule.name} up`}
              disabled={i === 0}
              onClick={() => moveRule(i, -1)}
              className="rounded px-1.5 py-0.5 text-[12px] text-muted hover:bg-surface disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${rule.name} down`}
              disabled={i === rules.length - 1}
              onClick={() => moveRule(i, 1)}
              className="rounded px-1.5 py-0.5 text-[12px] text-muted hover:bg-surface disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`Remove ${rule.name}`}
              onClick={() => removeRule(i)}
              className="rounded px-1.5 py-0.5 text-[12px] text-danger hover:bg-surface"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
                Display title
              </label>
              <input
                type="text"
                placeholder={rule.name}
                value={rule.title ?? ''}
                onChange={e => updateRule(i, { title: e.target.value || undefined })}
                maxLength={120}
                className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
                Max items
              </label>
              <input
                type="number"
                min={1}
                max={100}
                placeholder="Default"
                value={rule.max_items ?? ''}
                onChange={e => {
                  const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
                  updateRule(i, { max_items: v && v > 0 ? v : undefined });
                }}
                className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
              Layout override
            </label>
            <select
              value={rule.layout ?? ''}
              onChange={e => updateRule(i, { layout: e.target.value || undefined })}
              className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-fg focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Default</option>
              {LAYOUT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      {/* Add from known libraries */}
      {unaddedLibraries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unaddedLibraries.map(lib => (
            <button
              key={lib}
              type="button"
              onClick={() => addLibrary(lib)}
              className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted hover:bg-surface hover:text-fg"
            >
              + {lib}
            </button>
          ))}
        </div>
      )}

      {/* Free-text add for libraries not in known list */}
      <AddLibraryInput onAdd={addLibrary} />
    </div>
  );
}

function AddLibraryInput({ onAdd }: { onAdd: (name: string) => void }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('newLib') as HTMLInputElement;
    if (input.value.trim()) {
      onAdd(input.value.trim());
      input.value = '';
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        name="newLib"
        placeholder="Add library by name…"
        maxLength={120}
        className="flex-1 rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <button
        type="submit"
        className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-ink hover:opacity-90"
      >
        Add
      </button>
    </form>
  );
}
