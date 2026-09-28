import { Menu } from 'lucide-react'
import { useTituloRota } from './useTituloRota'
import { PlantSelector } from './PlantSelector'
import { SearchBar } from './SearchBar'
import { ProfileSwitcher } from './ProfileSwitcher'
import { Button } from '@/components/ui/Button'

export function Topbar({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  const titulo = useTituloRota()
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-white/85 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onAbrirMenu} aria-label="Abrir menu de navegação">
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      <h1 className="hidden truncate text-[15px] font-semibold text-[var(--color-ink)] sm:block sm:w-40 lg:w-auto">{titulo}</h1>

      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2.5 sm:flex-none sm:gap-3">
        <div className="hidden md:block">
          <SearchBar />
        </div>
        <div className="hidden md:block">
          <PlantSelector />
        </div>
        <ProfileSwitcher />
      </div>
    </header>
  )
}
