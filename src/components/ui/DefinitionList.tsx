import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DefinitionItem {
  label: string
  value: ReactNode
}

export function DefinitionList({ items, columns = 2 }: { items: DefinitionItem[]; columns?: 1 | 2 | 3 }) {
  const colsClass = columns === 3 ? 'sm:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : ''
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', colsClass)}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[12px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">{item.label}</dt>
          <dd className="mt-1 text-sm text-[var(--color-ink)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
