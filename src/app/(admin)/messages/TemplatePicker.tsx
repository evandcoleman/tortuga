'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface TemplateOption {
  slug: string;
  name: string;
  subject: string;
  body: string;
}

interface LastApplied {
  subject: string;
  body: string;
}

/**
 * Pure decision for whether applying a template should prompt a confirmation.
 * No confirmation is needed when the composer is empty, or when the current
 * content still matches the last template that was applied (i.e. nothing
 * has diverged since).
 */
export function shouldConfirmReplace({
  subject,
  body,
  lastApplied,
}: {
  subject: string;
  body: string;
  lastApplied: LastApplied | null;
}): boolean {
  if (subject.trim().length === 0 && body.trim().length === 0) return false;
  if (!lastApplied) return true;
  return subject !== lastApplied.subject || body !== lastApplied.body;
}

interface TemplatePickerProps {
  templates: TemplateOption[];
  subject: string;
  body: string;
  onApply: (template: { subject: string; body: string }) => void;
}

const PLACEHOLDER_VALUE = '';

/** "Start from a template" select shown above the compose form's subject field. */
export function TemplatePicker({ templates, subject, body, onApply }: TemplatePickerProps) {
  const [selectedSlug, setSelectedSlug] = useState(PLACEHOLDER_VALUE);
  const [lastApplied, setLastApplied] = useState<LastApplied | null>(null);

  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="template-picker"
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint"
        >
          Start from a template
        </label>
        <select
          id="template-picker"
          disabled
          className="w-full max-w-[240px] rounded-md border border-line bg-elevated px-3 py-1.5 text-[13px] text-faint"
        >
          <option>No templates yet</option>
        </select>
      </div>
    );
  }

  const onSelect = (slug: string) => {
    if (slug === PLACEHOLDER_VALUE) {
      setSelectedSlug(PLACEHOLDER_VALUE);
      return;
    }

    const template = templates.find(t => t.slug === slug);
    if (!template) return;

    if (shouldConfirmReplace({ subject, body, lastApplied })) {
      const confirmed = window.confirm('Replace the current subject and body?');
      if (!confirmed) {
        setSelectedSlug(PLACEHOLDER_VALUE);
        return;
      }
    }

    setSelectedSlug(slug);
    setLastApplied({ subject: template.subject, body: template.body });
    onApply({ subject: template.subject, body: template.body });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <label
          htmlFor="template-picker"
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint"
        >
          Start from a template
        </label>
        <select
          id="template-picker"
          value={selectedSlug}
          onChange={e => onSelect(e.target.value)}
          className="rounded-md border border-line bg-canvas px-3 py-1.5 text-[13px] text-fg focus:border-accent focus:outline-none"
        >
          <option value={PLACEHOLDER_VALUE}>Choose a template…</option>
          {templates.map(t => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <Link href="/messages/templates" className="text-[12px] font-medium text-accent hover:opacity-90">
        Manage templates →
      </Link>
    </div>
  );
}
