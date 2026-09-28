// Geração de arquivos DEMONSTRATIVOS (Apdata .csv e Employee Central .json) — feita pelo backend.
// Formato não homologado: o layout oficial da transação 19092 e o canal do Employee Central não foram fornecidos.
import { apiDownload, apiJson, salvarArquivo } from '@/lib/apiClient'
import { useAppStore, type RecursoMovimentacao } from '@/store/useAppStore'
import { carregarLogs, mutar } from './bootstrapService'

async function baixar(movimentacaoId: string, destino: 'apdata' | 'employee-central'): Promise<void> {
  const arquivo = await mutar(() => apiDownload(`/movimentacoes/${movimentacaoId}/exportacoes/${destino}`, { method: 'POST' }))
  salvarArquivo(arquivo)
  // O download não traz o recurso canônico: recarrega a movimentação (timestamp + evento de auditoria) e o log.
  const recurso = await apiJson<RecursoMovimentacao>(`/movimentacoes/${movimentacaoId}`)
  useAppStore.getState().mesclarMovimentacao(recurso)
  await carregarLogs()
}

export const gerarArquivoApdata = (movimentacaoId: string) => baixar(movimentacaoId, 'apdata')
export const gerarArquivoEmployeeCentral = (movimentacaoId: string) => baixar(movimentacaoId, 'employee-central')
