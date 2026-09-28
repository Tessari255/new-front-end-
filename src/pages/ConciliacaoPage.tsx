import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Search, X, ClipboardList, AlertOctagon, CheckCircle2, Clock, GitCompareArrows } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/dashboard/StatCard'
import { useToast } from '@/components/ui/Toast'
import { useUrlParam } from '@/lib/useUrlParam'
import { useSyncPlantaFromQuery } from '@/lib/useSyncPlantaFromQuery'
import { filtrarPorPlanta } from '@/lib/selectors'
import { rotuloCampoDivergente, rotuloStatusDivergencia, tomStatusDivergencia } from '@/lib/rotulos'
import { formatDateTime } from '@/lib/format'
import { executarConferencia } from '@/services/conciliacaoService'

export default function ConciliacaoPage() {
  useSyncPlantaFromQuery()
  const navigate = useNavigate()
  const { notificar, notificarErro } = useToast()

  const divergenciasTodas = useAppStore((s) => s.divergencias)
  const colaboradores = useAppStore((s) => s.colaboradores)
  const plantas = useAppStore((s) => s.plantas)
  const conferencia = useAppStore((s) => s.conferencia)
  const plantaSelecionadaId = useAppStore((s) => s.plantaSelecionadaId)

  const [busca, setBusca] = useUrlParam('busca')
  const [campo, setCampo] = useUrlParam('campo')
  const [status, setStatus] = useUrlParam('status')
  const [executando, setExecutando] = React.useState(false)

  const divergencias = React.useMemo(() => {
    let lista = filtrarPorPlanta(divergenciasTodas, plantaSelecionadaId)
    if (campo) lista = lista.filter((d) => d.campo === campo)
    if (status) lista = lista.filter((d) => d.status === status)
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter((d) => colaboradores.find((c) => c.id === d.colaboradorId)?.nome.toLowerCase().includes(termo))
    }
    return [...lista].sort((a, b) => new Date(b.detectadaEm).getTime() - new Date(a.detectadaEm).getTime())
  }, [divergenciasTodas, plantaSelecionadaId, campo, status, busca, colaboradores])

  const abertas = divergenciasTodas.filter((d) => d.status !== 'resolvida').length
  const resolvidas = divergenciasTodas.filter((d) => d.status === 'resolvida').length
  const filtrosAtivos = Boolean(busca || campo || status)

  function limparFiltros() {
    setBusca('')
    setCampo('')
    setStatus('')
  }

  async function handleExecutarConferencia() {
    setExecutando(true)
    try {
      await executarConferencia()
      notificar({ tipo: 'sucesso', titulo: 'Conferência executada', descricao: 'Horário e resultados atualizados. Nenhum registro foi duplicado.' })
    } catch (erro) {
      notificarErro(erro, 'Não foi possível executar a conferência')
    } finally {
      setExecutando(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Conciliação de dados"
        description="Comparação entre Apdata e Employee Central para gestor, cargo, centro de custo e área."
        action={
          <Button onClick={handleExecutarConferencia} loading={executando}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Executar conferência
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock} label="Última conferência" value={formatDateTime(conferencia.executadaEm)} />
        <StatCard icon={ClipboardList} label="Registros comparados" value={conferencia.registrosComparados} tone="accent" />
        <StatCard icon={AlertOctagon} label="Divergências abertas" value={abertas} tone="danger" />
        <StatCard icon={CheckCircle2} label="Divergências resolvidas" value={resolvidas} tone="success" />
      </div>

      <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="busca-div">Buscar colaborador</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-subtle)]" aria-hidden="true" />
              <Input id="busca-div" placeholder="Nome do colaborador" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="filtro-campo">Campo divergente</Label>
            <Select value={campo || 'todos'} onValueChange={(v) => setCampo(v === 'todos' ? '' : v)}>
              <SelectTrigger id="filtro-campo">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="cargo">Cargo</SelectItem>
                <SelectItem value="centro_custo">Centro de custo</SelectItem>
                <SelectItem value="area">Área</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-status-div">Status</Label>
            <Select value={status || 'todos'} onValueChange={(v) => setStatus(v === 'todos' ? '' : v)}>
              <SelectTrigger id="filtro-status-div">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_tratamento">Em tratamento</SelectItem>
                <SelectItem value="resolvida">Resolvida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {filtrosAtivos && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-[var(--color-ink-muted)]">{divergencias.length} divergência(s) encontrada(s)</p>
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <X className="size-3.5" aria-hidden="true" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4">
        {divergencias.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
            <EmptyState
              icon={GitCompareArrows}
              title="Nenhuma divergência encontrada"
              description="Ajuste os filtros ou execute uma nova conferência."
              action={
                filtrosAtivos ? (
                  <Button variant="secondary" size="sm" onClick={limparFiltros}>
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Planta</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead>Valor Apdata</TableHead>
                <TableHead>Valor Employee Central</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divergencias.map((div) => {
                const colaborador = colaboradores.find((c) => c.id === div.colaboradorId)
                const planta = plantas.find((p) => p.id === div.plantaId)
                const responsavel = colaboradores.find((c) => c.id === div.responsavelId)
                return (
                  <TableRow key={div.id} clickable onClick={() => navigate(`/conciliacao/${div.id}`)}>
                    <TableCell className="font-medium">{colaborador?.nome ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{planta?.nome ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{rotuloCampoDivergente(div.campo)}</TableCell>
                    <TableCell className="whitespace-nowrap">{div.valorApdata}</TableCell>
                    <TableCell className="whitespace-nowrap">{div.valorEmployeeCentral}</TableCell>
                    <TableCell className="whitespace-nowrap">{responsavel?.nome ?? 'Não atribuído'}</TableCell>
                    <TableCell>
                      <Badge tom={tomStatusDivergencia(div.status)}>{rotuloStatusDivergencia(div.status)}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
