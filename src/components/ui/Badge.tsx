import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Tom } from '@/lib/rotulos'

const tomClasses: Record<Tom, string> = {
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success-border)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger-border)]',
  info: 'bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info-border)]',
  neutral: 'bg-slate-100 text-[var(--color-ink-muted)] border-slate-200',
}

const dotClasses: Record<Tom, string> = {
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  info: 'bg-[var(--color-info)]',
  neutral: 'bg-[var(--color-ink-subtle)]',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tom?: Tom
  comPonto?: boolean
}

export function Badge({ tom = 'neutral', comPonto = true, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tomClasses[tom],
        className,
      )}
      {...props}
    >
      {comPonto && <span className={cn('size-1.5 rounded-full', dotClasses[tom])} aria-hidden="true" />}
      {children}
    </span>
  )
}
