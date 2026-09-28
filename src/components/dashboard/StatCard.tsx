import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: LucideIcon
  label: string
  value: string | number
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
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-card)]">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]', toneClasses[tone])}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium text-[var(--color-ink-muted)]">{label}</p>
        <p className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">{value}</p>
      </div>
    </div>
  )
}
