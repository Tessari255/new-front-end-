import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, FileText, Mail, Phone, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { DefinitionList } from '@/components/ui/DefinitionList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { rotuloIpe, rotuloStatusColaborador, rotuloStatusMovimentacao, rotuloStatusSincronizacao, rotuloTipoDocumento, rotuloTipoMovimentacao, tomStatusColaborador, tomStatusMovimentacao, tomStatusSincronizacao } from '@/lib/rotulos'
import { formatBytes, formatCurrency, formatDate, formatDateTime, formatPercentual } from '@/lib/format'
import { tempoDeCasa } from '@/lib/tempoDeCasa'
import { compararAlteracao } from '@/lib/movimentacao'

export default function ColaboradorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const colaboradores = useAppStore((s) => s.colaboradores)
  const cargos = useAppStore((s) => s.cargos)
  const areas = useAppStore((s) => s.areas)
  const plantas = useAppStore((s) => s.plantas)
  const centrosCusto = useAppStore((s) => s.centrosCusto)
  const horarios = useAppStore((s) => s.horarios)
  const folhas = useAppStore((s) => s.folhas)
  const movimentacoes = useAppStore((s) => s.movimentacoes)
  const documentos = useAppStore((s) => s.documentos)
  const divergencias = useAppStore((s) => s.divergencias)

  const colaborador = colaboradores.find((c) => c.id === id)

  if (!colaborador) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
        <EmptyState
          title="Colaborador não encontrado"
          description="O registro pode ter sido removido na última restauração da demonstração."
          action={
            <Button size="sm" onClick={() => navigate('/colaboradores')}>
              Voltar para o diretório
            </Button>
          }
        />
      </div>
    )
  }

  const cargo = cargos.find((c) => c.id === colaborador.cargoId)
  const area = areas.find((a) => a.id === colaborador.areaId)
  const planta = plantas.find((p) => p.id === colaborador.plantaId)
  const cc = centrosCusto.find((c) => c.id === colaborador.centroCustoId)
  const horario = horarios.find((h) => h.id === colaborador.horarioId)
  const folha = folhas.find((f) => f.id === colaborador.folhaId)
  const gestor = colaboradores.find((c) => c.id === colaborador.gestorId)
  const subordinados = colaboradores.filter((c) => c.gestorId === colaborador.id)

  const movimentacoesDoColaborador = movimentacoes
    .filter((m) => m.colaboradorId === colaborador.id)
    .sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime())

  const concluidas = movimentacoesDoColaborador.filter((m) => m.status === 'aprovada')

  const documentosDoColaborador = documentos.filter((d) =>
    movimentacoesDoColaborador.some((m) => m.id === d.movimentacaoId),
  )

  const divergenciaAberta = divergencias.find((d) => d.colaboradorId === colaborador.id && d.status !== 'resolvida')
  const salarioBaseDefinido = (colaborador.salarioBaseCargo ?? 0) > 0

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Colaboradores', to: '/colaboradores' }, { label: colaborador.nome }]}
        title={colaborador.nome}
        description={`${cargo?.nome ?? '—'} · ${area?.nome ?? '—'} · ${planta?.nome ?? '—'}`}
        action={
          <Button asChild>
            <Link to={`/movimentacoes/nova?colaboradorId=${colaborador.id}`}>
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Solicitar movimentação
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Avatar nome={colaborador.nome} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[var(--color-ink)]">{colaborador.nome}</p>
                <p className="truncate text-sm text-[var(--color-ink-muted)]">Matrícula {colaborador.matricula}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tom={tomStatusColaborador(colaborador.status)}>{rotuloStatusColaborador(colaborador.status)}</Badge>
              <span className="text-xs text-[var(--color-ink-muted)]">Na empresa há {tempoDeCasa(colaborador.dataAdmissao)}</span>
            </div>
            <div className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4 text-sm">
              <p className="flex items-center gap-2 text-[var(--color-ink-muted)]">
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{colaborador.email}</span>
              </p>
              <p className="flex items-center gap-2 text-[var(--color-ink-muted)]">
                <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                {colaborador.telefone}
              </p>
            </div>
            {divergenciaAberta && (
              <Link
                to={`/conciliacao/${divergenciaAberta.id}`}
                className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-3 text-[13px] text-[var(--color-warning)] transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Há uma divergência de dados em aberto para este colaborador. Ver detalhes.</span>
              </Link>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="visao-geral">
            <TabsList>
              <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
              <TabsTrigger value="solicitacoes">Solicitações ({movimentacoesDoColaborador.length})</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="documentos">Documentos ({documentosDoColaborador.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="visao-geral" className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Dados organizacionais</CardTitle>
                </CardHeader>
                <CardContent>
                  <DefinitionList
                    items={[
                      { label: 'Cargo', value: cargo?.nome ?? '—' },
                      { label: 'Área', value: area?.nome ?? '—' },
                      { label: 'Planta', value: planta ? `${planta.nome} (${planta.cidade}/${planta.estado})` : '—' },
                      { label: 'Centro de custo', value: cc ? `${cc.codigo} · ${cc.nome}` : '—' },
                      {
                        label: 'Gestor',
                        value: gestor ? (
                          <Link to={`/colaboradores/${gestor.id}`} className="text-[var(--color-accent-hover)] hover:underline">
                            {gestor.nome}
                          </Link>
                        ) : (
                          'Sem gestor definido'
                        ),
                      },
                      {
                        label: 'Liderados diretos',
                        value: subordinados.length > 0 ? `${subordinados.length} colaborador(es)` : 'Nenhum',
                      },
                      { label: 'Data de admissão', value: formatDate(colaborador.dataAdmissao) },
                      { label: 'Salário atual', value: formatCurrency(colaborador.salario) },
                      { label: 'Salário-base do cargo', value: salarioBaseDefinido ? formatCurrency(colaborador.salarioBaseCargo!) : 'Salário-base não definido' },
                      {
                        label: 'Faixa atual',
                        value: salarioBaseDefinido && colaborador.faixaAtualPercentual !== null
                          ? formatPercentual(colaborador.faixaAtualPercentual)
                          : 'Salário-base não definido',
                      },
                      { label: 'IPE', value: rotuloIpe(colaborador.ipe) },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Horário e folha</CardTitle>
                </CardHeader>
                <CardContent>
                  <DefinitionList
                    items={[
                      { label: 'Horário', value: horario ? `${horario.nome} (${horario.turno})` : '—' },
                      { label: 'Carga horária semanal', value: horario ? `${horario.cargaHorariaSemanal}h` : '—' },
                      { label: 'Folha', value: folha?.nome ?? '—' },
                      { label: 'Periodicidade', value: folha?.periodicidade ?? '—' },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vínculos de identificação</CardTitle>
                </CardHeader>
                <CardContent>
                  <DefinitionList
                    items={[
                      { label: 'ID Apdata', value: <span className="font-mono text-[13px]">{colaborador.externos.apdataId}</span> },
                      {
                        label: 'ID Employee Central',
                        value: <span className="font-mono text-[13px]">{colaborador.externos.employeeCentralId}</span>,
                      },
                      {
                        label: 'Status de sincronização',
                        value: (
                          <Badge tom={tomStatusSincronizacao(colaborador.externos.statusSincronizacao)}>
                            {rotuloStatusSincronizacao(colaborador.externos.statusSincronizacao)}
                          </Badge>
                        ),
                      },
                    ]}
                    columns={3}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="solicitacoes">
              <Card>
                <CardContent className="pt-5">
                  {movimentacoesDoColaborador.length === 0 ? (
                    <EmptyState
                      icon={ArrowLeftRight}
                      title="Nenhuma solicitação"
                      description="Este colaborador ainda não possui movimentações registradas."
                      action={
                        <Button asChild size="sm">
                          <Link to={`/movimentacoes/nova?colaboradorId=${colaborador.id}`}>Solicitar movimentação</Link>
                        </Button>
                      }
                    />
                  ) : (
                    <ul className="divide-y divide-[var(--color-border)]">
                      {movimentacoesDoColaborador.map((mov) => (
                        <li key={mov.id}>
                          <Link
                            to={`/movimentacoes/${mov.id}`}
                            className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-[var(--color-bg)] rounded-[var(--radius-sm)] px-1.5 -mx-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
                                {rotuloTipoMovimentacao(mov.tipo)}
                              </p>
                              <p className="truncate text-xs text-[var(--color-ink-muted)]">
                                {mov.protocolo} · Aberta em {formatDate(mov.dataAbertura)}
                              </p>
                            </div>
                            <Badge tom={tomStatusMovimentacao(mov.status)}>{rotuloStatusMovimentacao(mov.status)}</Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="historico">
              <Card>
                <CardContent className="pt-5">
                  {concluidas.length === 0 ? (
                    <EmptyState title="Sem histórico de movimentações concluídas" description="Nenhuma alteração foi finalizada ainda para este colaborador." />
                  ) : (
                    <ol className="space-y-5">
                      {concluidas
                        .sort((a, b) => new Date(b.vigencia).getTime() - new Date(a.vigencia).getTime())
                        .map((mov) => {
                          const campos = compararAlteracao(mov.alteracao, colaboradores)
                          return (
                            <li key={mov.id} className="relative pl-5">
                              <span className="absolute left-0 top-1.5 size-2 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
                              <p className="text-[13.5px] font-medium text-[var(--color-ink)]">
                                {rotuloTipoMovimentacao(mov.tipo)} · vigência em {formatDate(mov.vigencia)}
                              </p>
                              <div className="mt-1 space-y-0.5">
                                {campos.map((c) => (
                                  <p key={c.label} className="text-xs text-[var(--color-ink-muted)]">
                                    {c.label}: <span className="text-[var(--color-ink)]">{c.antes}</span> →{' '}
                                    <span className="font-medium text-[var(--color-ink)]">{c.depois}</span>
                                  </p>
                                ))}
                              </div>
                              <Link
                                to={`/movimentacoes/${mov.id}`}
                                className="mt-1 inline-block text-xs font-medium text-[var(--color-accent-hover)] hover:underline"
                              >
                                {mov.protocolo}
                              </Link>
                            </li>
                          )
                        })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documentos">
              <Card>
                <CardContent className="pt-5">
                  {documentosDoColaborador.length === 0 ? (
                    <EmptyState icon={FileText} title="Nenhum documento" description="Os documentos anexados às solicitações deste colaborador aparecerão aqui." />
                  ) : (
                    <ul className="divide-y divide-[var(--color-border)]">
                      {documentosDoColaborador.map((doc) => {
                        const mov = movimentacoesDoColaborador.find((m) => m.id === doc.movimentacaoId)
                        return (
                          <li key={doc.id} className="flex items-center gap-3 py-3">
                            <FileText className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">{doc.nome}</p>
                              <p className="truncate text-xs text-[var(--color-ink-muted)]">
                                {rotuloTipoDocumento(doc.tipo)} · {formatBytes(doc.tamanhoBytes)} · {formatDateTime(doc.criadoEm)}
                                {doc.autorNome && ` · ${doc.autorNome}`}
                              </p>
                            </div>
                            {mov && (
                              <Link to={`/movimentacoes/${mov.id}`} className="shrink-0 text-xs font-medium text-[var(--color-accent-hover)] hover:underline">
                                {mov.protocolo}
                              </Link>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
