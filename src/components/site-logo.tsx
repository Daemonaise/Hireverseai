export function SiteLogo({ className, variant }: { className?: string; variant?: 'dark' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={variant === 'dark' ? '/hireverse-logo-dark.svg' : '/hireverse-logo.svg'}
      alt="Hireverse"
      className={className ?? 'h-9 w-auto'}
    />
  );
}
