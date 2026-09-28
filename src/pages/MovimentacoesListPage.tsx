import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, X, Plus, ArrowLeftRight } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input, Label } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Avatar } from '@/components/ui/Avatar'
import { useUrlParam } from '@/lib/useUrlParam'
import { useSyncPlantaFromQuery } from '@/lib/useSyncPlantaFromQuery'
import { filtrarPorPlanta } from '@/lib/selectors'
import { rotuloEtapaMovimentacao, rotuloStatusMovimentacao, rotuloTipoMovimentacao, tomStatusMovimentacao } from '@/lib/rotulos'
import { formatDate } from '@/lib/format'

const ITENS_POR_PAGINA = 10

export default function MovimentacoesListPage() {
  useSyncPlantaFromQuery()
  const navigate = useNavigate()
  const movimentacoesTodas = useAppStore((s) => s.movimentacoes)
  const colaboradores = useAppStore((s) => s.colaboradores)
  const plantas = useAppStore((s) => s.plantas)
  const plantaSelecionadaId = useAppStore((s) => s.plantaSelecionadaId)

  const [busca, setBusca] = useUrlParam('busca')
  const [tipo, setTipo] = useUrlParam('tipo')
  const [status, setStatus] = useUrlParam('status')
  const [etapa, setEtapa] = useUrlParam('etapa')
  const [paginaStr, setPaginaStr] = useUrlParam('pagina', '1')
  const pagina = Math.max(1, parseInt(paginaStr, 10) || 1)

  const filtrados = React.useMemo(() => {
    let lista = filtrarPorPlanta(movimentacoesTodas, plantaSelecionadaId)
    if (tipo) lista = lista.filter((m) => m.tipo === tipo)
    if (status) lista = lista.filter((m) => m.status === status)
    if (etapa) lista = lista.filter((m) => m.etapaAtual === etapa)
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter((m) => {
        const colaborador = colaboradores.find((c) => c.id === m.colaboradorId)
        return m.protocolo.toLowerCase().includes(termo) || colaborador?.nome.toLowerCase().includes(termo)
      })
    }
    return [...lista].sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime())
  }, [movimentacoesTodas, plantaSelecionadaId, tipo, status, etapa, busca, colaboradores])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA))
  const paginaEfetiva = Math.min(pagina, totalPaginas)
  const paginados = filtrados.slice((paginaEfetiva - 1) * ITENS_POR_PAGINA, paginaEfetiva * ITENS_POR_PAGINA)
  const filtrosAtivos = Boolean(busca || tipo || status || etapa)

  function limparFiltros() {
    setBusca('')
    setTipo('')
    setStatus('')
    setEtapa('')
    setPaginaStr('1')
  }

  return (
    <div>
      <PageHeader
        title="Movimentações"
        description="Solicitações de mudança de gestor, cargo, salário, promoção, enquadramento e centro de custo."
        action={
          <Button asChild>
            <Link to="/movimentacoes/nova">
              <Plus className="size-4" aria-hidden="true" />
              Nova movimentação
            </Link>
          </Button>
        }
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="busca-mov">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-subtle)]" aria-hidden="true" />
              <Input id="busca-mov" placeholder="Protocolo ou colaborador" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="filtro-tipo">Tipo</Label>
            <Select value={tipo || 'todos'} onValueChange={(v) => setTipo(v === 'todos' ? '' : v)}>
              <SelectTrigger id="filtro-tipo">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="mudanca_gestor">Mudança de gestor</SelectItem>
                <SelectItem value="alteracao_cargo">Alteração de cargo</SelectItem>
                <SelectItem value="alteracao_salarial">Alteração salarial</SelectItem>
                <SelectItem value="promocao">Promoção</SelectItem>
                <SelectItem value="enquadramento">Enquadramento</SelectItem>
                <SelectItem value="transferencia_cc">Transferência de CC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-status-mov">Status</Label>
            <Select value={status || 'todos'} onValueChange={(v) => setStatus(v === 'todos' ? '' : v)}>
              <SelectTrigger id="filtro-status-mov">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="devolvida">Devolvida</SelectItem>
                <SelectItem value="reprovada">Reprovada</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-etapa">Etapa atual</Label>
            <Select value={etapa || 'todas'} onValueChange={(v) => setEtapa(v === 'todas' ? '' : v)}>
              <SelectTrigger id="filtro-etapa">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="rh_local">RH Local</SelectItem>
                <SelectItem value="rh_central">RH Central</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {filtrosAtivos && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-[var(--color-ink-muted)]">{filtrados.length} solicitação(ões) encontrada(s)</p>
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <X className="size-3.5" aria-hidden="true" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4">
        {filtrados.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
            <EmptyState
              icon={ArrowLeftRight}
              title="Nenhuma movimentação encontrada"
              description="Ajuste os filtros ou crie uma nova solicitação de movimentação."
              action={
                filtrosAtivos ? (
                  <Button variant="secondary" size="sm" onClick={limparFiltros}>
                    Limpar filtros
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link to="/movimentacoes/nova">Nova movimentação</Link>
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Planta</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginados.map((mov) => {
                const colaborador = colaboradores.find((c) => c.id === mov.colaboradorId)
                const planta = plantas.find((p) => p.id === mov.plantaId)
                return (
                  <TableRow key={mov.id} clickable onClick={() => navigate(`/movimentacoes/${mov.id}`)}>
                    <TableCell className="whitespace-nowrap font-mono text-[13px] text-[var(--color-ink-muted)]">{mov.protocolo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar nome={colaborador?.nome ?? '—'} size="sm" />
                        <span className="truncate font-medium text-[var(--color-ink)]">{colaborador?.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{rotuloTipoMovimentacao(mov.tipo)}</TableCell>
                    <TableCell className="whitespace-nowrap">{planta?.nome ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{mov.solicitanteNome}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(mov.dataAbertura)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(mov.vigencia)}</TableCell>
                    <TableCell className="whitespace-nowrap">{rotuloEtapaMovimentacao(mov.etapaAtual)}</TableCell>
                    <TableCell>
                      <Badge tom={tomStatusMovimentacao(mov.status)}>{rotuloStatusMovimentacao(mov.status)}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {filtrados.length > 0 && (
          <Pagination
            pagina={paginaEfetiva}
            totalPaginas={totalPaginas}
            totalItens={filtrados.length}
            itensPorPagina={ITENS_POR_PAGINA}
            onMudarPagina={(p) => setPaginaStr(String(p))}
          />
        )}
      </div>
    </div>
  )
}
