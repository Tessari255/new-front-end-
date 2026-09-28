import type pg from 'pg'
import { withTransaction, type Queryable } from '../db/pool.ts'
import { listarDocumentos, listarEventos, listarMovimentacoes } from '../db/queries.ts'
import {
  exigirEscrita,
  podeDecidirEtapa,
  temAcessoAPlanta,
  type UsuarioAutenticado,
} from '../auth.ts'
import { conflito, naoEncontrado, proibido, regraDeNegocio } from '../errors.ts'
import { etapaInicial, transicaoDaDecisao } from '../domain/fluxo.ts'
import {
  avaliarMovimentacao,
  idsReferenciados,
  MIN_COMENTARIO_DECISAO,
  montarAlteracao,
  propostaDeAlteracao,
  vigenciaValida,
  type CargoCtx,
  type ColaboradorCtx,
  type ContextoAvaliacao,
} from '../domain/rules.ts'
import type {
  ChecagemRegra,
  Decisao,
  DetalheAlteracao,
  EtapaMovimentacao,
  PropostaAlteracao,
  StatusMovimentacao,
  TipoDocumento,
  TipoEvento,
  TipoMovimentacao,
} from '../types.ts'

export interface CorpoMovimentacao {
  colaboradorId: string
  tipo: TipoMovimentacao
  vigencia?: string | null
  justificativa?: string | null
  alteracao?: Omit<PropostaAlteracao, 'tipo'> & { tipo?: TipoMovimentacao }
  potencial?: 'baixo' | 'estavel' | 'alto' | null
}

interface MovRow {
  id: string
  protocolo: string
  colaborador_id: string
  planta_id: string
  tipo: TipoMovimentacao
  status: StatusMovimentacao
  etapa_atual: EtapaMovimentacao
  vigencia: string | null
  justificativa: string
  alteracao: DetalheAlteracao
}

const idValido = (v: string | null | undefined): v is string => !!v && /^\d{1,18}$/.test(v)

function normalizarProposta(tipo: TipoMovimentacao, a: CorpoMovimentacao['alteracao']): PropostaAlteracao {
  const id = (v: string | null | undefined) => (idValido(v) ? v : null)
  return {
    tipo,
    gestorPropostoId: id(a?.gestorPropostoId),
    cargoPropostoId: id(a?.cargoPropostoId),
    salarioProposto: typeof a?.salarioProposto === 'number' ? a.salarioProposto : null,
    folhaPropostaId: id(a?.folhaPropostaId),
    horarioPropostoId: id(a?.horarioPropostoId),
    centroCustoPropostoId: id(a?.centroCustoPropostoId),
    plantaPropostaId: id(a?.plantaPropostaId),
    tipoMaoDeObraProposto: a?.tipoMaoDeObraProposto === 'direta' || a?.tipoMaoDeObraProposto === 'indireta' ? a.tipoMaoDeObraProposto : null,
    areaPropostaId: id(a?.areaPropostaId),
  }
}

async function carregarColaboradorCtx(q: Queryable, id: string): Promise<ColaboradorCtx | undefined> {
  if (!idValido(id)) return undefined
  const { rows } = await q.query(
    `select id, nome, status, planta_id, cargo_id, area_id, centro_custo_id, folha_id, horario_id, gestor_id, salario, tipo_mao_de_obra
       from colaboradores where id = $1`,
    [id],
  )
  const r = rows[0]
  if (!r) return undefined
  return {
    id: r.id,
    nome: r.nome,
    status: r.status,
    plantaId: r.planta_id,
    cargoId: r.cargo_id,
    areaId: r.area_id,
    centroCustoId: r.centro_custo_id,
    folhaId: r.folha_id,
    horarioId: r.horario_id,
    gestorId: r.gestor_id,
    salario: r.salario,
    tipoMaoDeObra: r.tipo_mao_de_obra,
  }
}

async function carregarCargoCtx(q: Queryable, id: string | null): Promise<CargoCtx | null> {
  if (!idValido(id)) return null
  const { rows } = await q.query(
    `select c.id, c.salario_min, c.salario_max,
            coalesce(array_agg(cp.planta_id::text) filter (where cp.planta_id is not null), '{}') as plantas
       from cargos c left join cargo_plantas cp on cp.cargo_id = c.id where c.id = $1 group by c.id`,
    [id],
  )
  const r = rows[0]
  return r ? { id: r.id, salarioMin: r.salario_min, salarioMax: r.salario_max, plantasPermitidas: r.plantas } : null
}

