import { CircleDot } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'

export function DemoBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink-muted)]">
          <CircleDot className="size-3 text-[var(--color-accent)]" aria-hidden="true" />
          Ambiente de demonstração
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px]">
        Todos os dados são fictícios e ficam salvos no PostgreSQL do ambiente local. Não há integração real com Apdata ou Employee Central; os arquivos de saída são demonstrativos.
      </TooltipContent>
    </Tooltip>
  )
}
