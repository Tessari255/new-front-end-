import { ArrowRight } from 'lucide-react'
import type { CampoComparado } from '@/lib/movimentacao'

export function ComparacaoCampos({ campos }: { campos: CampoComparado[] }) {
  if (campos.length === 0) return null
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">
            <th className="px-4 py-2.5">Campo</th>
            <th className="px-4 py-2.5">Valor atual</th>
            <th className="w-8" />
            <th className="px-4 py-2.5">Valor proposto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] bg-white">
          {campos.map((campo) => (
            <tr key={campo.label}>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-[var(--color-ink)]">{campo.label}</td>
              <td className="px-4 py-3 text-[var(--color-ink-muted)]">{campo.antes}</td>
              <td className="px-1 py-3 text-center text-[var(--color-ink-subtle)]">
                <ArrowRight className="mx-auto size-3.5" aria-hidden="true" />
              </td>
              <td className="px-4 py-3 font-medium text-[var(--color-accent-hover)]">{campo.depois}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
