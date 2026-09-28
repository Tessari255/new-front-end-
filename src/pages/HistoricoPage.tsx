import * as React from 'react'
import { Link } from 'react-router-dom'
import { Search, X, History as HistoryIcon, FilePlus2, FileCheck2, ThumbsUp, RotateCcw, ThumbsDown, FlagOff, Download, PenLine, ClipboardCheck } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input, Label } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { useUrlParam } from '@/lib/useUrlParam'
import { filtrarPorPlanta } from '@/lib/selectors'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EventoHistorico } from '@/types'

const ICONES: Record<EventoHistorico['tipo'], typeof FilePlus2> = {
  abertura: FilePlus2,
  edicao: PenLine,
  anexo: FileCheck2,
  validacao: ClipboardCheck,
  aprovacao: ThumbsUp,
  devolucao: RotateCcw,
  reprovacao: ThumbsDown,
  conclusao: FlagOff,
  geracao_arquivo: Download,
}

const CORES: Record<EventoHistorico['tipo'], string> = {
  abertura: 'bg-slate-100 text-[var(--color-ink-muted)]',
  edicao: 'bg-slate-100 text-[var(--color-ink-muted)]',
  anexo: 'bg-blue-50 text-blue-600',
  validacao: 'bg-slate-100 text-[var(--color-ink-muted)]',
  aprovacao: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  devolucao: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  reprovacao: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  conclusao: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
  geracao_arquivo: 'bg-violet-50 text-violet-600',
}

const ITENS_POR_PAGINA = 15

const TIPOS_EVENTO: { valor: EventoHistorico['tipo']; rotulo: string }[] = [
  { valor: 'abertura', rotulo: 'Abertura' },
  { valor: 'edicao', rotulo: 'Edição' },
  { valor: 'anexo', rotulo: 'Anexo' },
  { valor: 'validacao', rotulo: 'Validação' },
  { valor: 'aprovacao', rotulo: 'Aprovação' },
  { valor: 'devolucao', rotulo: 'Devolução' },
  { valor: 'reprovacao', rotulo: 'Reprovação' },
  { valor: 'conclusao', rotulo: 'Conclusão' },
  { valor: 'geracao_arquivo', rotulo: 'Geração de arquivo' },
]

export default function HistoricoPage() {
  const historicoTodo = useAppStore((s) => s.historico)
  const movimentacoes = useAppStore((s) => s.movimentacoes)
  const colaboradores = useAppStore((s) => s.colaboradores)
  const plantaSelecionadaId = useAppStore((s) => s.plantaSelecionadaId)

  const [busca, setBusca] = useUrlParam('busca')
  const [tipo, setTipo] = useUrlParam('tipo')
  const [paginaStr, setPaginaStr] = useUrlParam('pagina', '1')
  const pagina = Math.max(1, parseInt(paginaStr, 10) || 1)

  const movimentacoesDaPlanta = React.useMemo(
    () => new Set(filtrarPorPlanta(movimentacoes, plantaSelecionadaId).map((m) => m.id)),
    [movimentacoes, plantaSelecionadaId],
  )

  const eventosFiltrados = React.useMemo(() => {
    let lista = historicoTodo.filter((e) => movimentacoesDaPlanta.has(e.movimentacaoId))
    if (tipo) lista = lista.filter((e) => e.tipo === tipo)
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter((e) => {
        const mov = movimentacoes.find((m) => m.id === e.movimentacaoId)
        const colaborador = mov ? colaboradores.find((c) => c.id === mov.colaboradorId) : undefined
        return mov?.protocolo.toLowerCase().includes(termo) || colaborador?.nome.toLowerCase().includes(termo) || e.autor.toLowerCase().includes(termo)
      })
    }
    return [...lista].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [historicoTodo, movimentacoesDaPlanta, tipo, busca, movimentacoes, colaboradores])

  const totalPaginas = Math.max(1, Math.ceil(eventosFiltrados.length / ITENS_POR_PAGINA))
  const paginaEfetiva = Math.min(pagina, totalPaginas)
  const paginados = eventosFiltrados.slice((paginaEfetiva - 1) * ITENS_POR_PAGINA, paginaEfetiva * ITENS_POR_PAGINA)
  const filtrosAtivos = Boolean(busca || tipo)

  function limparFiltros() {
    setBusca('')
    setTipo('')
    setPaginaStr('1')
  }

  return (
    <div>
      <PageHeader title="Histórico e evidências" description="Trilha completa de eventos de todas as movimentações — aberturas, validações, decisões e arquivos gerados." />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="busca-historico">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-subtle)]" aria-hidden="true" />
              <Input id="busca-historico" placeholder="Protocolo, colaborador ou autor" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="filtro-tipo-evento">Tipo de evento</Label>
            <Select value={tipo || 'todos'} onValueChange={(v) => setTipo(v === 'todos' ? '' : v)}>
              <SelectTrigger id="filtro-tipo-evento">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS_EVENTO.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {filtrosAtivos && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-[var(--color-ink-muted)]">{eventosFiltrados.length} evento(s) encontrado(s)</p>
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <X className="size-3.5" aria-hidden="true" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5">
        {paginados.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
            <EmptyState icon={HistoryIcon} title="Nenhum evento encontrado" description="Ajuste os filtros para ver a trilha de auditoria." />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
            {paginados.map((evento) => {
              const mov = movimentacoes.find((m) => m.id === evento.movimentacaoId)
              const colaborador = mov ? colaboradores.find((c) => c.id === mov.colaboradorId) : undefined
              const Icone = ICONES[evento.tipo]
              return (
                <li key={evento.id} className="flex items-start gap-3 p-4">
                  <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', CORES[evento.tipo])}>
                    <Icone className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="text-[13.5px] font-medium text-[var(--color-ink)]">{evento.descricao}</p>
                      <p className="text-xs text-[var(--color-ink-subtle)]">{formatDateTime(evento.data)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                      {evento.autor}
                      {mov && (
                        <>
                          {' · '}
                          <Link to={`/movimentacoes/${mov.id}`} className="font-medium text-[var(--color-accent-hover)] hover:underline">
                            {mov.protocolo}
                          </Link>
                          {colaborador && ` · ${colaborador.nome}`}
                        </>
                      )}
                    </p>
                    {evento.comentario && (
                      <p className="mt-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-slate-50/70 px-3 py-2 text-[13px] text-[var(--color-ink)]">
                        “{evento.comentario}”
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {eventosFiltrados.length > 0 && (
        <div className="rounded-b-[var(--radius-lg)] border border-t-0 border-[var(--color-border)] bg-white">
          <Pagination pagina={paginaEfetiva} totalPaginas={totalPaginas} totalItens={eventosFiltrados.length} itensPorPagina={ITENS_POR_PAGINA} onMudarPagina={(p) => setPaginaStr(String(p))} />
        </div>
      )}
    </div>
  )
}
