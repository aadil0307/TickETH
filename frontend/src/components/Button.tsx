'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, icon, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]',
        {
          primary: 'bg-primary text-white hover:bg-primary-light shadow-lg shadow-primary/25',
          secondary: 'bg-surface-light text-foreground hover:bg-border',
          outline: 'border border-border text-foreground hover:bg-surface-light hover:border-muted',
          ghost: 'text-muted hover:text-foreground hover:bg-surface-light',
          danger: 'bg-error text-white hover:bg-red-600 shadow-lg shadow-error/20',
          accent: 'bg-accent text-background hover:bg-accent-light shadow-lg shadow-accent/25 font-bold',
        }[variant],
        {
          xs: 'h-7 px-2.5 text-xs rounded-lg',
          sm: 'h-8 px-3 text-xs',
          md: 'h-10 px-4 text-sm',
          lg: 'h-12 px-6 text-base',
        }[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
