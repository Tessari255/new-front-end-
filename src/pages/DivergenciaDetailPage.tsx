import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { UserCheck, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DefinitionList } from '@/components/ui/DefinitionList'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Textarea, Label, FieldError } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { rotuloCampoDivergente, rotuloStatusDivergencia, tomStatusDivergencia } from '@/lib/rotulos'
import { formatDateTime } from '@/lib/format'
import { ApiError } from '@/lib/apiClient'
import { atribuirResponsavel, resolverDivergencia } from '@/services/conciliacaoService'

export default function DivergenciaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notificar, notificarErro } = useToast()

  const divergencias = useAppStore((s) => s.divergencias)
  const colaboradores = useAppStore((s) => s.colaboradores)
  const plantas = useAppStore((s) => s.plantas)
  const areaRhId = useAppStore((s) => s.areas.find((a) => a.nome === 'Recursos Humanos')?.id)

  const div = divergencias.find((d) => d.id === id)
  const [responsavelSelecionado, setResponsavelSelecionado] = React.useState('')
  const [salvandoResponsavel, setSalvandoResponsavel] = React.useState(false)
  const [dialogAberto, setDialogAberto] = React.useState(false)
  const [justificativa, setJustificativa] = React.useState('')
  const [erroJustificativa, setErroJustificativa] = React.useState<string | undefined>()
  const [resolvendo, setResolvendo] = React.useState(false)

  if (!div) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
        <EmptyState
          title="Divergência não encontrada"
          description="O registro pode ter sido removido na última restauração da demonstração."
          action={
            <Button size="sm" onClick={() => navigate('/conciliacao')}>
              Voltar para a conciliação
            </Button>
          }
        />
      </div>
    )
  }

  const colaborador = colaboradores.find((c) => c.id === div.colaboradorId)
  const planta = plantas.find((p) => p.id === div.plantaId)
  const responsavel = colaboradores.find((c) => c.id === div.responsavelId)

  async function salvarResponsavel() {
    if (!div || !responsavelSelecionado) return
    setSalvandoResponsavel(true)
    try {
      await atribuirResponsavel(div.id, responsavelSelecionado)
      notificar({ tipo: 'sucesso', titulo: 'Responsável atribuído', descricao: colaboradores.find((c) => c.id === responsavelSelecionado)?.nome })
    } catch (erro) {
      notificarErro(erro, 'Não foi possível atribuir o responsável')
    } finally {
      setSalvandoResponsavel(false)
    }
  }

  async function confirmarResolucao() {
    if (!div) return
    if (justificativa.trim().length < 10) {
      setErroJustificativa('Descreva a justificativa com pelo menos 10 caracteres.')
      return
    }
    setResolvendo(true)
    try {
      await resolverDivergencia(div.id, justificativa.trim())
      notificar({ tipo: 'sucesso', titulo: 'Divergência resolvida', descricao: `${colaborador?.nome} · ${rotuloCampoDivergente(div.campo)}` })
      setDialogAberto(false)
      setJustificativa('')
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 422) setErroJustificativa(erro.fieldErrors.justificativa ?? erro.message)
      else notificarErro(erro, 'Não foi possível resolver a divergência')
    } finally {
      setResolvendo(false)
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Conciliação de dados', to: '/conciliacao' }, { label: colaborador?.nome ?? 'Divergência' }]}
        title={`${rotuloCampoDivergente(div.campo)} divergente — ${colaborador?.nome ?? ''}`}
        description={`Detectada em ${formatDateTime(div.detectadaEm)}`}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Comparação de valores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">Apdata</p>
                  <p className="mt-1 text-[15px] font-medium text-[var(--color-ink)]">{div.valorApdata}</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">Employee Central</p>
                  <p className="mt-1 text-[15px] font-medium text-[var(--color-ink)]">{div.valorEmployeeCentral}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vínculo de–para</CardTitle>
            </CardHeader>
            <CardContent>
              <DefinitionList
                columns={3}
                items={[
                  { label: 'Colaborador', value: colaborador ? <Link to={`/colaboradores/${colaborador.id}`} className="text-[var(--color-accent-hover)] hover:underline">{colaborador.nome}</Link> : '—' },
                  { label: 'ID Apdata', value: <span className="font-mono text-[13px]">{colaborador?.externos.apdataId}</span> },
                  { label: 'ID Employee Central', value: <span className="font-mono text-[13px]">{colaborador?.externos.employeeCentralId}</span> },
                ]}
              />
            </CardContent>
          </Card>

          {div.status === 'resolvida' && (
            <Card>
              <CardHeader>
                <CardTitle>Tratamento registrado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-4">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
                  <div>
                    <p className="text-[13.5px] font-medium text-[var(--color-ink)]">Resolvida em {formatDateTime(div.resolvidaEm!)}</p>
                    <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">{div.justificativaResolucao}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="pt-5">
              <Badge tom={tomStatusDivergencia(div.status)} className="text-[13px]">
                {rotuloStatusDivergencia(div.status)}
              </Badge>
              <DefinitionList
                columns={1}
                items={[
                  { label: 'Planta', value: planta?.nome ?? '—' },
                  { label: 'Campo', value: rotuloCampoDivergente(div.campo) },
                  { label: 'Detectada em', value: formatDateTime(div.detectadaEm) },
                ]}
              />
            </CardContent>
          </Card>

          {div.status !== 'resolvida' && (
            <Card>
              <CardHeader>
                <CardTitle>Responsável</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[13px] text-[var(--color-ink-muted)]">
                  {responsavel ? `Atribuído a ${responsavel.nome}.` : 'Ainda não atribuído.'}
                </p>
                <Select value={responsavelSelecionado || div.responsavelId || ''} onValueChange={setResponsavelSelecionado}>
                  <SelectTrigger aria-label="Selecionar responsável">
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores
                      .filter((c) => c.areaId === areaRhId && c.status === 'ativo')
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={salvarResponsavel} loading={salvandoResponsavel} disabled={!responsavelSelecionado || responsavelSelecionado === div.responsavelId}>
                  <UserCheck className="size-4" aria-hidden="true" />
                  Atribuir responsável
                </Button>

                <div className="border-t border-[var(--color-border)] pt-3">
                  <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="secondary" className="w-full">
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        Marcar como resolvida
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Resolver divergência</DialogTitle>
                        <DialogDescription>
                          Descreva qual sistema estava correto e a ação tomada para corrigir {colaborador?.nome}.
                        </DialogDescription>
                      </DialogHeader>
                      <div>
                        <Label htmlFor="justificativa-resolucao">Justificativa</Label>
                        <Textarea
                          id="justificativa-resolucao"
                          rows={4}
                          value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)}
                          invalid={!!erroJustificativa}
                          placeholder="Ex.: Confirmado com a liderança; Apdata corrigido manualmente."
                        />
                        <FieldError>{erroJustificativa}</FieldError>
                      </div>
                      <DialogFooter>
                        <Button variant="secondary" onClick={() => setDialogAberto(false)} disabled={resolvendo}>
                          Cancelar
                        </Button>
                        <Button onClick={confirmarResolucao} loading={resolvendo}>
                          Confirmar resolução
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
