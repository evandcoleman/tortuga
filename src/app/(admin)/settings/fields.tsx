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

export function TextField({ name, label, defaultValue = '', hint, error, type = 'text', placeholder, disabled }: {
  name: string; label: string; defaultValue?: string; hint?: string; error?: string; type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <input
        className={`${inputCls} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
      />
    </Wrap>
  );
}

/**
 * Text field for a non-secret managed value (e.g. a service URL) that may be
 * sourced from an env var. When `source === 'env'` the input is disabled and
 * annotated with the env var name — a DB value may exist underneath but is
 * inert, so it's never shown alongside the note.
 */
export function ManagedTextField({ name, label, value, source, envVar, error, placeholder }: {
  name: string; label: string; value: string; source: 'env' | 'db' | undefined; envVar: string; error?: string; placeholder?: string;
}) {
  const isEnv = source === 'env';
  return (
    <TextField
      name={name}
      label={label}
      defaultValue={isEnv ? '' : value}
      placeholder={isEnv ? value : placeholder}
      hint={isEnv ? `Set via ${envVar}` : undefined}
      error={error}
      disabled={isEnv}
    />
  );
}

/**
 * Secret field per the settings spec: an env-sourced secret is disabled with a
 * note and never rendered (not even as a placeholder); a DB-stored secret shows
 * a masked "saved" placeholder — blank submit keeps it, typing replaces it, and
 * the paired "Clear" checkbox (submitted as `${name}__clear`) deletes it. The
 * actual secret value is never sent to the client in either case.
 */
export function SecretField({ name, label, source, envVar, hint }: {
  name: string; label: string; source: 'env' | 'db' | undefined; envVar: string; hint?: string;
}) {
  const isEnv = source === 'env';
  const isSet = source === 'db';
  return (
    <div>
      <Wrap label={label} hint={isEnv ? `Set via ${envVar}` : hint}>
        <input
          className={`${inputCls} ${isEnv ? 'cursor-not-allowed opacity-60' : ''}`}
          name={name}
          type="password"
          autoComplete="off"
          placeholder={isEnv ? '••••••••' : isSet ? '•••••••• saved' : ''}
          disabled={isEnv}
        />
      </Wrap>
      {isSet && !isEnv ? (
        <label className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted">
          <input type="checkbox" name={`${name}__clear`} className="h-3 w-3 rounded border-line accent-danger" />
          Clear saved value
        </label>
      ) : null}
    </div>
  );
}

export function NumberField({ name, label, defaultValue, hint, error, step, min, max, placeholder }: {
  name: string; label: string; defaultValue?: number; hint?: string; error?: string; step?: string; min?: number; max?: number; placeholder?: string;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <input
        className={inputCls}
        name={name}
        type="number"
        defaultValue={defaultValue}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
      />
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

export function SelectField({ name, label, defaultValue, options, hint, error, onChange }: {
  name: string; label: string; defaultValue: string; options: ReadonlyArray<{ value: string; label: string }>; hint?: string; error?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <select
        className={inputCls}
        name={name}
        defaultValue={defaultValue}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
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
