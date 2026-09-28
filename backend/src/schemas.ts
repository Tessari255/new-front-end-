// JSON Schemas do Fastify: validam requests e servem de allow-list na serialização das responses.
import { TIPOS_MOVIMENTACAO } from './types.ts'

const str = { type: 'string' } as const
const strNull = { type: ['string', 'null'] } as const
const num = { type: 'number' } as const
const numNull = { type: ['number', 'null'] } as const
const int = { type: 'integer' } as const
const intNull = { type: ['integer', 'null'] } as const
const bool = { type: 'boolean' } as const

function obj(properties: Record<string, unknown>, required: string[] = Object.keys(properties)) {
  return { type: 'object', properties, required, additionalProperties: false } as const
}
function arr(items: unknown) {
  return { type: 'array', items } as const
}

const idPattern = { type: 'string', pattern: '^[0-9]{1,18}$' } as const
const idOpcional = { type: ['string', 'null'], pattern: '^[0-9]{0,18}$' } as const

// ---------- Requests ----------

export const paramsId = obj({ id: idPattern })

const alteracaoProposta = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tipo: { type: 'string', enum: TIPOS_MOVIMENTACAO },
    gestorPropostoId: idOpcional,
    cargoPropostoId: idOpcional,
    salarioProposto: { type: ['number', 'null'] },
    folhaPropostaId: idOpcional,
    horarioPropostoId: idOpcional,
    centroCustoPropostoId: idOpcional,
    plantaPropostaId: idOpcional,
    tipoMaoDeObraProposto: { type: ['string', 'null'], enum: ['direta', 'indireta', null] },
    areaPropostaId: idOpcional,
  },
} as const

export const bodyMovimentacao = {
  type: 'object',
  additionalProperties: false,
  required: ['colaboradorId', 'tipo'],
  properties: {
    colaboradorId: idPattern,
    tipo: { type: 'string', enum: TIPOS_MOVIMENTACAO },
    vigencia: { type: ['string', 'null'], maxLength: 10 },
    justificativa: { type: ['string', 'null'], maxLength: 5000 },
    alteracao: alteracaoProposta,
    potencial: { type: ['string', 'null'], enum: ['baixo', 'estavel', 'alto', null] },
  },
} as const

export const bodyDecisao = {
  type: 'object',
  additionalProperties: false,
  required: ['decisao'],
  properties: {
    decisao: { type: 'string', enum: ['aprovado', 'devolvido', 'reprovado'] },
    comentario: { type: ['string', 'null'], maxLength: 2000 },
  },
} as const