async function carregarContexto(
  q: Queryable,
  colaborador: ColaboradorCtx,
  alteracao: DetalheAlteracao,
  movId: string | null,
): Promise<ContextoAvaliacao> {
  const refs = idsReferenciados(alteracao)
  const vazio = { rows: [] as Record<string, any>[] }
  // Sequencial: um PoolClient não aceita queries concorrentes.
  const gestor = idValido(refs.gestorId)
    ? await q.query(`select id, status, is_gestor from colaboradores where id = $1`, [refs.gestorId])
    : vazio
  const cargoProposto = await carregarCargoCtx(q, refs.cargoId)
  const cargoAtual = await carregarCargoCtx(q, colaborador.cargoId)
  const cc = idValido(refs.centroCustoId)
    ? await q.query(`select id, planta_id from centros_custo where id = $1`, [refs.centroCustoId])
    : vazio
  const folha = idValido(refs.folhaId) ? await q.query(`select 1 from folhas where id = $1`, [refs.folhaId]) : vazio
  const horario = idValido(refs.horarioId) ? await q.query(`select 1 from horarios where id = $1`, [refs.horarioId]) : vazio
  const planta = idValido(refs.plantaId) ? await q.query(`select 1 from plantas where id = $1`, [refs.plantaId]) : vazio
  const area = idValido(refs.areaId) ? await q.query(`select 1 from areas where id = $1`, [refs.areaId]) : vazio
  const evid = movId
    ? await q.query(`select exists(select 1 from movimentacao_documentos where movimentacao_id = $1) as tem`, [movId])
    : { rows: [{ tem: false }] }
  const g = gestor.rows[0]
  const c = cc.rows[0]
  return {
    colaborador,
    gestorProposto: g ? { id: g.id, status: g.status, isGestor: g.is_gestor } : null,
    cargoProposto,
    cargoAtual,
    centroCustoProposto: c ? { id: c.id, plantaId: c.planta_id } : null,
    folhaPropostaExiste: folha.rows.length > 0,
    horarioPropostoExiste: horario.rows.length > 0,
    plantaPropostaExiste: planta.rows.length > 0,
    areaPropostaExiste: area.rows.length > 0,
    temEvidencia: Boolean(evid.rows[0]?.tem),
  }
}

async function registrarEvento(
  q: Queryable,
  movId: string,
  tipo: TipoEvento,
  autor: UsuarioAutenticado | null,
  descricao: string,
  comentario?: string | null,
) {
  await q.query(
    `insert into movimentacao_eventos (movimentacao_id, tipo, autor, autor_id, descricao, comentario)
     values ($1, $2, $3, $4, $5, $6)`,
    [movId, tipo, autor?.nome ?? 'Sistema', autor?.id ?? null, descricao, comentario ?? null],
  )
}

async function travarMovimentacao(client: pg.PoolClient, usuario: UsuarioAutenticado, id: string): Promise<MovRow> {
  if (!idValido(id)) throw naoEncontrado('Movimentação não encontrada.')
  const { rows } = await client.query<MovRow>(
    `select id, protocolo, colaborador_id, planta_id, tipo, status, etapa_atual, vigencia, justificativa, alteracao
       from movimentacoes where id = $1 for update`,
    [id],
  )
  const mov = rows[0]
  if (!mov || !temAcessoAPlanta(usuario, mov.planta_id)) throw naoEncontrado('Movimentação não encontrada.')
  return mov
}

/** Recalcula valores atuais e checagens a partir do estado corrente do banco. */
async function reavaliar(client: pg.PoolClient, mov: MovRow, colaborador: ColaboradorCtx) {
  const alteracao = montarAlteracao(propostaDeAlteracao(mov.alteracao), colaborador)
  const ctx = await carregarContexto(client, colaborador, alteracao, mov.id)
  const av = avaliarMovimentacao(mov.tipo, alteracao, mov.vigencia ?? '', mov.justificativa, ctx)
  return { alteracao, ...av }
}

