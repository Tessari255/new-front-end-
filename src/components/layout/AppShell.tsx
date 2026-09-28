import * as React from 'react'
import { Outlet } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { SidebarNav } from './SidebarNav'
import { Topbar } from './Topbar'
import { PlantSelector } from './PlantSelector'
import { SearchBar } from './SearchBar'

export function AppShell() {
  const [menuAberto, setMenuAberto] = React.useState(false)

  return (
    <div className="flex min-h-dvh bg-[var(--color-bg)]">
      {/* Sidebar fixa — desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] bg-white lg:block">
        <div className="fixed h-dvh w-60">
          <SidebarNav />
        </div>
      </aside>

      {/* Menu de navegação — mobile (drawer) */}
      <DialogPrimitive.Root open={menuAberto} onOpenChange={setMenuAberto}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[var(--color-ink)]/40 lg:hidden" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-[var(--shadow-popover)] focus:outline-none lg:hidden"
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Menu de navegação</DialogPrimitive.Title>
            <DialogPrimitive.Close className="absolute right-3 top-4 rounded-[var(--radius-sm)] p-1.5 text-[var(--color-ink-muted)] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Fechar menu</span>
            </DialogPrimitive.Close>
            <SidebarNav onNavigate={() => setMenuAberto(false)} />
            <div className="space-y-3 border-t border-[var(--color-border)] px-4 py-4">
              <SearchBar />
              <PlantSelector />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <Topbar onAbrirMenu={() => setMenuAberto(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
