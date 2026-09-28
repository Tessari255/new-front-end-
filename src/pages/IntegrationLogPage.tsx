import * as React from 'react'
import { AlertTriangle, CheckCircle2, ListChecks, PercentCircle, Terminal, Trash2, Zap } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/dashboard/StatCard'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useUrlParam } from '@/lib/useUrlParam'
import { rotuloCategoriaLog, rotuloStatusLog, tomStatusLog } from '@/lib/rotulos'
import { formatDateTime } from '@/lib/format'
import { limparLogsIntegracao, simularFalhaIntegracao } from '@/services/demoService'

export default function IntegrationLogPage() {
  const logs = useAppStore((s) => s.logsIntegracao)
  const podeLimpar = useAppStore((s) => s.currentUser?.perfil === 'rh_central')
  const { notificar, notificarErro } = useToast()

  const [busca, setBusca] = useUrlParam('busca')
  const [categoria, setCategoria] = useUrlParam('categoria')
  const [status, setStatus] = useUrlParam('status')
  const [simulando, setSimulando] = React.useState(false)
  const [confirmarLimpeza, setConfirmarLimpeza] = React.useState(false)

  const filtrados = React.useMemo(() => {
    let lista = logs
    if (categoria) lista = lista.filter((l) => l.categoria === categoria)
    if (status) lista = lista.filter((l) => l.status === status)
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter((l) => l.acao.toLowerCase().includes(termo) || l.detalhe.toLowerCase().includes(termo) || l.erro?.toLowerCase().includes(termo))
    }
    return [...lista].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [logs, categoria, status, busca])

  const total = logs.length
  const sucessos = logs.filter((l) => l.status === 'sucesso').length
  const erros = logs.filter((l) => l.status === 'erro').length
  const taxaSucesso = total === 0 ? '—' : `${Math.round((sucessos / total) * 100)}%`
  const filtrosAtivos = Boolean(busca || categoria || status)

  function limparFiltros() {
    setBusca('')
    setCategoria('')
    setStatus('')
  }

  async function handleSimularFalha() {
    setSimulando(true)
    try {
      await simularFalhaIntegracao()
    } catch {
      notificar({
        tipo: 'erro',
        titulo: 'Falha de integração (demonstração)',
        descricao: 'Um erro foi registrado no log abaixo, como aconteceria numa falha real.',
      })
    } finally {
      setSimulando(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Log de integração"
        description="Registro técnico, gravado pelo servidor, de cada operação de integração — geração de arquivos, aprovações e conciliação — com sucesso, duração e detalhes de erro."
        action={
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <Button variant="secondary" onClick={() => setConfirmarLimpeza(true)} disabled={logs.length === 0 || !podeLimpar} title={podeLimpar ? undefined : "Somente o RH Central pode limpar o log"}>
              <Trash2 className="size-4" aria-hidden="true" />
              Limpar log
            </Button>
            <Button onClick={handleSimularFalha} loading={simulando} variant="outlineDanger">
              <Zap className="size-4" aria-hidden="true" />
              Simular falha (demonstração)
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ListChecks} label="Chamadas registradas" value={total} tone="accent" />
        <StatCard icon={CheckCircle2} label="Sucesso" value={sucessos} tone="success" />
        <StatCard icon={AlertTriangle} label="Erros" value={erros} tone="danger" />
        <StatCard icon={PercentCircle} label="Taxa de sucesso" value={taxaSucesso} />
      </div>

      <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="busca-log">Buscar</Label>
            <Input id="busca-log" placeholder="Ação, detalhe ou mensagem de erro" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="filtro-categoria-log">Categoria</Label>
            <Select value={categoria || 'todas'} onValueChange={(v) => setCategoria(v === 'todas' ? '' : v)}>
              <SelectTrigger id="filtro-categoria-log">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="movimentacao">Movimentação</SelectItem>
                <SelectItem value="aprovacao">Aprovação</SelectItem>
                <SelectItem value="conciliacao">Conciliação</SelectItem>
                <SelectItem value="exportacao">Exportação</SelectItem>
                <SelectItem value="sistema">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-status-log">Status</Label>
            <Select value={status || 'todos'} onValueChange={(v) => setStatus(v === 'todos' ? '' : v)}>
              <SelectTrigger id="filtro-status-log">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sucesso">Sucesso</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {filtrosAtivos && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-[var(--color-ink-muted)]">{filtrados.length} registro(s) encontrado(s)</p>
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4">
        {filtrados.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
            <EmptyState
              icon={Terminal}
              title={logs.length === 0 ? 'Nenhuma chamada registrada ainda' : 'Nenhum registro encontrado'}
              description={
                logs.length === 0
                  ? 'Ações como gerar arquivos, aprovar solicitações ou executar a conferência de dados aparecerão aqui.'
                  : 'Ajuste os filtros para ver outros registros do log.'
              }
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
                <TableHead>Data/hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-[13px] text-[var(--color-ink-muted)]">{formatDateTime(log.data)}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{log.acao}</TableCell>
                  <TableCell className="whitespace-nowrap">{rotuloCategoriaLog(log.categoria)}</TableCell>
                  <TableCell>
                    <Badge tom={tomStatusLog(log.status)}>{rotuloStatusLog(log.status)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-[12.5px] text-[var(--color-ink-muted)]">{log.duracaoMs} ms</TableCell>
                  <TableCell className="min-w-[280px] max-w-md">
                    <span className={log.status === 'erro' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)]'}>
                      {log.status === 'erro' ? log.erro : log.detalhe}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={confirmarLimpeza} onOpenChange={setConfirmarLimpeza}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limpar log de integração?</DialogTitle>
            <DialogDescription>
              Remove todos os {logs.length} registro(s) do log de integração no servidor (a limpeza fica registrada). As
              movimentações, aprovações e demais dados não são afetados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmarLimpeza(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await limparLogsIntegracao()
                  notificar({ tipo: 'sucesso', titulo: 'Log limpo', descricao: 'Os registros de integração foram removidos.' })
                } catch (erro) {
                  notificarErro(erro, 'Não foi possível limpar o log')
                } finally {
                  setConfirmarLimpeza(false)
                }
              }}
            >
              Limpar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