export async function recursoCanonico(q: Queryable, usuario: UsuarioAutenticado, id: string) {
  const [movs, documentos, historico] = await Promise.all([
    listarMovimentacoes(q, usuario.plantasAutorizadas, [id]),
    listarDocumentos(q, usuario.plantasAutorizadas, [id]),
    listarEventos(q, usuario.plantasAutorizadas, [id]),
  ])
  const movimentacao = movs[0]
  if (!movimentacao) throw naoEncontrado('Movimentação não encontrada.')
  return { movimentacao, documentos, historico }
}

// ---------- Criar / editar rascunho ----------

export async function criarRascunho(pool: pg.Pool, usuario: UsuarioAutenticado, corpo: CorpoMovimentacao): Promise<{ id: string; protocolo: string }> {
  exigirEscrita(usuario)
  return withTransaction(pool, async (client) => {
    const colaborador = await carregarColaboradorCtx(client, corpo.colaboradorId)
    if (!colaborador || !temAcessoAPlanta(usuario, colaborador.plantaId)) throw naoEncontrado('Colaborador não encontrado.')

    const alteracao = montarAlteracao(normalizarProposta(corpo.tipo, corpo.alteracao), colaborador)
    const vigencia = vigenciaValida(corpo.vigencia) ? corpo.vigencia! : null
    const justificativa = (corpo.justificativa ?? '').trim()
    const ctx = await carregarContexto(client, colaborador, alteracao, null)
    const { checagens } = avaliarMovimentacao(corpo.tipo, alteracao, vigencia ?? '', justificativa, ctx)
    const potencial = corpo.potencial ?? null

    // Etapa do rascunho é só um valor cosmético (nada pendente até o envio); o valor definitivo
    // é recalculado por etapaInicial() em enviarParaAprovacao, sempre a partir do estado atual.
    const { rows } = await client.query<{ id: string; protocolo: string }>(
      `insert into movimentacoes (colaborador_id, planta_id, solicitante_id, solicitante_nome, tipo, vigencia,
                                  etapa_atual, status, alteracao, justificativa, checagens, potencial)
       values ($1, $2, $3, $4, $5, $6, 'gestor', 'rascunho', $7, $8, $9, $10)
       returning id, protocolo`,
      [colaborador.id, colaborador.plantaId, usuario.id, usuario.nome, corpo.tipo, vigencia, JSON.stringify(alteracao), justificativa, JSON.stringify(checagens), potencial],
    )
    const mov = rows[0]!
    await registrarEvento(client, mov.id, 'abertura', usuario, `Rascunho ${mov.protocolo} criado.`)
    return { id: mov.id, protocolo: mov.protocolo }
  })
}

export async function atualizarRascunho(
  pool: pg.Pool,
  usuario: UsuarioAutenticado,
  id: string,
  corpo: CorpoMovimentacao,
): Promise<void> {
  exigirEscrita(usuario)
  await withTransaction(pool, async (client) => {
    const mov = await travarMovimentacao(client, usuario, id)
    if (mov.status !== 'rascunho' && mov.status !== 'devolvida') {
      throw conflito('Somente rascunhos ou solicitações devolvidas podem ser editados.')
    }
    const colaborador = await carregarColaboradorCtx(client, corpo.colaboradorId)
    if (!colaborador || !temAcessoAPlanta(usuario, colaborador.plantaId)) throw naoEncontrado('Colaborador não encontrado.')

    const alteracao = montarAlteracao(normalizarProposta(corpo.tipo, corpo.alteracao), colaborador)
    const vigencia = vigenciaValida(corpo.vigencia) ? corpo.vigencia! : null
    const justificativa = (corpo.justificativa ?? '').trim()
    const ctx = await carregarContexto(client, colaborador, alteracao, mov.id)
    const { checagens } = avaliarMovimentacao(corpo.tipo, alteracao, vigencia ?? '', justificativa, ctx)
    const potencial = corpo.potencial ?? null

    await client.query(
      `update movimentacoes
          set colaborador_id = $2, planta_id = $3, tipo = $4, vigencia = $5, justificativa = $6,
              alteracao = $7, checagens = $8, potencial = $9, updated_at = now()
        where id = $1`,
      [mov.id, colaborador.id, colaborador.plantaId, corpo.tipo, vigencia, justificativa, JSON.stringify(alteracao), JSON.stringify(checagens), potencial],
    )
    await registrarEvento(client, mov.id, 'edicao', usuario, 'Rascunho atualizado.')
  })
}

