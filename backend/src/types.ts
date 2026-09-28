// Tipos do contrato HTTP (camelCase, ids como string). Espelham src/types/index.ts do frontend.

export type StatusColaborador = 'ativo' | 'afastado' | 'inativo'
export type StatusSincronizacao = 'sincronizado' | 'divergente' | 'pendente'
export type PerfilDemo = 'gestor' | 'rh_local' | 'rh_central' | 'auditoria' | 'share'
export type EtapaMovimentacao = 'gestor' | 'rh_local' | 'rh_central' | 'concluida'
export type StatusMovimentacao = 'rascunho' | 'em_andamento' | 'devolvida' | 'reprovada' | 'aprovada' | 'cancelada'
export type TipoMovimentacao =
  | 'mudanca_gestor'
  | 'alteracao_cargo'
  | 'alteracao_salarial'
  | 'promocao'
  | 'enquadramento'
  | 'transferencia_cc'
  | 'merito'
  | 'transferencia_localidade'
  | 'alteracao_mao_de_obra'
  | 'alteracao_area_atuacao'
export type TipoDocumento = 'evidencia' | 'documento_aprovado' | 'offer_letter' | 'c_req' | 'e_req' | 'carta_promocao' | 'carta_merito'
export type TipoMaoDeObra = 'direta' | 'indireta'
export type Potencial = 'baixo' | 'estavel' | 'alto'
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
  | 'cancelamento'
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
  'merito',
  'transferencia_localidade',
  'alteracao_mao_de_obra',
  'alteracao_area_atuacao',
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
export interface AlteracaoMerito {
  tipo: 'merito'
  salarioAtual: number
  salarioProposto: number
}
export interface AlteracaoTransferenciaLocalidade {
  tipo: 'transferencia_localidade'
  plantaAtualId: string
  plantaPropostaId: string
  centroCustoAtualId: string
  centroCustoPropostoId: string
  gestorAtualId: string | null
  gestorPropostoId: string | null
}
export interface AlteracaoMaoDeObra {
  tipo: 'alteracao_mao_de_obra'
  tipoMaoDeObraAtual: TipoMaoDeObra | null
  tipoMaoDeObraProposto: TipoMaoDeObra
}
export interface AlteracaoAreaAtuacao {
  tipo: 'alteracao_area_atuacao'
  areaAtualId: string
  areaPropostaId: string
}
export type DetalheAlteracao =
  | AlteracaoMudancaGestor
  | AlteracaoCargo
  | AlteracaoSalarial
  | AlteracaoPromocao
  | AlteracaoEnquadramento
  | AlteracaoTransferenciaCC
  | AlteracaoMerito
  | AlteracaoTransferenciaLocalidade
  | AlteracaoMaoDeObra
  | AlteracaoAreaAtuacao

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
  plantaPropostaId?: string | null
  tipoMaoDeObraProposto?: TipoMaoDeObra | null
  areaPropostaId?: string | null
}

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: PerfilDemo
  plantaId: string | null
  colaboradorId: string | null
}
