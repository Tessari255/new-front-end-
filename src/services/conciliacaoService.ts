// Conciliação de dados (Apdata × Employee Central): execução, atribuição e resolução no servidor.
import { apiJson } from '@/lib/apiClient'
import { useAppStore, type RecursoConciliacao, type RecursoDivergencia } from '@/store/useAppStore'
import { mutar } from './bootstrapService'

export async function executarConferencia(): Promise<void> {
  const recurso = await mutar(() => apiJson<RecursoConciliacao>('/conciliacoes', { method: 'POST', timeoutMs: 60_000 }))
  useAppStore.getState().mesclarConciliacao(recurso)
}

export async function atribuirResponsavel(divergenciaId: string, colaboradorId: string): Promise<void> {
  const recurso = await mutar(() =>
    apiJson<RecursoDivergencia>(`/divergencias/${divergenciaId}/responsavel`, { method: 'PATCH', json: { responsavelId: colaboradorId } }),
  )
  useAppStore.getState().mesclarDivergencia(recurso)
}

export async function resolverDivergencia(divergenciaId: string, justificativa: string): Promise<void> {
  const recurso = await mutar(() =>
    apiJson<RecursoDivergencia>(`/divergencias/${divergenciaId}/resolucao`, { method: 'POST', json: { justificativa } }),
  )
  useAppStore.getState().mesclarDivergencia(recurso)
}