// ---------- Envio para aprovação ----------

export async function enviarParaAprovacao(pool: pg.Pool, usuario: UsuarioAutenticado, id: string): Promise<{ protocolo: string; etapaAtual: Exclude<EtapaMovimentacao, 'concluida'> }> {
  exigirEscrita(usuario)
  return withTransaction(pool, async (client) => {
    const mov = await travarMovimentacao(client, usuario, id)
    if (mov.status !== 'rascunho' && mov.status !== 'devolvida') {
      throw conflito('Somente rascunhos ou solicitações devolvidas podem ser enviados para aprovação.')
    }
    const colaborador = await carregarColaboradorCtx(client, mov.colaborador_id)
    if (!colaborador) throw naoEncontrado('Colaborador não encontrado.')

    const { alteracao, checagens, fieldErrors, podeEnviar } = await reavaliar(client, mov, colaborador)
    if (!podeEnviar) {
      const naoAtendidas = checagens.filter((c: ChecagemRegra) => !c.atendida && c.severidade === 'bloqueante').map((c) => c.descricao)
      throw regraDeNegocio(
        'MOVIMENTACAO_INVALIDA',
        'A movimentação não atende às regras exigidas para envio.',
        { ...fieldErrors, ...(naoAtendidas.length ? { checagens: naoAtendidas.join('; ') } : {}) },
      )
    }
    const reenvio = mov.status === 'devolvida'
    const etapa = etapaInicial(colaborador.gestorId, usuario.colaboradorId)
    await client.query(
      `update movimentacoes
          set status = 'em_andamento', etapa_atual = $2, alteracao = $3, checagens = $4, updated_at = now()
        where id = $1`,
      [mov.id, etapa, JSON.stringify(alteracao), JSON.stringify(checagens)],
    )
    const rotuloEtapa = etapa === 'gestor' ? 'Gestor' : 'RH Local'
    await registrarEvento(
      client,
      mov.id,
      'validacao',
      usuario,
      reenvio
        ? `Solicitação corrigida e reenviada para aprovação — etapa ${rotuloEtapa}.`
        : `Rascunho enviado para aprovação — etapa ${rotuloEtapa}.`,
    )
    return { protocolo: mov.protocolo, etapaAtual: etapa }
  })
}

// ---------- Decisão de etapa ----------

