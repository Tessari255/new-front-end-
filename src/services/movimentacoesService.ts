// Serviços de Movimentações: chamadas HTTP à API. O servidor recalcula regras, deriva
// identidade/planta/valores atuais e registra o log de integração; o cliente só mescla a resposta.
import { apiDownload, apiJson, salvarArquivo } from '@/lib/apiClient'
import { useAppStore, type RecursoMovimentacao } from '@/store/useAppStore'
import type { DetalheAlteracao, Documento, Movimentacao, Potencial, TipoMovimentacao } from '@/types'
import { mutar } from './bootstrapService'

export interface NovaMovimentacaoInput {
  colaboradorId: string
  tipo: TipoMovimentacao
  vigencia: string
  justificativa: string
  alteracao: DetalheAlteracao
  potencial?: Potencial | null
  /** Id da raiz de um chamado existente, para registrar esta como mais uma alteração dele. */
  chamadoPaiId?: string | null
  /** Arquivos reais (File) enviados via multipart após a criação/atualização do rascunho. */
  arquivos: File[]
  comoRascunho: boolean
}

export interface ProgressoEnvio {
  onRascunho?: (movimentacao: Movimentacao) => void
  onArquivoEnviado?: (arquivo: File) => void
}

/** Apenas os valores propostos: os atuais são sempre derivados no servidor. */
function proposta(a: DetalheAlteracao) {
  switch (a.tipo) {
    case 'mudanca_gestor':
      return { tipo: a.tipo, gestorPropostoId: a.gestorPropostoId }
    case 'alteracao_cargo':
      return { tipo: a.tipo, cargoPropostoId: a.cargoPropostoId }
    case 'alteracao_salarial':
      return { tipo: a.tipo, salarioProposto: a.salarioProposto }
    case 'promocao':
      return { tipo: a.tipo, cargoPropostoId: a.cargoPropostoId, salarioProposto: a.salarioProposto }
    case 'enquadramento':
      return { tipo: a.tipo, folhaPropostaId: a.folhaPropostaId, horarioPropostoId: a.horarioPropostoId }
    case 'transferencia_cc':
      return { tipo: a.tipo, centroCustoPropostoId: a.centroCustoPropostoId }
    case 'merito':
      return { tipo: a.tipo, salarioProposto: a.salarioProposto }
    case 'transferencia_localidade':
      return { tipo: a.tipo, plantaPropostaId: a.plantaPropostaId, centroCustoPropostoId: a.centroCustoPropostoId, gestorPropostoId: a.gestorPropostoId }
    case 'alteracao_mao_de_obra':
      return { tipo: a.tipo, tipoMaoDeObraProposto: a.tipoMaoDeObraProposto }
    case 'alteracao_area_atuacao':
      return { tipo: a.tipo, areaPropostaId: a.areaPropostaId }
  }
}

function corpo(input: Omit<NovaMovimentacaoInput, 'arquivos' | 'comoRascunho'>) {
  return {
    colaboradorId: input.colaboradorId,
    tipo: input.tipo,
    vigencia: input.vigencia || null,
    justificativa: input.justificativa,
    alteracao: proposta(input.alteracao),
    potencial: input.potencial ?? null,
    chamadoPaiId: input.chamadoPaiId ?? null,
  }
}

function mesclar(recurso: RecursoMovimentacao): RecursoMovimentacao {
  useAppStore.getState().mesclarMovimentacao(recurso)
  return recurso
}

async function enviarArquivo(movimentacaoId: string, arquivo: File, tipo: Documento['tipo']): Promise<void> {
  const dados = new FormData()
  dados.append('tipo', tipo)
  dados.append('file', arquivo, arquivo.name)
  mesclar(
    await mutar(() =>
      apiJson<RecursoMovimentacao>(`/movimentacoes/${movimentacaoId}/documentos`, { method: 'POST', formData: dados, timeoutMs: 60_000 }),
    ),
  )
}

async function enviarArquivos(movimentacaoId: string, arquivos: File[], progresso?: ProgressoEnvio) {
  for (const arquivo of arquivos) {
    await enviarArquivo(movimentacaoId, arquivo, 'evidencia')
    progresso?.onArquivoEnviado?.(arquivo)
  }
}

function movimentacaoNoStore(id: string): Movimentacao {
  return useAppStore.getState().movimentacoes.find((m) => m.id === id)!
}

/**
 * Cria o rascunho, envia todos os arquivos e, somente depois, envia para aprovação.
 * Se algum upload falhar, o rascunho permanece salvo e o fluxo NÃO é enviado.
 */
export async function criarMovimentacao(input: NovaMovimentacaoInput, progresso?: ProgressoEnvio): Promise<Movimentacao> {
  const criada = mesclar(await mutar(() => apiJson<RecursoMovimentacao>('/movimentacoes', { method: 'POST', json: corpo(input) })))
  const id = criada.movimentacao.id
  progresso?.onRascunho?.(criada.movimentacao)
  await enviarArquivos(id, input.arquivos, progresso)
  if (!input.comoRascunho) await enviarParaAprovacao(id)
  return movimentacaoNoStore(id)
}

export async function atualizarRascunho(id: string, input: Omit<NovaMovimentacaoInput, 'comoRascunho'>, progresso?: ProgressoEnvio): Promise<void> {
  mesclar(await mutar(() => apiJson<RecursoMovimentacao>(`/movimentacoes/${id}/rascunho`, { method: 'PATCH', json: corpo(input) })))
  await enviarArquivos(id, input.arquivos, progresso)
}

export async function enviarParaAprovacao(id: string): Promise<void> {
  mesclar(await mutar(() => apiJson<RecursoMovimentacao>(`/movimentacoes/${id}/enviar`, { method: 'POST' })))
}

export async function decidirEtapa(id: string, decisao: 'aprovado' | 'devolvido' | 'reprovado', comentario?: string): Promise<void> {
  mesclar(await mutar(() => apiJson<RecursoMovimentacao>(`/movimentacoes/${id}/decisoes`, { method: 'POST', json: { decisao, comentario: comentario ?? null } })))
}

export async function cancelarMovimentacao(id: string): Promise<void> {
  mesclar(await mutar(() => apiJson<RecursoMovimentacao>(`/movimentacoes/${id}/cancelar`, { method: 'POST' })))
}

export async function adicionarDocumento(movimentacaoId: string, arquivo: File, tipo: Documento['tipo'] = 'evidencia'): Promise<void> {
  await enviarArquivo(movimentacaoId, arquivo, tipo)
}

export async function baixarDocumento(documento: Pick<Documento, 'id'>): Promise<void> {
  salvarArquivo(await apiDownload(`/documentos/${documento.id}/download`))
}
