import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
  tone = 'neutral',
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  to: string
  tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'success'
}) {
  const toneClasses: Record<string, string> = {
    neutral: 'bg-slate-50 text-[var(--color-ink-muted)]',
    accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  }

  return (
    <Link
      to={to}
      className="group flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
    >
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-[var(--color-ink-muted)]">{label}</span>
        <span className={cn('flex size-9 items-center justify-center rounded-[var(--radius-md)]', toneClasses[tone])}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3">
        <p className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">{value}</p>
        {hint && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{hint}</p>}
      </div>
    </Link>
  )
}
