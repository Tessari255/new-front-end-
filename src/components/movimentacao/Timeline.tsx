import { FilePlus2, FileCheck2, ThumbsUp, RotateCcw, ThumbsDown, FlagOff, Download, PenLine, ClipboardCheck, Ban } from 'lucide-react'
import type { EventoHistorico } from '@/types'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const ICONES: Record<EventoHistorico['tipo'], typeof FilePlus2> = {
  abertura: FilePlus2,
  edicao: PenLine,
  anexo: FileCheck2,
  validacao: ClipboardCheck,
  aprovacao: ThumbsUp,
  devolucao: RotateCcw,
  reprovacao: ThumbsDown,
  conclusao: FlagOff,
  geracao_arquivo: Download,
  cancelamento: Ban,
}

const CORES: Record<EventoHistorico['tipo'], string> = {
  abertura: 'bg-slate-100 text-[var(--color-ink-muted)]',
  edicao: 'bg-slate-100 text-[var(--color-ink-muted)]',
  anexo: 'bg-blue-50 text-blue-600',
  validacao: 'bg-slate-100 text-[var(--color-ink-muted)]',
  aprovacao: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  devolucao: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  reprovacao: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  conclusao: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
  geracao_arquivo: 'bg-violet-50 text-violet-600',
  cancelamento: 'bg-slate-100 text-[var(--color-ink-muted)]',
}

export function Timeline({ eventos }: { eventos: EventoHistorico[] }) {
  const ordenados = [...eventos].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
  return (
    <ol className="space-y-5">
      {ordenados.map((evento, idx) => {
        const Icone = ICONES[evento.tipo]
        return (
          <li key={evento.id} className="relative flex gap-3">
            {idx < ordenados.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-4px)] w-px bg-[var(--color-border)]" aria-hidden="true" />
            )}
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', CORES[evento.tipo])}>
              <Icone className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 pb-1">
              <p className="text-[13.5px] font-medium text-[var(--color-ink)]">{evento.descricao}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                {evento.autor} · {formatDateTime(evento.data)}
              </p>
              {evento.comentario && (
                <p className="mt-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-slate-50/70 px-3 py-2 text-[13px] text-[var(--color-ink)]">
                  “{evento.comentario}”
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
