import { cn } from '@/lib/cn';
import { statusBg } from '@/lib/utils';

export function Badge({
  status,
  label,
  className,
  dot,
}: {
  status?: string;
  label?: string;
  className?: string;
  dot?: boolean;
}) {
  const text = label ?? status ?? '';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        status ? statusBg(status) : 'bg-surface-light text-muted',
        className,
      )}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {text}
    </span>
  );
}
