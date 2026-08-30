'use client';

interface Recipient {
  email: string;
  name: string;
}

interface RecipientChecklistProps {
  recipients: Recipient[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}

export function RecipientChecklist({ recipients, selected, onChange }: RecipientChecklistProps) {
  const selectAll = () => onChange(new Set(recipients.map(r => r.email)));
  const selectNone = () => onChange(new Set());
  const toggle = (email: string) => {
    const next = new Set(selected);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="text-[12.5px] font-medium text-fg">
          Recipients{' '}
          <span className="font-mono text-[12px] text-muted">
            ({selected.size} of {recipients.length} selected)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[12px] font-medium">
          <button type="button" onClick={selectAll} className="text-gold hover:opacity-90">
            Select all
          </button>
          <button type="button" onClick={selectNone} className="text-muted hover:text-fg">
            Select none
          </button>
        </div>
      </div>
      {recipients.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted">No active recipients.</p>
      ) : (
        <ul className="max-h-64 divide-y divide-line overflow-y-auto">
          {recipients.map(r => (
            <li key={r.email}>
              <label className="flex cursor-pointer items-center gap-2.5 px-4 py-2 text-[13px] hover:bg-elevated/50">
                <input
                  type="checkbox"
                  checked={selected.has(r.email)}
                  onChange={() => toggle(r.email)}
                  className="h-3.5 w-3.5 rounded-sm border-line accent-gold"
                />
                <span className="text-fg">{r.name}</span>
                <span className="text-faint">·</span>
                <span className="truncate text-muted">{r.email}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
