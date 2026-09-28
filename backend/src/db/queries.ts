import type { Queryable } from './pool.ts'
import type { UsuarioAutenticado } from '../auth.ts'
import type {
  CampoDivergente,
  CategoriaLog,
  ChecagemRegra,
  Decisao,
  DetalheAlteracao,
  EtapaMovimentacao,
  PerfilDemo,
  StatusColaborador,
  StatusDivergencia,
  StatusMovimentacao,
  StatusSincronizacao,
  TipoDocumento,
  TipoEvento,
  TipoMovimentacao,
} from '../types.ts'

const iso = (d: Date | null | undefined): string | undefined => (d ? d.toISOString() : undefined)
export type Escopo = string[] | null

// ---------- Catálogos ----------

interface ConfiguracaoCargoPorPlantaRow {
  plantaId: string
  salarioBase: number | null
  ipe: number | null
}

interface CargoCatalogoRow {
  id: string
  nome: string
  nivel: string
  area_id: string
  salario_min: number
  salario_max: number
  plantas: string[]
  configuracoes: ConfiguracaoCargoPorPlantaRow[]
}

export async function carregarCatalogos(q: Queryable, escopo: Escopo) {
  // Catálogo de referência: como areas/cargos/horarios/folhas, plantas e centros de custo são
  // sempre globais (não sensíveis) — necessário para exibir corretamente movimentações que
  // referenciam outra planta (ex.: transferência de localidade), mesmo fora do escopo do usuário.
  const plantas = await q.query(`select id, nome, cidade, estado, codigo from plantas order by nome`)
  const areas = await q.query(`select id, nome from areas order by nome`)
  const cargos = await q.query<CargoCatalogoRow>(
    `select c.id, c.nome, c.nivel, c.area_id, c.salario_min, c.salario_max,
           coalesce(array_agg(cp.planta_id::text order by cp.planta_id) filter (where cp.planta_id is not null), '{}') as plantas,
           coalesce(
             jsonb_agg(
               jsonb_build_object('plantaId', cp.planta_id::text, 'salarioBase', cp.salario_base, 'ipe', cp.ipe)
               order by cp.planta_id
             ) filter (where cp.planta_id is not null and ($1::bigint[] is null or cp.planta_id = any($1::bigint[]))),
             '[]'::jsonb
           ) as configuracoes
      from cargos c left join cargo_plantas cp on cp.cargo_id = c.id
     group by c.id order by c.id`,
    [escopo],
  )
  const centros = await q.query(`select id, codigo, nome, planta_id from centros_custo order by codigo`)
  const horarios = await q.query(`select id, nome, turno, carga_horaria_semanal from horarios order by id`)
  const folhas = await q.query(`select id, nome, tipo, periodicidade from folhas order by id`)
  return {
    plantas: plantas.rows.map((r) => ({ id: r.id, nome: r.nome, cidade: r.cidade, estado: r.estado, codigo: r.codigo })),
    areas: areas.rows.map((r) => ({ id: r.id, nome: r.nome })),
    cargos: cargos.rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      nivel: r.nivel,
      areaId: r.area_id,
      salarioMin: r.salario_min,
      salarioMax: r.salario_max,
      plantasPermitidas: r.plantas,
      configuracoesPorPlanta: r.configuracoes,
    })),
    centrosCusto: centros.rows.map((r) => ({ id: r.id, codigo: r.codigo, nome: r.nome, plantaId: r.planta_id })),
    horarios: horarios.rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      turno: r.turno,
      cargaHorariaSemanal: r.carga_horaria_semanal,
    })),
    folhas: folhas.rows.map((r) => ({ id: r.id, nome: r.nome, tipo: r.tipo, periodicidade: r.periodicidade })),
  }
}

// ---------- Colaboradores ----------

interface ColaboradorRow {
  id: string
  matricula: string
  nome: string
  email: string
  telefone: string
  data_admissao: string
  status: StatusColaborador
  cargo_id: string
  area_id: string
  planta_id: string
  centro_custo_id: string
  horario_id: string
  folha_id: string
  gestor_id: string | null
  is_gestor: boolean
  salario: number
  salario_base: number | null
  faixa_atual_percentual: number | null
  ipe: number | null
  tipo_mao_de_obra: string | null
  apdata_id: string
  employee_central_id: string
  status_sincronizacao: StatusSincronizacao
}

