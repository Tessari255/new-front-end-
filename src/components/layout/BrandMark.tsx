import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[13px] font-bold text-white">
        {brand.initials}
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-tight text-[var(--color-ink)]">{brand.name}</span>
          <span className="block truncate text-[11px] leading-tight text-[var(--color-ink-subtle)]">{brand.tagline}</span>
        </span>
      )}
    </div>
  )
}
