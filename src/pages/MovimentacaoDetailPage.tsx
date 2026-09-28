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
import { useToast } from '@/components/ui/Toast'
import { ComparacaoCampos } from '@/components/movimentacao/ComparacaoCampos'
import { ChecagensList } from '@/components/movimentacao/ChecagensList'
import { FluxoAprovacaoVisual } from '@/components/movimentacao/FluxoAprovacaoVisual'
import { GerarArquivosCard } from '@/components/movimentacao/GerarArquivosCard'
import { AcoesAprovacaoCard } from '@/components/movimentacao/AcoesAprovacaoCard'
import { Timeline } from '@/components/movimentacao/Timeline'
import { compararAlteracao } from '@/lib/movimentacao'
import { usuarioPodeDecidir } from '@/lib/selectors'
import { rotuloStatusMovimentacao, rotuloTipoDocumento, rotuloTipoMovimentacao, tomStatusMovimentacao } from '@/lib/rotulos'
import { formatBytes, formatDate, formatDateTime } from '@/lib/format'
import { NOTA_REGRAS_DEMO } from '@/data/rules'
import { adicionarDocumento, baixarDocumento, enviarParaAprovacao } from '@/services/movimentacoesService'

export default function MovimentacaoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notificar, notificarErro } = useToast()

  const movimentacoes = useAppStore((s) => s.movimentacoes)
  const colaboradores = useAppStore((s) => s.colaboradores)
  const plantas = useAppStore((s) => s.plantas)
  const documentosTodos = useAppStore((s) => s.documentos)
  const historicoTodo = useAppStore((s) => s.historico)
  const currentUser = useAppStore((s) => s.currentUser)

  const mov = movimentacoes.find((m) => m.id === id)
  const [enviando, setEnviando] = React.useState(false)
  const [dialogAberto, setDialogAberto] = React.useState(false)
  const [arquivosNovos, setArquivosNovos] = React.useState<ArquivoSelecionado[]>([])
  const [salvandoDocs, setSalvandoDocs] = React.useState(false)

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
  const campos = compararAlteracao(mov.alteracao, colaboradores)
  const documentos = documentosTodos.filter((d) => d.movimentacaoId === mov.id)
  const eventos = historicoTodo.filter((e) => e.movimentacaoId === mov.id)

  async function reenviar() {
    if (!mov) return
    setEnviando(true)
    try {
      await enviarParaAprovacao(mov.id)
      notificar({ tipo: 'sucesso', titulo: 'Solicitação enviada', descricao: `${mov.protocolo} encaminhada para aprovação do gestor.` })
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
        await adicionarDocumento(mov.id, arquivo.file)
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