export function mapColaborador(r: ColaboradorRow) {
  return {
    id: r.id,
    matricula: r.matricula,
    nome: r.nome,
    email: r.email,
    telefone: r.telefone,
    dataAdmissao: r.data_admissao,
    status: r.status,
    cargoId: r.cargo_id,
    areaId: r.area_id,
    plantaId: r.planta_id,
    centroCustoId: r.centro_custo_id,
    horarioId: r.horario_id,
    folhaId: r.folha_id,
    gestorId: r.gestor_id,
    isGestor: r.is_gestor,
    salario: r.salario,
    salarioBaseCargo: r.salario_base,
    faixaAtualPercentual: r.faixa_atual_percentual,
    ipe: r.ipe,
    tipoMaoDeObra: r.tipo_mao_de_obra,
    externos: {
      apdataId: r.apdata_id,
      employeeCentralId: r.employee_central_id,
      statusSincronizacao: r.status_sincronizacao,
    },
  }
}

const COLUNAS_COLABORADOR = `co.id, co.matricula, co.nome, co.email, co.telefone, co.data_admissao, co.status, co.cargo_id, co.area_id, co.planta_id,
  co.centro_custo_id, co.horario_id, co.folha_id, co.gestor_id, co.is_gestor, co.salario, co.apdata_id, co.employee_central_id, co.status_sincronizacao,
  co.tipo_mao_de_obra,
  cp.salario_base, cp.ipe,
  case when cp.salario_base > 0 then round((co.salario / cp.salario_base) * 100, 2) end as faixa_atual_percentual`

export async function listarColaboradores(q: Queryable, escopo: Escopo) {
  const { rows } = await q.query<ColaboradorRow>(
    `select ${COLUNAS_COLABORADOR}
       from colaboradores co
       left join cargo_plantas cp on cp.cargo_id = co.cargo_id and cp.planta_id = co.planta_id
      where ($1::bigint[] is null or co.planta_id = any($1::bigint[])) order by co.nome, co.id`,
    [escopo],
  )
  return rows.map(mapColaborador)
}

export async function buscarColaborador(q: Queryable, id: string) {
  const { rows } = await q.query<ColaboradorRow>(
    `select ${COLUNAS_COLABORADOR}
       from colaboradores co
       left join cargo_plantas cp on cp.cargo_id = co.cargo_id and cp.planta_id = co.planta_id
      where co.id = $1`,
    [id],
  )
  return rows[0] ? mapColaborador(rows[0]) : undefined
}

// ---------- Movimentações ----------

interface MovimentacaoRow {
  id: string
  protocolo: string
  colaborador_id: string
  planta_id: string
  solicitante_nome: string
  tipo: TipoMovimentacao
  data_abertura: string
  vigencia: string | null
  etapa_atual: EtapaMovimentacao
  status: StatusMovimentacao
  alteracao: DetalheAlteracao
  justificativa: string
  potencial: string | null
  checagens: ChecagemRegra[]
  rh_liberada_folha_em: Date | null
  apdata_gerado_em: Date | null
  employee_central_gerado_em: Date | null
}

interface DecisaoRow {
  movimentacao_id: string
  etapa: Exclude<EtapaMovimentacao, 'concluida'>
  decisao: Decisao
  comentario: string | null
  aprovador_perfil: PerfilDemo
  aprovador_nome: string
  data: Date
}

