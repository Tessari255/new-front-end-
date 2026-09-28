import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Send, Plus, FileText, ClipboardCheck, Download } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { DefinitionList } from '@/components/ui/DefinitionList'
import { EmptyState } from '@/components/ui/EmptyState'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog'
import { FileDropzone, type ArquivoSelecionado } from '@/components/ui/FileDropzone'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Label } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { ComparacaoCampos } from '@/components/movimentacao/ComparacaoCampos'
import { ChecagensList } from '@/components/movimentacao/ChecagensList'
import { FluxoAprovacaoVisual } from '@/components/movimentacao/FluxoAprovacaoVisual'
import { GerarArquivosCard } from '@/components/movimentacao/GerarArquivosCard'
import { AcoesAprovacaoCard } from '@/components/movimentacao/AcoesAprovacaoCard'
import { Timeline } from '@/components/movimentacao/Timeline'
import { compararAlteracao, ipeDoCargoNaPlanta } from '@/lib/movimentacao'
import { usuarioPodeDecidir } from '@/lib/selectors'
import { rotuloIpe, rotuloPotencial, rotuloStatusMovimentacao, rotuloTipoDocumento, rotuloTipoMovimentacao, tomStatusMovimentacao } from '@/lib/rotulos'
import { formatBytes, formatDate, formatDateTime } from '@/lib/format'
import { tempoDeCasa } from '@/lib/tempoDeCasa'
import { NOTA_REGRAS_DEMO } from '@/data/rules'
import type { Documento } from '@/types'
import { adicionarDocumento, baixarDocumento, enviarParaAprovacao } from '@/services/movimentacoesService'

const TIPOS_DOCUMENTO_SELECIONAVEIS: Documento['tipo'][] = ['evidencia', 'documento_aprovado', 'offer_letter', 'c_req', 'e_req', 'carta_promocao', 'carta_merito']