export const bodyResponsavel = obj({ responsavelId: idPattern })
export const bodyResolucao = obj({ justificativa: { type: 'string', maxLength: 2000 } })
export const bodyConfiguracaoCargo = obj({
  plantaId: idPattern,
  salarioBase: { type: ['number', 'null'], minimum: 0, maximum: 999999999999.99 },
  ipe: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
})
export const bodyTravarFolha = obj({ mes: { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$' } })

// ---------- Responses ----------

const planta = obj({ id: str, nome: str, cidade: str, estado: str, codigo: str })
const area = obj({ id: str, nome: str })
const configuracaoCargoPorPlanta = obj({ plantaId: str, salarioBase: numNull, ipe: intNull })
const cargo = obj({
  id: str,
  nome: str,
  nivel: str,
  areaId: str,
  salarioMin: num,
  salarioMax: num,
  plantasPermitidas: arr(str),
  configuracoesPorPlanta: arr(configuracaoCargoPorPlanta),
})
const centroCusto = obj({ id: str, codigo: str, nome: str, plantaId: str })
const horario = obj({ id: str, nome: str, turno: str, cargaHorariaSemanal: int })
const folha = obj({ id: str, nome: str, tipo: str, periodicidade: str })
export const colaborador = obj({
  id: str,
  matricula: str,
  nome: str,
  email: str,
  telefone: str,
  dataAdmissao: str,
  status: str,
  cargoId: str,
  areaId: str,
  plantaId: str,
  centroCustoId: str,
  horarioId: str,
  folhaId: str,
  gestorId: strNull,
  isGestor: bool,
  salario: num,
  salarioBaseCargo: numNull,
  faixaAtualPercentual: numNull,
  ipe: intNull,
  tipoMaoDeObra: strNull,
  externos: obj({ apdataId: str, employeeCentralId: str, statusSincronizacao: str }),
})

const checagem = obj({ id: str, descricao: str, atendida: bool, severidade: str })
const decisao = obj(
  {
    etapa: str,
    aprovadorPerfil: str,
    aprovadorNome: str,
    decisao: str,
    comentario: str,
    data: str,
  },
  ['etapa', 'aprovadorPerfil', 'aprovadorNome', 'decisao', 'data'],
)
export const movimentacao = obj(
  {
    id: str,
    protocolo: str,
    colaboradorId: str,
    tipo: str,
    plantaId: str,
    solicitanteNome: str,
    dataAbertura: str,
    vigencia: str,
    etapaAtual: str,
    status: str,
    alteracao: { type: 'object', additionalProperties: true },
    justificativa: str,
    potencial: strNull,
    documentosIds: arr(str),
    checagens: arr(checagem),
    decisoes: arr(decisao),
    rhLiberadaFolhaEm: str,
    arquivosGerados: obj({ apdataGeradoEm: str, employeeCentralGeradoEm: str }, []),
  },
  [
    'id', 'protocolo', 'colaboradorId', 'tipo', 'plantaId', 'solicitanteNome', 'dataAbertura', 'vigencia', 'etapaAtual',
    'status', 'alteracao', 'justificativa', 'potencial', 'documentosIds', 'checagens', 'decisoes', 'arquivosGerados',
  ],
)
export const documento = obj(
  {
    id: str,
    movimentacaoId: str,
    nome: str,
    tipo: str,
    tamanhoBytes: int,
    autorId: strNull,
    autorNome: str,
    criadoEm: str,
    mime: str,
    sha256: strNull,
    temConteudo: bool,
  },
  ['id', 'movimentacaoId', 'nome', 'tipo', 'tamanhoBytes', 'autorId', 'autorNome', 'criadoEm'],
)
export const evento = obj(
  { id: str, movimentacaoId: str, tipo: str, data: str, autor: str, descricao: str, comentario: str },
  ['id', 'movimentacaoId', 'tipo', 'data', 'autor', 'descricao'],
)
export const divergencia = obj(
  {
    id: str,
    colaboradorId: str,
    plantaId: str,
    campo: str,
    valorApdata: str,
    valorEmployeeCentral: str,
    responsavelId: strNull,
    status: str,
    detectadaEm: str,
    resolvidaEm: str,
    justificativaResolucao: str,
  },
  ['id', 'colaboradorId', 'plantaId', 'campo', 'valorApdata', 'valorEmployeeCentral', 'responsavelId', 'status', 'detectadaEm'],
)
export const conferencia = obj({ executadaEm: str, registrosComparados: int })
export const logIntegracao = obj(
  { id: str, data: str, acao: str, categoria: str, status: str, duracaoMs: int, detalhe: str, erro: str },
  ['id', 'data', 'acao', 'categoria', 'status', 'duracaoMs', 'detalhe'],
)
export const usuario = obj({
  id: str,
  nome: str,
  email: str,
  perfil: str,
  plantaId: strNull,
  colaboradorId: strNull,
})
export const fechamentoFolha = obj({ mesTravado: strNull, travadoEm: strNull, travadoPorNome: strNull })

export const respostaBootstrap = obj({
  plantas: arr(planta),
  areas: arr(area),
  cargos: arr(cargo),
  centrosCusto: arr(centroCusto),
  horarios: arr(horario),
  folhas: arr(folha),
  colaboradores: arr(colaborador),
  movimentacoes: arr(movimentacao),
  documentos: arr(documento),
  historico: arr(evento),
  divergencias: arr(divergencia),
  conferencia,
  logsIntegracao: arr(logIntegracao),
  currentUser: usuario,
  fechamentoFolha,
})

/** Recurso canônico devolvido por toda mutação de movimentação. */
export const respostaMovimentacao = obj({
  movimentacao,
  documentos: arr(documento),
  historico: arr(evento),
  logs: arr(logIntegracao),
})

export const respostaDivergencia = obj({
  divergencia,
  colaborador,
  logs: arr(logIntegracao),
})

export const respostaConciliacao = obj({
  conferencia,
  divergencias: arr(divergencia),
  colaboradores: arr(colaborador),
  logs: arr(logIntegracao),
})

export const respostaLogs = obj({ logsIntegracao: arr(logIntegracao) })
export const respostaConfiguracaoCargo = obj({ configuracao: configuracaoCargoPorPlanta, logs: arr(logIntegracao) })
export const respostaUsuariosDemo = obj({
  usuarios: arr(
    obj({ id: str, nome: str, perfil: str, plantaNome: strNull, descricao: str }),
  ),
})

export const respostaUsuarioAtual = obj({ usuario })

export const respostaFechamentoFolha = obj({ fechamento: fechamentoFolha, logs: arr(logIntegracao) })
