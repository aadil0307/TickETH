import { cn } from '@/lib/cn';

export function StatCard({
  label,
  title,
  value,
  icon,
  trend,
  className,
  loading,
}: {
  label?: string;
  title?: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  className?: string;
  loading?: boolean;
}) {
  const displayLabel = label ?? title ?? '';
  return (
    <div className={cn(
      'rounded-2xl border border-border bg-surface p-5 flex items-start gap-4 transition-colors hover:border-primary/30',
      className,
    )}>
      {icon && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-muted truncate">{displayLabel}</p>
        {loading ? (
          <div className="mt-1.5 h-7 w-20 rounded-lg animate-shimmer" />
        ) : (
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        )}
        {trend && <p className="mt-0.5 text-xs text-success font-medium">{trend}</p>}
      </div>
    </div>
  );
}
