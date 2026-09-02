import type { SVGProps } from 'react';

/** Shared 24px, 1.5px-stroke inline icon set for the portal's "Masthead" chrome. No emoji. */
function BaseIcon({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Internal-link row arrow: a plain rightward arrow. */
export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </BaseIcon>
  );
}

/** External-link row arrow: an up-right "opens elsewhere" arrow. */
export function ArrowUpRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </BaseIcon>
  );
}

/** "Back to index" chrome link. */
export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M19 12H5" />
      <path d="M11 18l-6-6 6-6" />
    </BaseIcon>
  );
}
