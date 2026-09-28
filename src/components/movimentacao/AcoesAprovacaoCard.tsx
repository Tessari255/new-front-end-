import * as React from 'react'
import { ThumbsUp, RotateCcw, ThumbsDown } from 'lucide-react'
import type { Movimentacao } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Textarea, Label, FieldError } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { ApiError } from '@/lib/apiClient'
import { carregarDadosIniciais } from '@/services/bootstrapService'
import { decidirEtapa } from '@/services/movimentacoesService'
import { rotuloEtapa } from '@/lib/fluxoAprovacao'

type Acao = 'aprovado' | 'devolvido' | 'reprovado'

const CONFIG: Record<Acao, { titulo: string; verbo: string; exigeComentario: boolean; variant: 'primary' | 'secondary' | 'danger' }> = {
  aprovado: { titulo: 'Aprovar solicitação', verbo: 'aprovada', exigeComentario: false, variant: 'primary' },
  devolvido: { titulo: 'Devolver para ajustes', verbo: 'devolvida', exigeComentario: true, variant: 'secondary' },
  reprovado: { titulo: 'Reprovar solicitação', verbo: 'reprovada', exigeComentario: true, variant: 'danger' },
}

export function AcoesAprovacaoCard({ movimentacao }: { movimentacao: Movimentacao }) {
  const [acaoAberta, setAcaoAberta] = React.useState<Acao | null>(null)
  const [comentario, setComentario] = React.useState('')
  const [erro, setErro] = React.useState<string | undefined>()
  const [enviando, setEnviando] = React.useState(false)
  const { notificar, notificarErro } = useToast()

  function abrir(acao: Acao) {
    setAcaoAberta(acao)
    setComentario('')
    setErro(undefined)
  }

  async function confirmar() {
    if (!acaoAberta) return
    const config = CONFIG[acaoAberta]
    if (config.exigeComentario && comentario.trim().length < 5) {
      setErro('Descreva o motivo com pelo menos 5 caracteres.')
      return
    }
    setEnviando(true)
    try {
      await decidirEtapa(movimentacao.id, acaoAberta, comentario.trim() || undefined)
      notificar({ tipo: acaoAberta === 'aprovado' ? 'sucesso' : 'aviso', titulo: `Solicitação ${config.verbo}`, descricao: movimentacao.protocolo })
      setAcaoAberta(null)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 403)) {
        // Outra decisão já avançou a etapa (ou o perfil não decide mais a etapa atual): sincroniza e fecha o diálogo.
        setAcaoAberta(null)
        void carregarDadosIniciais().catch(() => undefined)
        notificarErro(e, 'A decisão não foi registrada')
      } else if (e instanceof ApiError && e.status === 422) {
        setErro(e.fieldErrors.comentario ?? e.message)
      } else {
        notificarErro(e, 'A decisão não foi registrada')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card className="border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]/40">
      <CardHeader>
        <CardTitle>Ação necessária — {rotuloEtapa(movimentacao.etapaAtual)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] text-[var(--color-ink-muted)]">
          Esta solicitação aguarda sua decisão no perfil de demonstração atual.
        </p>
        <div className="flex flex-col gap-2.5">
          <Button size="sm" onClick={() => abrir('aprovado')} className="w-full">
            <ThumbsUp className="size-4" aria-hidden="true" />
            Aprovar
          </Button>
          <div className="flex gap-2.5">
            <Button size="sm" variant="secondary" onClick={() => abrir('devolvido')} className="flex-1">
              <RotateCcw className="size-4" aria-hidden="true" />
              Devolver
            </Button>
            <Button size="sm" variant="outlineDanger" onClick={() => abrir('reprovado')} className="flex-1">
              <ThumbsDown className="size-4" aria-hidden="true" />
              Reprovar
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={acaoAberta !== null} onOpenChange={(open) => !open && setAcaoAberta(null)}>
        <DialogContent>
          {acaoAberta && (
            <>
              <DialogHeader>
                <DialogTitle>{CONFIG[acaoAberta].titulo}</DialogTitle>
                <DialogDescription>
                  {movimentacao.protocolo} — etapa {rotuloEtapa(movimentacao.etapaAtual)}.
                  {CONFIG[acaoAberta].exigeComentario && ' É necessário descrever o motivo.'}
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label htmlFor="comentario-decisao">
                  Comentário {CONFIG[acaoAberta].exigeComentario ? '(obrigatório)' : '(opcional)'}
                </Label>
                <Textarea
                  id="comentario-decisao"
                  rows={4}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  invalid={!!erro}
                  placeholder={CONFIG[acaoAberta].exigeComentario ? 'Explique o motivo da decisão…' : 'Comentário opcional…'}
                />
                <FieldError>{erro}</FieldError>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setAcaoAberta(null)} disabled={enviando}>
                  Cancelar
                </Button>
                <Button variant={CONFIG[acaoAberta].variant} onClick={confirmar} loading={enviando}>
                  Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
