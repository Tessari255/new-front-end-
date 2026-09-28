import { Check, X, RotateCcw, Circle } from 'lucide-react'
import type { Movimentacao } from '@/types'
import { ETAPAS_ORDEM, rotuloEtapa } from '@/lib/fluxoAprovacao'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export function FluxoAprovacaoVisual({ movimentacao }: { movimentacao: Movimentacao }) {
  return (
    <ol className="flex flex-col gap-4">
      {ETAPAS_ORDEM.map((etapa) => {
        // Etapa gestor pode ter duas decisões (aprovação dupla origem+destino em transferências).
        const decisoes = movimentacao.decisoes.filter((d) => d.etapa === etapa)
        const ativo = movimentacao.etapaAtual === etapa && movimentacao.status === 'em_andamento'
        const negativa = decisoes.find((d) => d.decisao !== 'aprovado')
        const concluidaComSucesso = decisoes.length > 0 && !negativa && !ativo
        const aguardandoSegundaAprovacao = ativo && decisoes.length > 0 && decisoes.every((d) => d.decisao === 'aprovado')

        let Icone = Circle
        let corIcone = 'text-[var(--color-ink-subtle)] bg-white border-[var(--color-border-strong)]'
        if (concluidaComSucesso) {
          Icone = Check
          corIcone = 'text-white bg-[var(--color-success)] border-[var(--color-success)]'
        } else if (negativa) {
          Icone = negativa.decisao === 'devolvido' ? RotateCcw : X
          corIcone = negativa.decisao === 'devolvido' ? 'text-white bg-[var(--color-warning)] border-[var(--color-warning)]' : 'text-white bg-[var(--color-danger)] border-[var(--color-danger)]'
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
                {ativo && !aguardandoSegundaAprovacao && ' · aguardando'}
              </p>
              {decisoes.length > 0 ? (
                decisoes.map((d, i) => (
                  <div key={i} className={i > 0 ? 'mt-1.5' : undefined}>
                    <p className="text-xs text-[var(--color-ink-muted)]">{d.aprovadorNome}</p>
                    <p className="text-[11px] text-[var(--color-ink-subtle)]">{formatDateTime(d.data)}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--color-ink-subtle)]">{ativo ? 'Pendente de decisão' : 'Não iniciada'}</p>
              )}
              {aguardandoSegundaAprovacao && (
                <p className="mt-1 text-[11px] text-[var(--color-warning)]">Aguardando aprovação do outro gestor (origem/destino).</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
