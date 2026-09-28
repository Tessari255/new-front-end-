// Tipos do contrato HTTP (camelCase, ids como string). Espelham src/types/index.ts do frontend.

export type StatusColaborador = 'ativo' | 'afastado' | 'inativo'
export type StatusSincronizacao = 'sincronizado' | 'divergente' | 'pendente'
export type PerfilDemo = 'gestor' | 'rh_local' | 'rh_central' | 'auditoria'
export type EtapaMovimentacao = 'gestor' | 'rh_local' | 'rh_central' | 'concluida'
export type StatusMovimentacao = 'rascunho' | 'em_andamento' | 'devolvida' | 'reprovada' | 'aprovada'
export type TipoMovimentacao =
  | 'mudanca_gestor'
  | 'alteracao_cargo'
  | 'alteracao_salarial'
  | 'promocao'
  | 'enquadramento'
  | 'transferencia_cc'
export type TipoDocumento = 'evidencia' | 'documento_aprovado' | 'offer_letter' | 'c_req' | 'e_req'
export type Decisao = 'aprovado' | 'devolvido' | 'reprovado'
export type TipoEvento =
  | 'abertura'
  | 'edicao'
  | 'anexo'
  | 'validacao'
  | 'aprovacao'
  | 'devolucao'
  | 'reprovacao'
  | 'conclusao'
  | 'geracao_arquivo'
export type CampoDivergente = 'gestor' | 'cargo' | 'centro_custo' | 'area'
export type StatusDivergencia = 'aberta' | 'em_tratamento' | 'resolvida'
export type CategoriaLog = 'movimentacao' | 'aprovacao' | 'conciliacao' | 'exportacao' | 'sistema'

export const TIPOS_MOVIMENTACAO: TipoMovimentacao[] = [
  'mudanca_gestor',
  'alteracao_cargo',
  'alteracao_salarial',
  'promocao',
  'enquadramento',
  'transferencia_cc',
]

export interface AlteracaoMudancaGestor {
  tipo: 'mudanca_gestor'
  gestorAtualId: string | null
  gestorPropostoId: string
}
export interface AlteracaoCargo {
  tipo: 'alteracao_cargo'
  cargoAtualId: string
  cargoPropostoId: string
}
export interface AlteracaoSalarial {
  tipo: 'alteracao_salarial'
  salarioAtual: number
  salarioProposto: number
}
export interface AlteracaoPromocao {
  tipo: 'promocao'
  cargoAtualId: string
  cargoPropostoId: string
  salarioAtual: number
  salarioProposto: number
}
export interface AlteracaoEnquadramento {
  tipo: 'enquadramento'
  folhaAtualId: string
  folhaPropostaId: string
  horarioAtualId: string
  horarioPropostoId: string
}
export interface AlteracaoTransferenciaCC {
  tipo: 'transferencia_cc'
  centroCustoAtualId: string
  centroCustoPropostoId: string
  plantaAtualId: string
  plantaPropostaId: string
}
export type DetalheAlteracao =
  | AlteracaoMudancaGestor
  | AlteracaoCargo
  | AlteracaoSalarial
  | AlteracaoPromocao
  | AlteracaoEnquadramento
  | AlteracaoTransferenciaCC

export interface ChecagemRegra {
  id: string
  descricao: string
  atendida: boolean
  severidade: 'bloqueante' | 'aviso'
}

/** Valores propostos enviados pelo cliente; os valores atuais são sempre derivados no servidor. */
export interface PropostaAlteracao {
  tipo: TipoMovimentacao
  gestorPropostoId?: string | null
  cargoPropostoId?: string | null
  salarioProposto?: number | null
  folhaPropostaId?: string | null
  horarioPropostoId?: string | null
  centroCustoPropostoId?: string | null
}

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: PerfilDemo
  plantaId: string | null
  colaboradorId: string | null
}
