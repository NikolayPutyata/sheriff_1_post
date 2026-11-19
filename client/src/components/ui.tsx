import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { STATUS_LABELS, type HandoverStatus } from '@journal/shared';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl bg-card p-4 shadow-sm', className)}>{children}</div>;
}

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-text',
  secondary: 'bg-accent/10 text-accent',
  danger: 'bg-danger/10 text-danger',
  success: 'bg-emerald-600 text-white',
  ghost: 'text-accent',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4',
        size === 'lg' && 'h-14 px-6 text-lg',
        variants[variant],
        className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'size-6' }: { className?: string }) {
  return <span className={cx('inline-block animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}

export function FullScreenMessage({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-5xl">{icon}</div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {text && <p className="max-w-sm text-hint">{text}</p>}
      {action}
    </div>
  );
}

const statusStyles: Record<HandoverStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  received: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-300',
  with_manager: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  legal: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};

export function StatusBadge({ status }: { status: HandoverStatus }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', statusStyles[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{children}</p>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-card p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 flex-1 truncate rounded-lg px-2 text-sm font-medium transition',
            value === o.value ? 'bg-accent text-accent-text' : 'text-hint',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
