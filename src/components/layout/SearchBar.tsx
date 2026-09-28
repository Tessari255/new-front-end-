import * as React from 'react'
import { Search, User, ArrowLeftRight, CornerDownLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

interface Resultado {
  tipo: 'colaborador' | 'movimentacao'
  id: string
  titulo: string
  subtitulo: string
  to: string
}

export function SearchBar() {
  const [query, setQuery] = React.useState('')
  const [aberto, setAberto] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const colaboradores = useAppStore((s) => s.colaboradores)
  const movimentacoes = useAppStore((s) => s.movimentacoes)

  React.useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  const resultados: Resultado[] = React.useMemo(() => {
    const termo = query.trim().toLowerCase()
    if (termo.length < 2) return []
    const doColaborador: Resultado[] = colaboradores
      .filter((c) => c.nome.toLowerCase().includes(termo) || c.matricula.toLowerCase().includes(termo))
      .slice(0, 4)
      .map((c) => ({ tipo: 'colaborador', id: c.id, titulo: c.nome, subtitulo: `Matrícula ${c.matricula}`, to: `/colaboradores/${c.id}` }))
    const doMovimentacao: Resultado[] = movimentacoes
      .filter((m) => {
        const colaborador = colaboradores.find((c) => c.id === m.colaboradorId)
        return m.protocolo.toLowerCase().includes(termo) || colaborador?.nome.toLowerCase().includes(termo)
      })
      .slice(0, 4)
      .map((m) => {
        const colaborador = colaboradores.find((c) => c.id === m.colaboradorId)
        return {
          tipo: 'movimentacao',
          id: m.id,
          titulo: m.protocolo,
          subtitulo: colaborador?.nome ?? 'Colaborador',
          to: `/movimentacoes/${m.id}`,
        }
      })
    return [...doColaborador, ...doMovimentacao].slice(0, 7)
  }, [query, colaboradores, movimentacoes])

  function irPara(to: string) {
    navigate(to)
    setQuery('')
    setAberto(false)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <label htmlFor="busca-global" className="sr-only">
        Buscar colaboradores ou movimentações
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-subtle)]" aria-hidden="true" />
      <input
        id="busca-global"
        type="search"
        role="combobox"
        aria-expanded={aberto && resultados.length > 0}
        aria-controls="busca-resultados"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAberto(false)
          if (e.key === 'Enter' && resultados[0]) irPara(resultados[0].to)
        }}
        placeholder="Buscar…"
        className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white pl-9 pr-3 text-sm text-[var(--color-ink)] shadow-sm placeholder:text-[var(--color-ink-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      />
      {aberto && resultados.length > 0 && (
        <div
          id="busca-resultados"
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-popover)]"
        >
          {resultados.map((r) => (
            <button
              key={`${r.tipo}-${r.id}`}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => irPara(r.to)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-bg)] focus-visible:outline-none focus-visible:bg-[var(--color-bg)]',
              )}
            >
              {r.tipo === 'colaborador' ? (
                <User className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
              ) : (
                <ArrowLeftRight className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--color-ink)]">{r.titulo}</span>
                <span className="block truncate text-xs text-[var(--color-ink-muted)]">{r.subtitulo}</span>
              </span>
              <CornerDownLeft className="size-3.5 shrink-0 text-[var(--color-ink-subtle)]" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
