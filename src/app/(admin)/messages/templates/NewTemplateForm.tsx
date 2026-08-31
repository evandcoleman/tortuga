'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '../../_components/ui';

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewTemplateForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();

  const slug = slugify(name);
  const canCreate = name.trim().length > 0 && slug.length > 0 && !isCreating;

  const onCreate = () => {
    setError(null);
    startCreating(async () => {
      try {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, name: name.trim(), subject: name.trim(), body: 'Write your message…' }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Failed to create template.');
          return;
        }
        router.push(`/messages/templates/${data.template.slug}`);
      } catch {
        setError('Failed to create template.');
      }
    });
  };

  return (
    <Card>
      <CardHeader title="New template" description="Give it a name — you can write the content next." />
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="new-template-name" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
            Name
          </label>
          <input
            id="new-template-name"
            type="text"
            value={name}
            maxLength={200}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Season finale"
            className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-faint focus:border-gold focus:outline-none"
          />
          {slug ? <p className="mt-1 font-mono text-[11px] text-faint">Slug: {slug}</p> : null}
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={!canCreate}
          aria-busy={isCreating}
          className="rounded-md bg-gold px-3.5 py-2 text-[13px] font-medium text-gold-ink transition hover:bg-gold-hi disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? 'Creating…' : 'Create template'}
        </button>
        {error ? <span className="text-[12px] font-medium text-red-600">{error}</span> : null}
      </div>
    </Card>
  );
}