export default function MovimentacaoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notificar, notificarErro } = useToast()

  const movimentacoes = useAppStore((s) => s.movimentacoes)
  const colaboradores = useAppStore((s) => s.colaboradores)
  const plantas = useAppStore((s) => s.plantas)
  const cargos = useAppStore((s) => s.cargos)
  const areas = useAppStore((s) => s.areas)
  const centrosCusto = useAppStore((s) => s.centrosCusto)
  const documentosTodos = useAppStore((s) => s.documentos)
  const historicoTodo = useAppStore((s) => s.historico)
  const currentUser = useAppStore((s) => s.currentUser)

  const mov = movimentacoes.find((m) => m.id === id)
  const [enviando, setEnviando] = React.useState(false)
  const [dialogAberto, setDialogAberto] = React.useState(false)
  const [arquivosNovos, setArquivosNovos] = React.useState<ArquivoSelecionado[]>([])
  const [salvandoDocs, setSalvandoDocs] = React.useState(false)
  const [tipoDocumentoNovo, setTipoDocumentoNovo] = React.useState<Documento['tipo']>(
    mov && (mov.tipo === 'promocao' || mov.tipo === 'alteracao_cargo') ? 'carta_promocao'
    : mov && (mov.tipo === 'merito' || mov.tipo === 'enquadramento') ? 'carta_merito'
    : 'evidencia',
  )

  if (!mov) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
        <EmptyState
          title="Movimentação não encontrada"
          description="O protocolo pode ter sido removido na última restauração da demonstração."
          action={
            <Button size="sm" onClick={() => navigate('/movimentacoes')}>
              Voltar para a lista
            </Button>
          }
        />
      </div>
    )
  }

  const colaborador = colaboradores.find((c) => c.id === mov.colaboradorId)
  const planta = plantas.find((p) => p.id === mov.plantaId)
  const campos = compararAlteracao(mov.alteracao, colaboradores, colaborador?.plantaId)
  const documentos = documentosTodos.filter((d) => d.movimentacaoId === mov.id)
  const eventos = historicoTodo.filter((e) => e.movimentacaoId === mov.id)

  const cargoAtual = colaborador ? cargos.find((c) => c.id === colaborador.cargoId) : undefined
  const areaAtual = colaborador ? areas.find((a) => a.id === colaborador.areaId) : undefined
  const ccAtual = colaborador ? centrosCusto.find((c) => c.id === colaborador.centroCustoId) : undefined
  const gestorAtual = colaborador ? colaboradores.find((c) => c.id === colaborador.gestorId) : undefined
  const ipeAtual = colaborador ? ipeDoCargoNaPlanta(colaborador.cargoId, colaborador.plantaId) : null

  async function reenviar() {
    if (!mov) return
    setEnviando(true)
    try {
      await enviarParaAprovacao(mov.id)
      const atualizada = useAppStore.getState().movimentacoes.find((m) => m.id === mov.id)
      const etapaDescricao = atualizada?.etapaAtual === 'rh_local' ? 'aprovação do RH Local' : atualizada?.etapaAtual === 'rh_central' ? 'aprovação do RH Central' : 'aprovação do gestor'
      notificar({ tipo: 'sucesso', titulo: 'Solicitação enviada', descricao: `${mov.protocolo} encaminhada para ${etapaDescricao}.` })
    } catch (erro) {
      notificarErro(erro, 'A solicitação não foi enviada')
    } finally {
      setEnviando(false)
    }
  }

  async function salvarNovosDocumentos() {
    if (!mov || arquivosNovos.length === 0) return
    setSalvandoDocs(true)
    const pendentes = [...arquivosNovos]
    try {
      for (const arquivo of arquivosNovos) {
        await adicionarDocumento(mov.id, arquivo.file, tipoDocumentoNovo)
        pendentes.shift()
      }
      notificar({ tipo: 'sucesso', titulo: 'Documento(s) anexado(s)', descricao: `${arquivosNovos.length} arquivo(s) adicionado(s) a ${mov.protocolo}.` })
      setArquivosNovos([])
      setDialogAberto(false)
    } catch (erro) {
      // Mantém na lista somente o que ainda não foi enviado.
      setArquivosNovos(pendentes)
      notificarErro(erro, 'Não foi possível anexar o documento')
    } finally {
      setSalvandoDocs(false)
    }
  }

  async function baixar(documento: { id: string }) {
    try {
      await baixarDocumento(documento)
    } catch (erro) {
      notificarErro(erro, 'Não foi possível baixar o documento')
    }
  }

  const acaoPrincipal =
    mov.status === 'rascunho' ? (
      <Button asChild>
        <Link to={`/movimentacoes/nova?rascunhoId=${mov.id}`}>
          <Pencil className="size-4" aria-hidden="true" />
          Continuar edição
        </Link>
      </Button>
    ) : mov.status === 'devolvida' ? (
      <div className="flex gap-2.5">
        <Button asChild variant="secondary">
          <Link to={`/movimentacoes/nova?rascunhoId=${mov.id}`}>
            <Pencil className="size-4" aria-hidden="true" />
            Editar
          </Link>
        </Button>
        <Button onClick={reenviar} loading={enviando}>
          <Send className="size-4" aria-hidden="true" />
          Reenviar para aprovação
        </Button>
      </div>
    ) : mov.status === 'em_andamento' ? (
      <Button asChild variant="secondary">
        <Link to="/aprovacoes">
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Ver na central de aprovações
        </Link>
      </Button>
    ) : undefined

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Movimentações', to: '/movimentacoes' }, { label: mov.protocolo }]}
        title={mov.protocolo}
        description={`${rotuloTipoMovimentacao(mov.tipo)} · ${colaborador?.nome ?? 'Colaborador'}`}
        action={acaoPrincipal}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {mov.status === 'aprovada' && <GerarArquivosCard movimentacao={mov} />}

          <Card>
            <CardHeader>
              <CardTitle>Comparação de valores</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparacaoCampos campos={campos} />
            </CardContent>
          </Card>

          {colaborador && (
            <Card>
              <CardHeader>
                <CardTitle>Colaborador no momento da solicitação</CardTitle>
              </CardHeader>
              <CardContent>
                <DefinitionList
                  columns={2}
                  items={[
                    { label: 'Cargo atual', value: cargoAtual?.nome ?? '—' },
                    { label: 'IPE atual', value: rotuloIpe(ipeAtual) },
                    { label: 'Potencial', value: rotuloPotencial(mov.potencial) },
                    { label: 'Data de admissão', value: formatDate(colaborador.dataAdmissao) },
                    { label: 'Tempo de empresa', value: tempoDeCasa(colaborador.dataAdmissao) },
                    { label: 'Área de atuação', value: areaAtual?.nome ?? '—' },
                    { label: 'Centro de custo', value: ccAtual ? `${ccAtual.codigo} · ${ccAtual.nome}` : '—' },
                    { label: 'Gestor atual', value: gestorAtual?.nome ?? 'Sem gestor definido' },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Justificativa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--color-ink-muted)]">{mov.justificativa || 'Justificativa ainda não preenchida.'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Documentos ({documentos.length})</CardTitle>
              </div>
              <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <Plus className="size-3.5" aria-hidden="true" />
                    Anexar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Anexar documento</DialogTitle>
                    <DialogDescription>Adicione evidências ou documentos relacionados a {mov.protocolo}.</DialogDescription>
                  </DialogHeader>
                  <div>
                    <Label htmlFor="select-tipo-documento">Tipo de documento</Label>
                    <Select value={tipoDocumentoNovo} onValueChange={(v) => setTipoDocumentoNovo(v as Documento['tipo'])}>
                      <SelectTrigger id="select-tipo-documento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO_SELECIONAVEIS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {rotuloTipoDocumento(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                      Cartas de promoção/mérito são anexos enviados por você — não há geração automática (sem modelo oficial definido).
                    </p>
                  </div>
                  <FileDropzone
                    arquivos={arquivosNovos}
                    onAdicionar={(novos) => setArquivosNovos((atual) => [...atual, ...novos])}
                    onRemover={(idx) => setArquivosNovos((atual) => atual.filter((_, i) => i !== idx))}
                  />
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setDialogAberto(false)} disabled={salvandoDocs}>
                      Cancelar
                    </Button>
                    <Button onClick={salvarNovosDocumentos} loading={salvandoDocs} disabled={arquivosNovos.length === 0}>
                      Salvar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {documentos.length === 0 ? (
                <EmptyState icon={FileText} title="Nenhum documento anexado" description="Anexe evidências para apoiar a análise desta solicitação." />
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {documentos.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 py-3">
                      <FileText className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">{doc.nome}</p>
                        <p className="truncate text-xs text-[var(--color-ink-muted)]">
                          {rotuloTipoDocumento(doc.tipo)} · {formatBytes(doc.tamanhoBytes)} · {formatDateTime(doc.criadoEm)}
                          {doc.autorNome && ` · ${doc.autorNome}`}
                        </p>
                      </div>
                      {doc.temConteudo ? (
                        <Button variant="ghost" size="sm" onClick={() => void baixar(doc)} aria-label={`Baixar ${doc.nome}`}>
                          <Download className="size-4" aria-hidden="true" />
                          Baixar
                        </Button>
                      ) : (
                        <span className="shrink-0 text-xs text-[var(--color-ink-subtle)]">Somente metadados (demonstração)</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checagens de regras</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecagensList checagens={mov.checagens} />
              <p className="mt-3 text-xs text-[var(--color-ink-subtle)]">{NOTA_REGRAS_DEMO}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linha do tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline eventos={eventos} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="pt-5">
              <Badge tom={tomStatusMovimentacao(mov.status)} className="text-[13px]">
                {rotuloStatusMovimentacao(mov.status)}
              </Badge>
              <DefinitionList
                columns={1}
                items={[
                  {
                    label: 'Colaborador',
                    value: colaborador ? (
                      <Link to={`/colaboradores/${colaborador.id}`} className="flex items-center gap-2 text-[var(--color-accent-hover)] hover:underline">
                        <Avatar nome={colaborador.nome} size="sm" />
                        {colaborador.nome}
                      </Link>
                    ) : (
                      '—'
                    ),
                  },
                  { label: 'Planta', value: planta?.nome ?? '—' },
                  { label: 'Solicitante', value: mov.solicitanteNome },
                  { label: 'Data de abertura', value: formatDate(mov.dataAbertura) },
                  { label: 'Vigência', value: formatDate(mov.vigencia) },
                ]}
              />
            </CardContent>
          </Card>

          {usuarioPodeDecidir(currentUser, mov, colaboradores) && (
            <AcoesAprovacaoCard movimentacao={mov} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Fluxo de aprovação</CardTitle>
            </CardHeader>
            <CardContent>
              <FluxoAprovacaoVisual movimentacao={mov} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
