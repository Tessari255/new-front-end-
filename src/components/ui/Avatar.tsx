import { cn } from '@/lib/utils'
import { initials } from '@/lib/format'

const PALETA = [
  'bg-rose-50 text-rose-600',
  'bg-blue-50 text-blue-600',
  'bg-emerald-50 text-emerald-600',
  'bg-amber-50 text-amber-700',
  'bg-violet-50 text-violet-600',
  'bg-cyan-50 text-cyan-700',
]

function corPara(nome: string): string {
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) % PALETA.length
  return PALETA[Math.abs(hash)]!
}

export function Avatar({ nome, size = 'md', className }: { nome: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = size === 'sm' ? 'size-7 text-[11px]' : size === 'lg' ? 'size-12 text-base' : 'size-9 text-[13px]'
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', dims, corPara(nome), className)}
      aria-hidden="true"
    >
      {initials(nome)}
    </span>
  )
}
