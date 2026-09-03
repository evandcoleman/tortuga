import * as React from 'react';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-elevated text-muted ring-1 ring-inset ring-line',
  accent: 'bg-accent/12 text-accent ring-1 ring-inset ring-accent/30',
  success: 'bg-success/12 text-success ring-1 ring-inset ring-success/30',
  warning: 'bg-warning/12 text-warning ring-1 ring-inset ring-warning/30',
  danger: 'bg-danger/12 text-danger ring-1 ring-inset ring-danger/30',
  info: 'bg-info/12 text-info ring-1 ring-inset ring-info/30',
};

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${toneStyles[tone]} ${className}`}
      {...rest}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
      <div className="max-w-2xl">
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-fg">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-[14px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface shadow-soft ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
}) {
  const accent: Record<Tone, string> = {
    neutral: 'text-fg',
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-info',
  };
  return (
    <Card>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className={`mt-2 font-display text-[32px] font-semibold leading-none tracking-[-0.02em] ${accent[tone]}`}>
        {value}
      </div>
      {hint ? <div className="mt-2 text-[12.5px] text-muted">{hint}</div> : null}
    </Card>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hi focus-visible:ring-accent/50 shadow-soft',
  secondary:
    'bg-elevated text-fg ring-1 ring-inset ring-line hover:bg-surface hover:ring-line-strong focus-visible:ring-line-strong',
  ghost: 'bg-transparent text-muted hover:bg-elevated hover:text-fg focus-visible:ring-line',
  danger:
    'bg-danger/15 text-danger ring-1 ring-inset ring-danger/30 hover:bg-danger/25 focus-visible:ring-danger/50',
};

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium tracking-[-0.005em] transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-line-strong bg-panel/40 px-6 py-16 text-center">
      {icon ? <div className="mb-4 text-faint">{icon}</div> : null}
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-soft">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-elevated/60 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
      {children}
    </thead>
  );
}

export function TH({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 font-medium ${className}`}>{children}</th>;
}

export function TR({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <tr className={`border-t border-line transition hover:bg-elevated/50 ${className}`}>{children}</tr>;
}

export function TD({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-sm bg-elevated px-1.5 py-0.5 font-mono text-[12px] text-muted">
      {children}
    </code>
  );
}

const DIGEST_TONE: Record<string, Tone> = {
  pending: 'neutral',
  rendered: 'info',
  sending: 'warning',
  sent: 'success',
  skipped: 'neutral',
  failed: 'danger',
};
export function DigestStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={DIGEST_TONE[status] ?? 'neutral'} dot>
      {status}
    </Badge>
  );
}

export function formatDateTime(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatRelative(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 3600_000],
    ['month', 30 * 24 * 3600_000],
    ['week', 7 * 24 * 3600_000],
    ['day', 24 * 3600_000],
    ['hour', 3600_000],
    ['minute', 60_000],
    ['second', 1000],
  ];
  for (const [unit, ms] of ranges) {
    if (abs >= ms || unit === 'second') {
      const value = Math.round(diffMs / ms);
      return rtf.format(value, unit);
    }
  }
  return rtf.format(0, 'second');
}
