// Modelo de dados do domínio Nexo People.
// Contrato de dados servido pela API (backend/, PostgreSQL). Ids são strings.

export type StatusColaborador = 'ativo' | 'afastado' | 'inativo'

export type StatusSincronizacao = 'sincronizado' | 'divergente' | 'pendente'

export interface Planta {
  id: string
  nome: string
  cidade: string
  estado: string
  codigo: string
}

export interface Area {
  id: string
  nome: string
}

export interface CentroCusto {
  id: string
  codigo: string
  nome: string
  plantaId: string
}

export interface ConfiguracaoCargoPorPlanta {
  plantaId: string
  salarioBase: number | null
  ipe: number | null
}

export interface Cargo {
  id: string
  nome: string
  nivel: 'Operacional' | 'Técnico' | 'Coordenação' | 'Gerência' | 'Diretoria'
  areaId: string
  salarioMin: number
  salarioMax: number
  /** Plantas onde este cargo pode ser utilizado (regra fictícia de compatibilidade). */
  plantasPermitidas: string[]
  configuracoesPorPlanta: ConfiguracaoCargoPorPlanta[]
}

export interface Horario {
  id: string
  nome: string
  turno: '1º Turno' | '2º Turno' | '3º Turno' | 'Administrativo'
  cargaHorariaSemanal: number
}

export interface Folha {
  id: string
  nome: string
  tipo: 'Mensalista' | 'Horista'
  periodicidade: 'Mensal' | 'Quinzenal'
}

export interface IdentificadoresExternos {
  apdataId: string
  employeeCentralId: string
  statusSincronizacao: StatusSincronizacao
}

export type TipoMaoDeObra = 'direta' | 'indireta'
export type Potencial = 'baixo' | 'estavel' | 'alto'

export interface Colaborador {
  id: string
  matricula: string
  nome: string
  email: string
  telefone: string
  dataAdmissao: string // ISO date
  status: StatusColaborador
  cargoId: string
  areaId: string
  plantaId: string
  centroCustoId: string
  horarioId: string
  folhaId: string
  gestorId: string | null
  isGestor: boolean
  salario: number
  salarioBaseCargo: number | null
  faixaAtualPercentual: number | null
  ipe: number | null
  tipoMaoDeObra: TipoMaoDeObra | null
  externos: IdentificadoresExternos
}

// ---------- Movimentações ----------

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

export type EtapaMovimentacao = 'gestor' | 'rh_local' | 'rh_central' | 'concluida'

export type StatusMovimentacao =
  | 'rascunho'
  | 'em_andamento'
  | 'devolvida'
  | 'reprovada'
  | 'aprovada'

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

export interface Documento {
  id: string
  movimentacaoId: string
  nome: string
  tipo: 'evidencia' | 'documento_aprovado' | 'offer_letter' | 'c_req' | 'e_req' | 'carta_promocao' | 'carta_merito'
  tamanhoBytes: number
  /** Colaborador autor, quando o usuário está vinculado a um (RH pode não estar). */
  autorId: string | null
  autorNome: string
  criadoEm: string // ISO datetime
  mime?: string
  sha256?: string | null
  /** false nos documentos de demonstração que só possuem metadados (sem arquivo para baixar). */
  temConteudo?: boolean
}

export interface DecisaoEtapa {
  etapa: EtapaMovimentacao
  aprovadorPerfil: PerfilDemo
  aprovadorNome: string
  decisao: 'aprovado' | 'devolvido' | 'reprovado'
  comentario?: string
  data: string // ISO datetime
}

export interface EventoHistorico {
  id: string
  movimentacaoId: string
  tipo:
    | 'abertura'
    | 'edicao'
    | 'anexo'
    | 'validacao'
    | 'aprovacao'
    | 'devolucao'
    | 'reprovacao'
    | 'conclusao'
    | 'geracao_arquivo'
  data: string // ISO datetime
  autor: string
  descricao: string
  comentario?: string
}

export interface Movimentacao {
  id: string
  protocolo: string
  colaboradorId: string
  tipo: TipoMovimentacao
  plantaId: string
  solicitanteNome: string
  dataAbertura: string // ISO date
  vigencia: string // ISO date
  etapaAtual: EtapaMovimentacao
  status: StatusMovimentacao
  alteracao: DetalheAlteracao
  justificativa: string
  potencial: Potencial | null
  documentosIds: string[]
  checagens: ChecagemRegra[]
  decisoes: DecisaoEtapa[]
  arquivosGerados: {
    apdataGeradoEm?: string
    employeeCentralGeradoEm?: string
  }
}

// ---------- Conciliação ----------

export type CampoDivergente = 'gestor' | 'cargo' | 'centro_custo' | 'area'

export type StatusDivergencia = 'aberta' | 'em_tratamento' | 'resolvida'

export interface Divergencia {
  id: string
  colaboradorId: string
  plantaId: string
  campo: CampoDivergente
  valorApdata: string
  valorEmployeeCentral: string
  responsavelId: string | null
  status: StatusDivergencia
  detectadaEm: string // ISO datetime
  resolvidaEm?: string
  justificativaResolucao?: string
}

export interface ConferenciaConciliacao {
  executadaEm: string // ISO datetime
  registrosComparados: number
}

// ---------- Perfis de demonstração ----------

export type PerfilDemo = 'gestor' | 'rh_local' | 'rh_central' | 'auditoria'

/** Usuário autenticado (no modo demo: escolhido entre os usuários seedados; nunca enviado como perfil). */
export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: PerfilDemo
  plantaId: string | null
  colaboradorId: string | null
}

export interface UsuarioDemo {
  id: string
  nome: string
  perfil: PerfilDemo
  plantaNome: string | null
  descricao: string
}

export interface PerfilDemoInfo {
  id: PerfilDemo
  nome: string
  descricao: string
  etapa: EtapaMovimentacao | null
}

// ---------- Log de integração ----------

export type CategoriaLogIntegracao = 'movimentacao' | 'aprovacao' | 'conciliacao' | 'exportacao' | 'sistema'

export type StatusLogIntegracao = 'sucesso' | 'erro'

export interface LogIntegracao {
  id: string
  data: string // ISO datetime
  acao: string
  categoria: CategoriaLogIntegracao
  status: StatusLogIntegracao
  duracaoMs: number
  detalhe: string
  erro?: string
}
