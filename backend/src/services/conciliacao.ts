import type pg from 'pg'
import { withTransaction } from '../db/pool.ts'
import { buscarColaborador, buscarDivergencia, mapDivergencia } from '../db/queries.ts'
import { temAcessoAPlanta, type UsuarioAutenticado } from '../auth.ts'
import { conflito, naoEncontrado, regraDeNegocio } from '../errors.ts'
import { MIN_JUSTIFICATIVA_RESOLUCAO } from '../domain/rules.ts'
import type { CampoDivergente } from '../types.ts'

const CAMPOS: CampoDivergente[] = ['gestor', 'cargo', 'centro_custo', 'area']
const LOCK_CONCILIACAO = 'nexo_conciliacao'

const idValido = (v: string) => /^\d{1,18}$/.test(v)

/** Normaliza para comparação: sem acentos, espaços colapsados, caixa baixa. */
export function normalizarValor(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export interface ResultadoConciliacao {
  conciliacaoId: string
  registrosComparados: number
  divergenciasCriadas: number
  divergenciasAtualizadas: number
}

interface FonteRow {
  colaborador_id: string
  planta_id: string
  a_gestor: string
  a_cargo: string
  a_centro_custo: string
  a_area: string
  e_gestor: string
  e_cargo: string
  e_centro_custo: string
  e_area: string
}

/**
 * Compara os snapshots normalizados de Apdata e Employee Central (gestor, cargo, centro de custo, área).
 * Idempotente: nunca duplica uma divergência ainda não resolvida (índice único parcial no banco)
 * e uma única execução roda por vez (advisory lock).
 */
export async function executarConciliacao(
  pool: pg.Pool,
  opts: { origem: 'manual' | 'agendada'; usuarioId?: string | null; plantasAutorizadas?: string[] | null },
): Promise<ResultadoConciliacao> {
  const lockClient = await pool.connect()
  try {
    const { rows: lock } = await lockClient.query<{ ok: boolean }>(`select pg_try_advisory_lock(hashtext($1)) as ok`, [LOCK_CONCILIACAO])
    if (!lock[0]?.ok) throw conflito('Já existe uma conferência em execução.', 'CONCILIACAO_EM_EXECUCAO')

    const { rows: criada } = await pool.query<{ id: string }>(
      `insert into conciliacoes (origem, status, executado_por) values ($1, 'em_execucao', $2) returning id`,
      [opts.origem, opts.usuarioId ?? null],
    )
    const conciliacaoId = criada[0]!.id
    try {
      const resultado = await withTransaction(pool, async (client) => {
        const { rows } = await client.query<FonteRow>(
          `select c.id as colaborador_id, c.planta_id,
                  a.gestor as a_gestor, a.cargo as a_cargo, a.centro_custo as a_centro_custo, a.area as a_area,
                  e.gestor as e_gestor, e.cargo as e_cargo, e.centro_custo as e_centro_custo, e.area as e_area
              from colaboradores c
              join colaborador_fontes a on a.colaborador_id = c.id and a.fonte = 'apdata'
              join colaborador_fontes e on e.colaborador_id = c.id and e.fonte = 'employee_central'
             where ($1::bigint[] is null or c.planta_id = any($1::bigint[]))
             order by c.id`,
            [opts.plantasAutorizadas ?? null],
          )
        let criadas = 0
        let atualizadas = 0
        for (const r of rows) {
          const valores: Record<CampoDivergente, [string, string]> = {
            gestor: [r.a_gestor, r.e_gestor],
            cargo: [r.a_cargo, r.e_cargo],
            centro_custo: [r.a_centro_custo, r.e_centro_custo],
            area: [r.a_area, r.e_area],
          }
          for (const campo of CAMPOS) {
            const [va, ve] = valores[campo]
            if (normalizarValor(va) === normalizarValor(ve)) continue

            const aberta = await client.query(
              `select id, valor_apdata, valor_employee_central from divergencias
                where colaborador_id = $1 and campo = $2 and status <> 'resolvida' for update`,
              [r.colaborador_id, campo],
            )
            if (aberta.rows[0]) {
              const d = aberta.rows[0]
              if (d.valor_apdata !== va || d.valor_employee_central !== ve) {
                await client.query(
                  `update divergencias set valor_apdata = $2, valor_employee_central = $3, updated_at = now() where id = $1`,
                  [d.id, va, ve],
                )
                atualizadas += 1
              }
              continue
            }
            // Mesma diferença já resolvida antes e ainda presente: reabre em vez de duplicar.
            const reaberta = await client.query(
              `update divergencias
                  set status = 'aberta', resolvida_em = null, justificativa_resolucao = null,
                      detectada_em = clock_timestamp(), conciliacao_id = $4, updated_at = now()
                where id = (select id from divergencias
                             where colaborador_id = $1 and campo = $2 and status = 'resolvida'
                               and valor_apdata = $3 and valor_employee_central = $5
                             order by resolvida_em desc, id desc limit 1)
                returning id`,
              [r.colaborador_id, campo, va, conciliacaoId, ve],
            )
            if (reaberta.rows[0]) {
              atualizadas += 1
              continue
            }
            await client.query(
              `insert into divergencias (colaborador_id, planta_id, campo, valor_apdata, valor_employee_central, status, detectada_em, conciliacao_id)
               values ($1, $2, $3, $4, $5, 'aberta', clock_timestamp(), $6)`,
              [r.colaborador_id, r.planta_id, campo, va, ve, conciliacaoId],
            )
            criadas += 1
          }
        }
        // Mantém o status de sincronização coerente com as divergências pendentes.
        await client.query(
          `update colaboradores c
              set status_sincronizacao = case when exists (
                    select 1 from divergencias d where d.colaborador_id = c.id and d.status <> 'resolvida')
                  then 'divergente' else 'sincronizado' end,
                  updated_at = now()
            where c.id = any($1::bigint[])
              and c.status_sincronizacao <> case when exists (
                    select 1 from divergencias d where d.colaborador_id = c.id and d.status <> 'resolvida')
                  then 'divergente' else 'sincronizado' end`,
          [rows.map((r) => r.colaborador_id)],
        )
        const registros = rows.length * CAMPOS.length
        await client.query(
          `update conciliacoes
              set status = 'concluida', finalizada_em = clock_timestamp(), registros_comparados = $2,
                  divergencias_criadas = $3, divergencias_atualizadas = $4
            where id = $1`,
          [conciliacaoId, registros, criadas, atualizadas],
        )
        return { registrosComparados: registros, divergenciasCriadas: criadas, divergenciasAtualizadas: atualizadas }
      })
      return { conciliacaoId, ...resultado }
    } catch (err) {
      await pool
        .query(`update conciliacoes set status = 'erro', finalizada_em = clock_timestamp(), erro = $2 where id = $1`, [
          conciliacaoId,
          err instanceof Error ? err.message.slice(0, 500) : 'erro desconhecido',
        ])
        .catch(() => undefined)
      throw err
    }
  } finally {
    await lockClient.query(`select pg_advisory_unlock(hashtext($1))`, [LOCK_CONCILIACAO]).catch(() => undefined)
    lockClient.release()
  }
}

async function recalcularSincronizacao(client: pg.PoolClient, colaboradorId: string) {
  await client.query(
    `update colaboradores c
        set status_sincronizacao = case when exists (
              select 1 from divergencias d where d.colaborador_id = c.id and d.status <> 'resolvida')
            then 'divergente' else 'sincronizado' end,
            updated_at = now()
      where c.id = $1`,
    [colaboradorId],
  )
}

export async function atribuirResponsavel(pool: pg.Pool, usuario: UsuarioAutenticado, id: string, responsavelId: string) {
  return withTransaction(pool, async (client) => {
    const div = idValido(id) ? await buscarDivergencia(client, id, true) : undefined
    if (!div || !temAcessoAPlanta(usuario, div.planta_id)) throw naoEncontrado('Divergência não encontrada.')
    if (div.status === 'resolvida') throw conflito('A divergência já foi resolvida.')

    const { rows } = await client.query(
      `select c.id from colaboradores c join areas a on a.id = c.area_id
        where c.id = $1 and c.status = 'ativo' and a.nome = 'Recursos Humanos'`,
      [responsavelId],
    )
    if (!rows[0]) {
      throw regraDeNegocio('RESPONSAVEL_INVALIDO', 'O responsável deve ser um colaborador ativo de Recursos Humanos.', {
        responsavelId: 'Selecione um colaborador ativo de Recursos Humanos.',
      })
    }
    await client.query(
      `update divergencias
          set responsavel_id = $2, status = case when status = 'aberta' then 'em_tratamento' else status end, updated_at = now()
        where id = $1`,
      [id, responsavelId],
    )
    return { colaboradorId: div.colaborador_id }
  })
}

export async function resolverDivergencia(pool: pg.Pool, usuario: UsuarioAutenticado, id: string, justificativa: string) {
  return withTransaction(pool, async (client) => {
    const div = idValido(id) ? await buscarDivergencia(client, id, true) : undefined
    if (!div || !temAcessoAPlanta(usuario, div.planta_id)) throw naoEncontrado('Divergência não encontrada.')
    if (div.status === 'resolvida') throw conflito('A divergência já foi resolvida.')
    const texto = justificativa.trim()
    if (texto.length < MIN_JUSTIFICATIVA_RESOLUCAO) {
      throw regraDeNegocio('JUSTIFICATIVA_OBRIGATORIA', `Descreva a justificativa com pelo menos ${MIN_JUSTIFICATIVA_RESOLUCAO} caracteres.`, {
        justificativa: `Descreva a justificativa com pelo menos ${MIN_JUSTIFICATIVA_RESOLUCAO} caracteres.`,
      })
    }
    await client.query(
      `update divergencias set status = 'resolvida', resolvida_em = now(), justificativa_resolucao = $2, updated_at = now() where id = $1`,
      [id, texto],
    )
    await recalcularSincronizacao(client, div.colaborador_id)
    return { colaboradorId: div.colaborador_id }
  })
}

export async function recursoDivergencia(pool: pg.Pool, usuario: UsuarioAutenticado, id: string) {
  const row = await buscarDivergencia(pool, id)
  if (!row || !temAcessoAPlanta(usuario, row.planta_id)) throw naoEncontrado('Divergência não encontrada.')
  const colaborador = await buscarColaborador(pool, row.colaborador_id)
  return { divergencia: mapDivergencia(row), colaborador: colaborador! }
}
