import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import type { Insight } from '@/lib/insights'

export function ResumoInteligentePanel({ insights }: { insights: Insight[] }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">Resumo inteligente</h2>
        <span className="ml-auto rounded-full border border-[var(--color-border)] bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">
          Análise simulada
        </span>
      </div>

      {insights.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">Sem sinais relevantes no momento — operação dentro do esperado.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {insights.map((insight) => (
            <li key={insight.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-slate-50/60 p-3.5">
              <p className="text-[13.5px] font-medium leading-snug text-[var(--color-ink)]">{insight.titulo}</p>
              <p className="mt-1 text-[13px] leading-snug text-[var(--color-ink-muted)]">{insight.descricao}</p>
              <Link
                to={insight.to}
                className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-accent-hover)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
              >
                Ver registros citados
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
