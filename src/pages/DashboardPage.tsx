import { Link } from 'react-router-dom'
import { ClipboardList, CheckSquare, GitCompareArrows, CalendarCheck2, Plus, Clock, Factory } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { StatusDistributionChart } from '@/components/dashboard/StatusDistributionChart'
import { ResumoInteligentePanel } from '@/components/dashboard/ResumoInteligentePanel'
import {
  calcularIndicadores,
  distribuicaoPorStatus,
  filtrarPorPlanta,
  pendenciasComAcao,
  resumoPorPlanta,
} from '@/lib/selectors'
import { gerarResumoInteligente } from '@/lib/insights'
import { rotuloEtapaMovimentacao, rotuloTipoMovimentacao } from '@/lib/rotulos'
import { formatDate, formatRelative } from '@/lib/format'

const ICONE_EVENTO: Record<string, string> = {
  abertura: 'Solicitação aberta',
  edicao: 'Solicitação editada',
  anexo: 'Documento anexado',
  validacao: 'Validação executada',
  aprovacao: 'Aprovação registrada',
  devolucao: 'Devolvida para ajustes',
  reprovacao: 'Reprovada',
  conclusao: 'Fluxo concluído',
  geracao_arquivo: 'Arquivo demonstrativo gerado',
}

export default function DashboardPage() {
  const plantaSelecionadaId = useAppStore((s) => s.plantaSelecionadaId)
  const currentUser = useAppStore((s) => s.currentUser)
  const movimentacoesTodas = useAppStore((s) => s.movimentacoes)
  const colaboradores = useAppStore((s) => s.colaboradores)
  const divergenciasTodas = useAppStore((s) => s.divergencias)
  const historico = useAppStore((s) => s.historico)
  const plantas = useAppStore((s) => s.plantas)

  const movimentacoes = filtrarPorPlanta(movimentacoesTodas, plantaSelecionadaId)
  const divergencias = filtrarPorPlanta(divergenciasTodas, plantaSelecionadaId)

  const indicadores = calcularIndicadores(movimentacoes, divergencias, currentUser, colaboradores)
  const distribuicao = distribuicaoPorStatus(movimentacoes)
  const insights = gerarResumoInteligente(divergenciasTodas, movimentacoesTodas, plantas)
  const pendencias = pendenciasComAcao(movimentacoes, colaboradores).slice(0, 6)
  const porPlanta = resumoPorPlanta(plantas, movimentacoesTodas, divergenciasTodas)

  const atividadesRecentes = [...historico]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 7)

  return (
    <div>
      <PageHeader
        title="Visão geral"
        description="Panorama das movimentações, aprovações e conferências de dados entre plantas."
        action={
          <Button asChild>
            <Link to="/movimentacoes/nova">
              <Plus className="size-4" aria-hidden="true" />
              Nova movimentação
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={ClipboardList}
          label="Solicitações em andamento"
          value={indicadores.emAndamento}
          hint="Em qualquer etapa do fluxo"
          to="/movimentacoes?status=em_andamento"
          tone="accent"
        />
        <KpiCard
          icon={CheckSquare}
          label="Aprovações pendentes"
          value={indicadores.aprovacoesPendentes}
          hint="Para o seu perfil de demonstração atual"
          to="/aprovacoes"
          tone="warning"
        />
        <KpiCard
          icon={GitCompareArrows}
          label="Divergências abertas"
          value={indicadores.divergenciasAbertas}
          hint="Apdata × Employee Central"
          to="/conciliacao"
          tone="danger"
        />
        <KpiCard
          icon={CalendarCheck2}
          label="Concluídas no mês"
          value={indicadores.concluidasNoMes}
          hint="Aprovação final registrada em setembro"
          to="/movimentacoes?status=aprovada"
          tone="success"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Distribuição por status</CardTitle>
              <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">Clique em uma barra para abrir a lista filtrada.</p>
            </div>
          </CardHeader>
          <CardContent>
            <StatusDistributionChart distribuicao={distribuicao} />
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <ResumoInteligentePanel insights={insights} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Pendências que precisam de ação</CardTitle>
              <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">Ordenadas pelo prazo estimado de decisão.</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/aprovacoes">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendencias.length === 0 ? (
              <EmptyState title="Nenhuma pendência" description="Não há solicitações aguardando ação no momento." />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {pendencias.map(({ movimentacao, responsavel, prazo, atrasada }) => {
                  const colaborador = colaboradores.find((c) => c.id === movimentacao.colaboradorId)
                  return (
                    <li key={movimentacao.id}>
                      <Link
                        to={`/movimentacoes/${movimentacao.id}`}
                        className="flex items-center gap-3 py-3 transition-colors hover:bg-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-[var(--radius-sm)] px-1.5 -mx-1.5"
                      >
                        <Avatar nome={colaborador?.nome ?? '—'} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
                            {rotuloTipoMovimentacao(movimentacao.tipo)} · {colaborador?.nome}
                          </p>
                          <p className="truncate text-xs text-[var(--color-ink-muted)]">
                            {movimentacao.protocolo} · Responsável: {responsavel}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge tom={atrasada ? 'danger' : 'neutral'}>{atrasada ? 'Atrasada' : rotuloEtapaMovimentacao(movimentacao.etapaAtual)}</Badge>
                          <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[var(--color-ink-subtle)]">
                            <Clock className="size-3" aria-hidden="true" />
                            Prazo {formatDate(prazo)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {atividadesRecentes.length === 0 ? (
              <EmptyState title="Sem atividades" description="Nenhum evento registrado ainda." />
            ) : (
              <ol className="space-y-4">
                {atividadesRecentes.map((evento) => (
                  <li key={evento.id} className="flex gap-3">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <Link
                        to={`/movimentacoes/${evento.movimentacaoId}`}
                        className="text-[13px] font-medium text-[var(--color-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
                      >
                        {ICONE_EVENTO[evento.tipo] ?? evento.descricao}
                      </Link>
                      <p className="text-xs text-[var(--color-ink-muted)]">
                        {evento.autor} · {formatRelative(evento.data)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Resumo por planta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {porPlanta.map((planta) => (
              <Link
                key={planta.plantaId}
                to={`/movimentacoes?planta=${planta.plantaId}`}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 transition-colors hover:bg-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <div className="flex items-center gap-2 text-[var(--color-ink-muted)]">
                  <Factory className="size-4" aria-hidden="true" />
                  <span className="text-[13px] font-medium text-[var(--color-ink)]">{planta.nome}</span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-[11px] text-[var(--color-ink-subtle)]">Em andamento</dt>
                    <dd className="text-lg font-semibold text-[var(--color-ink)]">{planta.emAndamento}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-[var(--color-ink-subtle)]">Aprovadas</dt>
                    <dd className="text-lg font-semibold text-[var(--color-ink)]">{planta.aprovadas}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-[var(--color-ink-subtle)]">Divergências</dt>
                    <dd className="text-lg font-semibold text-[var(--color-ink)]">{planta.divergenciasAbertas}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
