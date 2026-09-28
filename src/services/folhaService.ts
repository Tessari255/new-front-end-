// Fechamento mensal da folha (perfil Share) e liberação do RH para entrada na Folha.
import { apiJson } from '@/lib/apiClient'
import { useAppStore, type RecursoMovimentacao } from '@/store/useAppStore'
import type { FechamentoFolha, LogIntegracao } from '@/types'
import { mutar } from './bootstrapService'

async function aplicarFechamento(chamada: () => Promise<{ fechamento: FechamentoFolha; logs: LogIntegracao[] }>): Promise<FechamentoFolha> {
  const { fechamento, logs } = await mutar(chamada)
  useAppStore.setState((s) => ({ fechamentoFolha: fechamento, logsIntegracao: logs.length ? [...s.logsIntegracao, ...logs] : s.logsIntegracao }))
  return fechamento
}

/** `mes` no formato AAAA-MM (ou AAAA-MM-DD; o servidor normaliza ao dia 1). */
export async function travarFolha(mes: string): Promise<FechamentoFolha> {
  return aplicarFechamento(() => apiJson('/folha/travar', { method: 'POST', json: { mes } }))
}

export async function liberarFolha(): Promise<FechamentoFolha> {
  return aplicarFechamento(() => apiJson('/folha/liberar', { method: 'POST' }))
}

export async function liberarMovimentacaoParaFolha(movimentacaoId: string): Promise<void> {
  const recurso = await mutar(() => apiJson<RecursoMovimentacao>(`/movimentacoes/${movimentacaoId}/liberar-folha`, { method: 'POST' }))
  useAppStore.getState().mesclarMovimentacao(recurso)
}
