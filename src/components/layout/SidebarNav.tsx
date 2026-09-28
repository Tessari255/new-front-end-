import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navigation'
import { BrandMark } from './BrandMark'
import { DemoBadge } from './DemoBadge'
import { RestaurarDemonstracaoButton } from './RestaurarDemonstracaoButton'
import { cn } from '@/lib/utils'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-5 pt-6">
        <BrandMark />
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13.5px] font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]'
                  : 'text-[var(--color-ink-muted)] hover:bg-black/[0.035] hover:text-[var(--color-ink)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-subtle)]')} aria-hidden="true" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3 border-t border-[var(--color-border)] px-4 py-4">
        <DemoBadge />
        <RestaurarDemonstracaoButton variant="secondary" />
      </div>
    </div>
  )
}