export async function decidirEtapa(
  pool: pg.Pool,
  usuario: UsuarioAutenticado,
  id: string,
  corpo: { decisao: Decisao; comentario?: string | null },
): Promise<{ protocolo: string; decisao: Decisao }> {
  // Leitura prévia (sem lock) apenas para responder 404/409/403 antes de abrir a transação.
  const pre = idValido(id)
    ? (
        await pool.query(
          `select m.planta_id, m.etapa_atual, m.status, c.gestor_id
             from movimentacoes m join colaboradores c on c.id = m.colaborador_id where m.id = $1`,
          [id],
        )
      ).rows[0]
    : undefined
  if (!pre || !temAcessoAPlanta(usuario, pre.planta_id)) throw naoEncontrado('Movimentação não encontrada.')
  if (pre.status !== 'em_andamento' || pre.etapa_atual === 'concluida') {
    throw conflito('A solicitação não está aguardando decisão.')
  }
  const etapaLida = pre.etapa_atual as Exclude<EtapaMovimentacao, 'concluida'>
  if (!podeDecidirEtapa(usuario, etapaLida, { plantaId: pre.planta_id, colaboradorGestorId: pre.gestor_id })) {
    throw proibido('Seu perfil não pode decidir a etapa atual desta solicitação.')
  }
  const comentario = corpo.comentario?.trim() || null
  if (corpo.decisao !== 'aprovado' && (comentario ?? '').length < MIN_COMENTARIO_DECISAO) {
    throw regraDeNegocio('COMENTARIO_OBRIGATORIO', `Descreva o motivo com pelo menos ${MIN_COMENTARIO_DECISAO} caracteres.`, {
      comentario: `Descreva o motivo com pelo menos ${MIN_COMENTARIO_DECISAO} caracteres.`,
    })
  }

  return withTransaction(pool, async (client) => {
    const mov = await travarMovimentacao(client, usuario, id)
    // Revalida sob lock: uma decisão concorrente pode ter avançado a etapa.
    if (mov.status !== 'em_andamento' || mov.etapa_atual !== etapaLida) {
      throw conflito('A solicitação já foi decidida ou mudou de etapa. Atualize a página e tente novamente.')
    }
    const t = transicaoDaDecisao(etapaLida, corpo.decisao)

    await client.query(
      `insert into movimentacao_decisoes (movimentacao_id, etapa, decisao, comentario, aprovador_perfil, aprovador_nome, aprovador_id)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [mov.id, etapaLida, corpo.decisao, comentario, usuario.perfil, usuario.nome, usuario.id],
    )
    await client.query(
      `update movimentacoes set status = $2, etapa_atual = $3, updated_at = now() where id = $1`,
      [mov.id, t.novoStatus, t.novaEtapa],
    )
    const sufixo =
      corpo.decisao === 'aprovado'
        ? t.novoStatus === 'aprovada'
          ? ' — fluxo concluído.'
          : '.'
        : corpo.decisao === 'devolvido'
          ? ' para ajustes.'
          : '.'
    await registrarEvento(client, mov.id, t.tipoEvento, usuario, `${usuario.nome} ${t.verbo} a solicitação${sufixo}`, comentario)
    if (t.novoStatus === 'aprovada') {
      await registrarEvento(client, mov.id, 'conclusao', null, 'Solicitação aprovada — pronta para processamento.')
    }
    return { protocolo: mov.protocolo, decisao: corpo.decisao }
  })
}

// ---------- Documentos ----------

export interface ArquivoValidado {
  nome: string
  tipo: TipoDocumento
  mime: string
  conteudo: Buffer
  sha256: string
}

export async function anexarDocumento(
  pool: pg.Pool,
  usuario: UsuarioAutenticado,
  movId: string,
  arquivo: ArquivoValidado,
): Promise<{ protocolo: string; nome: string }> {
  exigirEscrita(usuario)
  return withTransaction(pool, async (client) => {
    const mov = await travarMovimentacao(client, usuario, movId)
    await client.query(
      `insert into movimentacao_documentos
         (movimentacao_id, nome, tipo, mime, tamanho_bytes, sha256, conteudo, autor_usuario_id, autor_colaborador_id, autor_nome)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [mov.id, arquivo.nome, arquivo.tipo, arquivo.mime, arquivo.conteudo.length, arquivo.sha256, arquivo.conteudo, usuario.id, usuario.colaboradorId, usuario.nome],
    )
    await registrarEvento(client, mov.id, 'anexo', usuario, `Documento "${arquivo.nome}" anexado.`)
    if (mov.status === 'rascunho' || mov.status === 'devolvida') {
      const colaborador = await carregarColaboradorCtx(client, mov.colaborador_id)
      if (colaborador) {
        const { alteracao, checagens } = await reavaliar(client, mov, colaborador)
        await client.query(`update movimentacoes set alteracao = $2, checagens = $3, updated_at = now() where id = $1`, [
          mov.id,
          JSON.stringify(alteracao),
          JSON.stringify(checagens),
        ])
      }
    }
    return { protocolo: mov.protocolo, nome: arquivo.nome }
  })
}

export async function buscarDocumentoParaDownload(pool: pg.Pool, usuario: UsuarioAutenticado, id: string) {
  if (!idValido(id)) throw naoEncontrado('Documento não encontrado.')
  const { rows } = await pool.query(
    `select d.nome, d.mime, d.conteudo, m.planta_id
       from movimentacao_documentos d join movimentacoes m on m.id = d.movimentacao_id where d.id = $1`,
    [id],
  )
  const d = rows[0]
  if (!d || !temAcessoAPlanta(usuario, d.planta_id)) throw naoEncontrado('Documento não encontrado.')
  if (!d.conteudo) throw naoEncontrado('Este documento de demonstração possui apenas metadados, sem arquivo armazenado.')
  return { nome: d.nome as string, mime: d.mime as string, conteudo: d.conteudo as Buffer }
}
