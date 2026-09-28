import * as React from 'react'
import { UserCog, ChevronDown, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useToast } from '@/components/ui/Toast'
import { useAppStore } from '@/store/useAppStore'
import { PERFIS_DEMO } from '@/data/perfis'
import { trocarUsuarioDemo } from '@/services/bootstrapService'
import { microsoftAuthEnabled, signOutFromMicrosoft } from '@/lib/microsoftAuth'
import { emailSenhaAuthEnabled, sair as sairDaSessao } from '@/services/authService'
import { cn } from '@/lib/utils'

const CLASSE_TRIGGER =
  'flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-left shadow-sm transition-colors hover:bg-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'

/** Exibe a sessão corporativa ou troca entre os usuários seedados no modo de demonstração. */
export function ProfileSwitcher() {
  const currentUser = useAppStore((s) => s.currentUser)
  const usuarios = useAppStore((s) => s.usuariosDemo)
  const { notificarErro } = useToast()
  const [trocando, setTrocando] = React.useState(false)
  if (!currentUser) return null
  const perfil = PERFIS_DEMO.find((p) => p.id === currentUser.perfil)
  const sessaoReal = emailSenhaAuthEnabled || microsoftAuthEnabled

  const conteudo = (
    <>
      <span className="flex size-7 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]">
        <UserCog className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-[190px] truncate text-[13px] font-medium leading-tight text-[var(--color-ink)]">{currentUser.nome}</span>
        <span className="block text-[11px] leading-tight text-[var(--color-ink-subtle)]">
          {perfil?.nome ?? currentUser.perfil} · {sessaoReal ? 'sessão corporativa' : 'usuário de demonstração'}
        </span>
      </span>
    </>
  )

  async function sair() {
    setTrocando(true)
    try {
      await (emailSenhaAuthEnabled ? sairDaSessao() : signOutFromMicrosoft())
    } catch (erro) {
      notificarErro(erro, 'Não foi possível encerrar a sessão')
    } finally {
      setTrocando(false)
    }
  }

  if (sessaoReal) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={CLASSE_TRIGGER} disabled={trocando} aria-busy={trocando}>
            {conteudo}
            <ChevronDown className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Sessão corporativa</DropdownMenuLabel>
          <p className="px-2.5 pb-2 text-xs text-[var(--color-ink-muted)]">
            {emailSenhaAuthEnabled ? `Autenticado como ${currentUser.email}.` : 'Autenticado com sua conta Microsoft.'}
          </p>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={trocando} onSelect={() => void sair()}>
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (usuarios.length === 0) return <div className={CLASSE_TRIGGER}>{conteudo}</div>

  async function trocar(id: string) {
    if (id === currentUser?.id) return
    setTrocando(true)
    try {
      await trocarUsuarioDemo(id)
    } catch (erro) {
      notificarErro(erro, 'Não foi possível trocar de usuário')
    } finally {
      setTrocando(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={CLASSE_TRIGGER} disabled={trocando} aria-busy={trocando}>
          {conteudo}
          <ChevronDown className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-80 overflow-y-auto">
        <DropdownMenuLabel>Usuário de demonstração</DropdownMenuLabel>
        <p className="px-2.5 pb-2 text-xs text-[var(--color-ink-muted)]">
          Simula quem está usando o sistema. O perfil e as permissões são aplicados pelo servidor a partir do usuário escolhido. O SSO corporativo
          é habilitado fora do modo de demonstração quando configurado.
        </p>
        {PERFIS_DEMO.map((grupo) => {
          const doPerfil = usuarios.filter((u) => u.perfil === grupo.id)
          if (doPerfil.length === 0) return null
          return (
            <React.Fragment key={grupo.id}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-[var(--color-ink-subtle)]">{grupo.nome}</DropdownMenuLabel>
              {doPerfil.map((usuario) => (
                <DropdownMenuItem
                  key={usuario.id}
                  onSelect={() => void trocar(usuario.id)}
                  className={cn('flex-col items-start gap-0.5 py-2', usuario.id === currentUser.id && 'bg-[var(--color-accent-soft)]')}
                >
                  <span className="text-[13px] font-medium text-[var(--color-ink)]">{usuario.nome}</span>
                  <span className="text-xs text-[var(--color-ink-muted)]">
                    {usuario.plantaNome ? `${usuario.plantaNome} — ` : ''}
                    {usuario.descricao}
                  </span>
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
