// Recursos de demonstração (existem no backend somente com DEMO_MODE=true).
import { apiJson } from '@/lib/apiClient'
import { useAppStore } from '@/store/useAppStore'
import type { LogIntegracao } from '@/types'
import { carregarDadosIniciais, mutar } from './bootstrapService'

export async function restaurarDemonstracao(): Promise<void> {
  const { logsIntegracao } = await mutar(() => apiJson<{ logsIntegracao: LogIntegracao[] }>('/dev/reset', { method: 'POST', timeoutMs: 60_000 }))
  await carregarDadosIniciais()
  useAppStore.getState().mesclarLogs(logsIntegracao)
}

/** O servidor registra a falha no log e responde com erro; a página trata o erro para exibir o aviso. */
export async function simularFalhaIntegracao(): Promise<void> {
  await mutar(() => apiJson('/dev/integration-failure', { method: 'POST' }))
}

export async function limparLogsIntegracao(): Promise<void> {
  const { logsIntegracao } = await mutar(() => apiJson<{ logsIntegracao: LogIntegracao[] }>('/logs-integracao', { method: 'DELETE' }))
  useAppStore.getState().substituirLogs(logsIntegracao)
}