export async function listarMovimentacoes(q: Queryable, escopo: Escopo, ids: string[] | null = null) {
  const movs = await q.query<MovimentacaoRow>(
    `select id, protocolo, colaborador_id, planta_id, solicitante_nome, tipo, data_abertura, vigencia, etapa_atual,
            status, alteracao, justificativa, potencial, checagens, rh_liberada_folha_em, apdata_gerado_em, employee_central_gerado_em
       from movimentacoes
      where ($1::bigint[] is null or planta_id = any($1::bigint[]))
        and ($2::bigint[] is null or id = any($2::bigint[]))
      order by data_abertura desc, id desc`,
    [escopo, ids],
  )
  if (movs.rows.length === 0) return []
  const movIds = movs.rows.map((m) => m.id)
  const decisoes = await q.query<DecisaoRow>(
    `select movimentacao_id, etapa, decisao, comentario, aprovador_perfil, aprovador_nome, data
       from movimentacao_decisoes where movimentacao_id = any($1::bigint[]) order by data, id`,
    [movIds],
  )
  const docs = await q.query<{ id: string; movimentacao_id: string }>(
    `select id, movimentacao_id from movimentacao_documentos
      where movimentacao_id = any($1::bigint[]) order by criado_em, id`,
    [movIds],
  )
  const decisoesPorMov = new Map<string, DecisaoRow[]>()
  for (const d of decisoes.rows) {
    const lista = decisoesPorMov.get(d.movimentacao_id) ?? []
    lista.push(d)
    decisoesPorMov.set(d.movimentacao_id, lista)
  }
  const docsPorMov = new Map<string, string[]>()
  for (const d of docs.rows) {
    const lista = docsPorMov.get(d.movimentacao_id) ?? []
    lista.push(d.id)
    docsPorMov.set(d.movimentacao_id, lista)
  }
  return movs.rows.map((m) => ({
    id: m.id,
    protocolo: m.protocolo,
    colaboradorId: m.colaborador_id,
    tipo: m.tipo,
    plantaId: m.planta_id,
    solicitanteNome: m.solicitante_nome,
    dataAbertura: m.data_abertura,
    vigencia: m.vigencia ?? '',
    etapaAtual: m.etapa_atual,
    status: m.status,
    alteracao: m.alteracao,
    justificativa: m.justificativa,
    potencial: m.potencial,
    documentosIds: docsPorMov.get(m.id) ?? [],
    checagens: m.checagens,
    rhLiberadaFolhaEm: iso(m.rh_liberada_folha_em),
    decisoes: (decisoesPorMov.get(m.id) ?? []).map((d) => ({
      etapa: d.etapa,
      aprovadorPerfil: d.aprovador_perfil,
      aprovadorNome: d.aprovador_nome,
      decisao: d.decisao,
      comentario: d.comentario ?? undefined,
      data: d.data.toISOString(),
    })),
    arquivosGerados: {
      apdataGeradoEm: iso(m.apdata_gerado_em),
      employeeCentralGeradoEm: iso(m.employee_central_gerado_em),
    },
  }))
}

interface DocumentoRow {
  id: string
  movimentacao_id: string
  nome: string
  tipo: TipoDocumento
  mime: string
  tamanho_bytes: number
  sha256: string | null
  tem_conteudo: boolean
  autor_colaborador_id: string | null
  autor_nome: string
  criado_em: Date
}

export async function listarDocumentos(q: Queryable, escopo: Escopo, movIds: string[] | null = null) {
  const { rows } = await q.query<DocumentoRow>(
    `select d.id, d.movimentacao_id, d.nome, d.tipo, d.mime, d.tamanho_bytes, d.sha256,
            (d.conteudo is not null) as tem_conteudo, d.autor_colaborador_id, d.autor_nome, d.criado_em
       from movimentacao_documentos d join movimentacoes m on m.id = d.movimentacao_id
      where ($1::bigint[] is null or m.planta_id = any($1::bigint[]))
        and ($2::bigint[] is null or d.movimentacao_id = any($2::bigint[]))
      order by d.criado_em, d.id`,
    [escopo, movIds],
  )
  return rows.map((d) => ({
    id: d.id,
    movimentacaoId: d.movimentacao_id,
    nome: d.nome,
    tipo: d.tipo,
    tamanhoBytes: d.tamanho_bytes,
    autorId: d.autor_colaborador_id,
    autorNome: d.autor_nome,
    criadoEm: d.criado_em.toISOString(),
    mime: d.mime,
    sha256: d.sha256,
    temConteudo: d.tem_conteudo,
  }))
}

interface EventoRow {
  id: string
  movimentacao_id: string
  tipo: TipoEvento
  data: Date
  autor: string
  descricao: string
  comentario: string | null
}

