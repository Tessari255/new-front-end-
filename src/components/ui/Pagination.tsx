import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

export function Pagination({
  pagina,
  totalPaginas,
  totalItens,
  itensPorPagina,
  onMudarPagina,
}: {
  pagina: number
  totalPaginas: number
  totalItens: number
  itensPorPagina: number
  onMudarPagina: (pagina: number) => void
}) {
  if (totalItens === 0) return null
  const inicio = (pagina - 1) * itensPorPagina + 1
  const fim = Math.min(pagina * itensPorPagina, totalItens)

  return (
    <div className="flex flex-col-reverse items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3 sm:flex-row">
      <p className="text-xs text-[var(--color-ink-muted)]">
        Mostrando <span className="font-medium text-[var(--color-ink)]">{inicio}</span>–
        <span className="font-medium text-[var(--color-ink)]">{fim}</span> de{' '}
        <span className="font-medium text-[var(--color-ink)]">{totalItens}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onMudarPagina(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <span className="min-w-[5.5rem] text-center text-xs text-[var(--color-ink-muted)]">
          Página {pagina} de {Math.max(totalPaginas, 1)}
        </span>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onMudarPagina(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
