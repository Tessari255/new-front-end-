import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-1">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--color-ink-muted)]">
        {items.map((item, idx) => {
          const ultimo = idx === items.length - 1
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className="size-3.5 text-[var(--color-ink-subtle)]" aria-hidden="true" />}
              {item.to && !ultimo ? (
                <Link to={item.to} className="rounded transition-colors hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
                  {item.label}
                </Link>
              ) : (
                <span className={ultimo ? 'font-medium text-[var(--color-ink)]' : ''} aria-current={ultimo ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