export async function listarEventos(q: Queryable, escopo: Escopo, movIds: string[] | null = null) {
  const { rows } = await q.query<EventoRow>(
    `select e.id, e.movimentacao_id, e.tipo, e.data, e.autor, e.descricao, e.comentario
       from movimentacao_eventos e join movimentacoes m on m.id = e.movimentacao_id
      where ($1::bigint[] is null or m.planta_id = any($1::bigint[]))
        and ($2::bigint[] is null or e.movimentacao_id = any($2::bigint[]))
      order by e.data, e.id`,
    [escopo, movIds],
  )
  return rows.map((e) => ({
    id: e.id,
    movimentacaoId: e.movimentacao_id,
    tipo: e.tipo,
    data: e.data.toISOString(),
    autor: e.autor,
    descricao: e.descricao,
    comentario: e.comentario ?? undefined,
  }))
}

// ---------- Conciliação ----------

interface DivergenciaRow {
  id: string
  colaborador_id: string
  planta_id: string
  campo: CampoDivergente
  valor_apdata: string
  valor_employee_central: string
  responsavel_id: string | null
  status: StatusDivergencia
  detectada_em: Date
  resolvida_em: Date | null
  justificativa_resolucao: string | null
}

export function mapDivergencia(r: DivergenciaRow) {
  return {
    id: r.id,
    colaboradorId: r.colaborador_id,
    plantaId: r.planta_id,
    campo: r.campo,
    valorApdata: r.valor_apdata,
    valorEmployeeCentral: r.valor_employee_central,
    responsavelId: r.responsavel_id,
    status: r.status,
    detectadaEm: r.detectada_em.toISOString(),
    resolvidaEm: iso(r.resolvida_em),
    justificativaResolucao: r.justificativa_resolucao ?? undefined,
  }
}

const COLUNAS_DIVERGENCIA = `id, colaborador_id, planta_id, campo, valor_apdata, valor_employee_central, responsavel_id,
  status, detectada_em, resolvida_em, justificativa_resolucao`

export async function listarDivergencias(q: Queryable, escopo: Escopo) {
  const { rows } = await q.query<DivergenciaRow>(
    `select ${COLUNAS_DIVERGENCIA} from divergencias
      where ($1::bigint[] is null or planta_id = any($1::bigint[]))
      order by detectada_em desc, id desc`,
    [escopo],
  )
  return rows.map(mapDivergencia)
}

export async function buscarDivergencia(q: Queryable, id: string, paraAtualizar = false) {
  const { rows } = await q.query<DivergenciaRow>(
    `select ${COLUNAS_DIVERGENCIA} from divergencias where id = $1 ${paraAtualizar ? 'for update' : ''}`,
    [id],
  )
  return rows[0]
}

export async function ultimaConferencia(q: Queryable) {
  const { rows } = await q.query<{ finalizada_em: Date; registros_comparados: number }>(
    `select finalizada_em, registros_comparados from conciliacoes
      where status = 'concluida' order by finalizada_em desc, id desc limit 1`,
  )
  const r = rows[0]
  return r
    ? { executadaEm: r.finalizada_em.toISOString(), registrosComparados: r.registros_comparados }
    : { executadaEm: new Date(0).toISOString(), registrosComparados: 0 }
}

// ---------- Logs ----------

interface LogRow {
  id: string
  data: Date
  acao: string
  categoria: CategoriaLog
  status: 'sucesso' | 'erro'
  duracao_ms: number
  detalhe: string
  erro: string | null
}

export function mapLog(r: LogRow) {
  return {
    id: r.id,
    data: r.data.toISOString(),
    acao: r.acao,
    categoria: r.categoria,
    status: r.status,
    duracaoMs: r.duracao_ms,
    detalhe: r.detalhe,
    erro: r.erro ?? undefined,
  }
}

/** RH Central e Auditoria veem todos os logs; os demais, apenas os próprios. */
export async function listarLogs(q: Queryable, usuario: UsuarioAutenticado, limite = 300) {
  const veTodos = usuario.perfil === 'rh_central' || usuario.perfil === 'auditoria'
  const { rows } = await q.query<LogRow>(
    `select id, data, acao, categoria, status, duracao_ms, detalhe, erro from logs_integracao
      where ($1::boolean or usuario_id = $2::bigint)
      order by data desc, id desc limit $3`,
    [veTodos, usuario.id, limite],
  )
  return rows.map(mapLog)
}
