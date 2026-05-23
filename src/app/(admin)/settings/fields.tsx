'use client';

import * as React from 'react';

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[14px] text-fg focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30';

function Wrap({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-[11.5px] text-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-[11.5px] text-danger">{error}</span> : null}
    </label>
  );
}

export function TextField({ name, label, defaultValue = '', hint, error, type = 'text', placeholder }: {
  name: string; label: string; defaultValue?: string; hint?: string; error?: string; type?: string; placeholder?: string;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <input className={inputCls} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} />
    </Wrap>
  );
}

export function NumberField({ name, label, defaultValue, hint, error, step, min, max }: {
  name: string; label: string; defaultValue: number; hint?: string; error?: string; step?: string; min?: number; max?: number;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <input className={inputCls} name={name} type="number" defaultValue={defaultValue} step={step} min={min} max={max} />
    </Wrap>
  );
}

export function TextareaField({ name, label, defaultValue = '', hint, error, rows = 3 }: {
  name: string; label: string; defaultValue?: string; hint?: string; error?: string; rows?: number;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <textarea className={inputCls} name={name} defaultValue={defaultValue} rows={rows} />
    </Wrap>
  );
}

export function SelectField({ name, label, defaultValue, options, hint, error }: {
  name: string; label: string; defaultValue: string; options: ReadonlyArray<{ value: string; label: string }>; hint?: string; error?: string;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <select className={inputCls} name={name} defaultValue={defaultValue}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Wrap>
  );
}

export function CheckboxField({ name, label, defaultChecked, hint }: {
  name: string; label: string; defaultChecked: boolean; hint?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 py-1">
      <input className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent-gold" name={name} type="checkbox" defaultChecked={defaultChecked} />
      <span>
        <span className="block text-[13.5px] text-fg">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11.5px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
