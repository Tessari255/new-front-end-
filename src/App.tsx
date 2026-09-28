import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ToastProvider } from '@/components/ui/Toast'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { Button } from '@/components/ui/Button'
import { mensagemDeErro } from '@/lib/apiClient'
import { carregarDadosIniciais } from '@/services/bootstrapService'
import { useAppStore } from '@/store/useAppStore'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ColaboradoresListPage = lazy(() => import('@/pages/ColaboradoresListPage'))
const ColaboradorDetailPage = lazy(() => import('@/pages/ColaboradorDetailPage'))
const MovimentacoesListPage = lazy(() => import('@/pages/MovimentacoesListPage'))
const NovaMovimentacaoPage = lazy(() => import('@/pages/NovaMovimentacaoPage'))
const MovimentacaoDetailPage = lazy(() => import('@/pages/MovimentacaoDetailPage'))
const AprovacoesPage = lazy(() => import('@/pages/AprovacoesPage'))
const ConciliacaoPage = lazy(() => import('@/pages/ConciliacaoPage'))
const DivergenciaDetailPage = lazy(() => import('@/pages/DivergenciaDetailPage'))
const FolhaPage = lazy(() => import('@/pages/FolhaPage'))
const HistoricoPage = lazy(() => import('@/pages/HistoricoPage'))
const IntegrationLogPage = lazy(() => import('@/pages/IntegrationLogPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function CarregandoPagina() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" role="status" aria-label="Carregando" />
    </div>
  )
}

/** Carrega o estado inicial da API antes de exibir as páginas (com erro recuperável). */
function HidratacaoGate({ children }: { children: ReactNode }) {
  const hidratado = useAppStore((s) => s.hidratado)
  const [erro, setErro] = useState<unknown>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let cancelado = false
    carregarDadosIniciais().catch((e: unknown) => {
      if (!cancelado) setErro(e)
    })
    return () => {
      cancelado = true
    }
  }, [tentativa])

  if (hidratado) return <>{children}</>
  if (erro) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] px-4">
        <div role="alert" className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 text-center shadow-[var(--shadow-card)]">
          <h1 className="text-base font-semibold text-[var(--color-ink)]">Não foi possível carregar os dados</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{mensagemDeErro(erro)}</p>
          <Button
            className="mt-5"
            onClick={() => {
              setErro(null)
              setTentativa((t) => t + 1)
            }}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)]">
      <div className="size-6 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" role="status" aria-label="Carregando dados" />
    </div>
  )
}

export default function App() {
  return (
    <TooltipProvider delayDuration={250}>
      <ToastProvider>
        <HidratacaoGate>
          <BrowserRouter>
            <Suspense fallback={<CarregandoPagina />}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="colaboradores" element={<ColaboradoresListPage />} />
                  <Route path="colaboradores/:id" element={<ColaboradorDetailPage />} />
                  <Route path="movimentacoes" element={<MovimentacoesListPage />} />
                  <Route path="movimentacoes/nova" element={<NovaMovimentacaoPage />} />
                  <Route path="movimentacoes/:id" element={<MovimentacaoDetailPage />} />
                  <Route path="aprovacoes" element={<AprovacoesPage />} />
                  <Route path="conciliacao" element={<ConciliacaoPage />} />
                  <Route path="conciliacao/:id" element={<DivergenciaDetailPage />} />
                  <Route path="folha" element={<FolhaPage />} />
                  <Route path="historico" element={<HistoricoPage />} />
                  <Route path="integracao" element={<IntegrationLogPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </HidratacaoGate>
      </ToastProvider>
    </TooltipProvider>
  )
}
