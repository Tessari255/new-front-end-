import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { ChecagemRegra } from '@/types'
import { cn } from '@/lib/utils'

export function ChecagensList({ checagens }: { checagens: ChecagemRegra[] }) {
  if (checagens.length === 0) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Nenhuma checagem aplicável.</p>
  }
  return (
    <ul className="space-y-2">
      {checagens.map((chk) => {
        const Icone = chk.atendida ? CheckCircle2 : chk.severidade === 'bloqueante' ? XCircle : AlertTriangle
        const cor = chk.atendida ? 'text-[var(--color-success)]' : chk.severidade === 'bloqueante' ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'
        return (
          <li key={chk.id} className="flex items-start gap-2.5 text-sm">
            <Icone className={cn('mt-0.5 size-4 shrink-0', cor)} aria-hidden="true" />
            <span className={chk.atendida ? 'text-[var(--color-ink)]' : cor}>
              {chk.descricao}
              {!chk.atendida && chk.severidade === 'aviso' && <span className="ml-1 text-xs text-[var(--color-ink-subtle)]">(aviso — não bloqueia o envio)</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
