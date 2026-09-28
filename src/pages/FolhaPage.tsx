import * as React from 'react'
import { CalendarClock, Lock, LockOpen } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label, FieldHint } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/format'
import { travarFolha, liberarFolha } from '@/services/folhaService'

function mesPadrao(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 7)
}

export default function FolhaPage() {
  const fechamento = useAppStore((s) => s.fechamentoFolha)
  const currentUser = useAppStore((s) => s.currentUser)
  const { notificar, notificarErro } = useToast()
  const [mes, setMes] = React.useState(mesPadrao())
  const [processando, setProcessando] = React.useState(false)

  const podeOperar = currentUser?.perfil === 'share'
  const travada = Boolean(fechamento.mesTravado)

  async function handleTravar() {
    setProcessando(true)
    try {
      await travarFolha(mes)
      notificar({ tipo: 'sucesso', titulo: 'Folha travada', descricao: `Mês ${mes} fechado para lançamentos.` })
    } catch (erro) {
      notificarErro(erro, 'Não foi possível travar a folha')
    } finally {
      setProcessando(false)
    }
  }

  async function handleLiberar() {
    setProcessando(true)
    try {
      await liberarFolha()
      notificar({ tipo: 'sucesso', titulo: 'Folha liberada', descricao: 'Lançamentos voltaram a ser permitidos.' })
    } catch (erro) {
      notificarErro(erro, 'Não foi possível liberar a folha')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Fechamento da folha"
        description="Trava única e global: enquanto o mês estiver fechado, novas movimentações não podem ser enviadas com vigência nesse mês."
      />

      <Card>
        <CardHeader>
          <CardTitle>Estado atual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge tom={travada ? 'danger' : 'success'} comPonto={false} className="text-[13px]">
              {travada ? (
                <>
                  <Lock className="size-3.5" aria-hidden="true" /> Fechada
                </>
              ) : (
                <>
                  <LockOpen className="size-3.5" aria-hidden="true" /> Aberta
                </>
              )}
            </Badge>
            {travada && <span className="text-sm text-[var(--color-ink-muted)]">Mês {fechamento.mesTravado!.slice(0, 7)}</span>}
          </div>
          {travada && fechamento.travadoEm && (
            <p className="flex items-center gap-1.5 text-[13px] text-[var(--color-ink-muted)]">
              <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
              Travada por {fechamento.travadoPorNome ?? '—'} em {formatDateTime(fechamento.travadoEm)}
            </p>
          )}

          {!podeOperar ? (
            <p className="text-[13px] text-[var(--color-ink-muted)]">Somente o perfil Share pode travar ou liberar a folha.</p>
          ) : travada ? (
            <Button onClick={handleLiberar} loading={processando} variant="secondary">
              <LockOpen className="size-4" aria-hidden="true" />
              Liberar folha
            </Button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label htmlFor="input-mes-travar">Mês a travar</Label>
                <Input id="input-mes-travar" type="month" className="max-w-[180px]" value={mes} onChange={(e) => setMes(e.target.value)} />
                <FieldHint>Movimentações com vigência nesse mês não poderão ser enviadas até a liberação.</FieldHint>
              </div>
              <Button onClick={handleTravar} loading={processando} disabled={!mes}>
                <Lock className="size-4" aria-hidden="true" />
                Travar folha
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
