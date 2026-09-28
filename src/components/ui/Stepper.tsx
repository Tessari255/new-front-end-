import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepperStep {
  label: string
  description?: string
}

export function Stepper({ steps, atual }: { steps: StepperStep[]; atual: number }) {
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-0" aria-label="Etapas do formulário">
      {steps.map((step, idx) => {
        const concluido = idx < atual
        const ativo = idx === atual
        return (
          <li key={step.label} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-stretch">
            <div className="flex items-center gap-3 sm:w-full">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors',
                  concluido && 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white',
                  ativo && 'border-[var(--color-accent)] text-[var(--color-accent)] bg-white',
                  !concluido && !ativo && 'border-[var(--color-border-strong)] text-[var(--color-ink-subtle)] bg-white',
                )}
                aria-current={ativo ? 'step' : undefined}
              >
                {concluido ? <Check className="size-3.5" aria-hidden="true" /> : idx + 1}
              </span>
              {idx < steps.length - 1 && (
                <span className={cn('h-px flex-1 sm:hidden', concluido ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]')} />
              )}
            </div>
            <div className="mt-0 pb-4 sm:mt-2 sm:pb-0">
              <p className={cn('text-[13px] font-medium', ativo || concluido ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-subtle)]')}>
                {step.label}
              </p>
              {step.description && <p className="mt-0.5 hidden text-xs text-[var(--color-ink-muted)] sm:block">{step.description}</p>}
            </div>
            {idx < steps.length - 1 && (
              <span className={cn('mt-3.5 hidden h-px flex-1 sm:block', concluido ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
