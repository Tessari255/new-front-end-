import { Check, X, RotateCcw, Circle } from 'lucide-react'
import type { Movimentacao } from '@/types'
import { ETAPAS_ORDEM, rotuloEtapa } from '@/lib/fluxoAprovacao'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export function FluxoAprovacaoVisual({ movimentacao }: { movimentacao: Movimentacao }) {
  return (
    <ol className="flex flex-col gap-4">
      {ETAPAS_ORDEM.map((etapa) => {
        const decisao = movimentacao.decisoes.find((d) => d.etapa === etapa)
        const ativo = movimentacao.etapaAtual === etapa && movimentacao.status === 'em_andamento'
        const concluidaComSucesso = decisao?.decisao === 'aprovado'
        const negativo = decisao && decisao.decisao !== 'aprovado'

        let Icone = Circle
        let corIcone = 'text-[var(--color-ink-subtle)] bg-white border-[var(--color-border-strong)]'
        if (concluidaComSucesso) {
          Icone = Check
          corIcone = 'text-white bg-[var(--color-success)] border-[var(--color-success)]'
        } else if (negativo) {
          Icone = decisao!.decisao === 'devolvido' ? RotateCcw : X
          corIcone = decisao!.decisao === 'devolvido' ? 'text-white bg-[var(--color-warning)] border-[var(--color-warning)]' : 'text-white bg-[var(--color-danger)] border-[var(--color-danger)]'
        } else if (ativo) {
          corIcone = 'text-[var(--color-accent)] bg-white border-[var(--color-accent)]'
        }

        return (
          <li key={etapa} className="flex flex-1 items-start gap-3">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border-2', corIcone)}>
              <Icone className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className={cn('text-[13.5px] font-medium', ativo ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]')}>
                {rotuloEtapa(etapa)}
                {ativo && ' · aguardando'}
              </p>
              {decisao ? (
                <>
                  <p className="text-xs text-[var(--color-ink-muted)]">{decisao.aprovadorNome}</p>
                  <p className="text-[11px] text-[var(--color-ink-subtle)]">{formatDateTime(decisao.data)}</p>
                </>
              ) : (
                <p className="text-xs text-[var(--color-ink-subtle)]">{ativo ? 'Pendente de decisão' : 'Não iniciada'}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
