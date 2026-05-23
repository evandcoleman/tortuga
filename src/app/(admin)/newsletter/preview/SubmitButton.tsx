'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '../../_components/ui';

type Variant = React.ComponentProps<typeof Button>['variant'];

export function SubmitButton({
  variant = 'secondary',
  pendingLabel,
  disabled,
  title,
  children,
}: {
  variant?: Variant;
  pendingLabel: string;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending || disabled}
      title={title}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Spinner /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
