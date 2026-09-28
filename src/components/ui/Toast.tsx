import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mensagemDeErro } from '@/lib/apiClient'

type ToastTipo = 'sucesso' | 'erro' | 'aviso' | 'info'

interface ToastItem {
  id: string
  titulo: string
  descricao?: string
  tipo: ToastTipo
}

interface ToastContextValue {
  notificar: (toast: Omit<ToastItem, 'id'>) => void
  /** Exibe um erro de API (ou qualquer erro) com mensagem segura para a interface. */
  notificarErro: (erro: unknown, titulo?: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const ICONES: Record<ToastTipo, React.ElementType> = {
  sucesso: CheckCircle2,
  erro: XCircle,
  aviso: AlertTriangle,
  info: Info,
}

const CORES: Record<ToastTipo, string> = {
  sucesso: 'text-[var(--color-success)]',
  erro: 'text-[var(--color-danger)]',
  aviso: 'text-[var(--color-warning)]',
  info: 'text-[var(--color-info)]',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const notificar = React.useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((atual) => [...atual, { ...toast, id }])
  }, [])

  const notificarErro = React.useCallback(
    (erro: unknown, titulo = 'Não foi possível concluir a ação') => notificar({ tipo: 'erro', titulo, descricao: mensagemDeErro(erro) }),
    [notificar],
  )

  const remover = (id: string) => setToasts((atual) => atual.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ notificar, notificarErro }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4200}>
        {children}
        {toasts.map((toast) => {
          const Icone = ICONES[toast.tipo]
          return (
            <ToastPrimitive.Root
              key={toast.id}
              onOpenChange={(open) => !open && remover(toast.id)}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-popover)] data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]"
            >
              <Icone className={cn('mt-0.5 size-5 shrink-0', CORES[toast.tipo])} aria-hidden="true" />
              <div className="flex-1 space-y-0.5">
                <ToastPrimitive.Title className="text-sm font-semibold text-[var(--color-ink)]">
                  {toast.titulo}
                </ToastPrimitive.Title>
                {toast.descricao && (
                  <ToastPrimitive.Description className="text-[13px] text-[var(--color-ink-muted)]">
                    {toast.descricao}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close aria-label="Fechar notificação" className="text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]">
                <X className="size-4" aria-hidden="true" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          )
        })}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] m-0 flex w-full max-w-sm list-none flex-col gap-2.5 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider.')
  return ctx
}
