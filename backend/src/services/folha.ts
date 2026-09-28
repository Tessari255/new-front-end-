import type pg from 'pg'
import { withTransaction, type Queryable } from '../db/pool.ts'
import { exigirPerfil, temAcessoAPlanta, type UsuarioAutenticado } from '../auth.ts'
import { conflito, naoEncontrado } from '../errors.ts'
import { primeiroDiaDoMes } from '../domain/folha.ts'

export interface EstadoFolha {
  mesTravado: string | null
  travadoEm: string | null
  travadoPorNome: string | null
}

export async function obterFechamento(q: Queryable): Promise<EstadoFolha> {
  const { rows } = await q.query(
    `select f.mes_travado, f.travado_em, u.nome as travado_por_nome
       from folha_fechamento f left join usuarios u on u.id = f.travado_por_id
      where f.id = 1`,
  )
  const r = rows[0]
  return {
    mesTravado: r?.mes_travado ?? null,
    travadoEm: r?.travado_em ? new Date(r.travado_em).toISOString() : null,
    travadoPorNome: r?.travado_por_nome ?? null,
  }
}

async function registrarEventoFolha(q: Queryable, acao: 'travar' | 'liberar', mes: string, usuario: UsuarioAutenticado) {
  await q.query(
    `insert into folha_fechamento_eventos (acao, mes, usuario_id, usuario_nome) values ($1, $2, $3, $4)`,
    [acao, mes, usuario.id, usuario.nome],
  )
}

export async function travarFolha(pool: pg.Pool, usuario: UsuarioAutenticado, mes: string): Promise<EstadoFolha> {
  exigirPerfil(usuario, 'share')
  const mesNormalizado = primeiroDiaDoMes(mes)
  return withTransaction(pool, async (client) => {
    const { rows } = await client.query('select mes_travado from folha_fechamento where id = 1 for update')
    if (rows[0]?.mes_travado) throw conflito('A folha já está travada. Libere antes de travar outro mês.', 'FOLHA_JA_TRAVADA')
    await client.query(
      `update folha_fechamento set mes_travado = $1, travado_em = now(), travado_por_id = $2, updated_at = now() where id = 1`,
      [mesNormalizado, usuario.id],
    )
    await registrarEventoFolha(client, 'travar', mesNormalizado, usuario)
    return obterFechamento(client)
  })
}

export async function liberarFolha(pool: pg.Pool, usuario: UsuarioAutenticado): Promise<EstadoFolha> {
  exigirPerfil(usuario, 'share')
  return withTransaction(pool, async (client) => {
    const { rows } = await client.query('select mes_travado from folha_fechamento where id = 1 for update')
    const mesAtual = rows[0]?.mes_travado
    if (!mesAtual) throw conflito('A folha já está liberada.', 'FOLHA_JA_LIBERADA')
    await client.query(`update folha_fechamento set mes_travado = null, travado_em = null, travado_por_id = null, updated_at = now() where id = 1`)
    await registrarEventoFolha(client, 'liberar', mesAtual, usuario)
    return obterFechamento(client)
  })
}

/**
 * Liberação do RH para entrada na Folha: gate distinto da aprovação de fluxo (rh_central já
 * aprovou a etapa final), exigido antes de gerar os arquivos demonstrativos de saída.
 */
export async function liberarMovimentacaoParaFolha(pool: pg.Pool, usuario: UsuarioAutenticado, id: string) {
  exigirPerfil(usuario, 'rh_central')
  if (!/^\d{1,18}$/.test(id)) throw naoEncontrado('Movimentação não encontrada.')
  return withTransaction(pool, async (client) => {
    const { rows } = await client.query(
      `select id, protocolo, planta_id, status, rh_liberada_folha_em from movimentacoes where id = $1 for update`,
      [id],
    )
    const mov = rows[0]
    if (!mov || !temAcessoAPlanta(usuario, mov.planta_id)) throw naoEncontrado('Movimentação não encontrada.')
    if (mov.status !== 'aprovada') throw conflito('Somente movimentações aprovadas podem ser liberadas para a Folha.', 'MOVIMENTACAO_NAO_APROVADA')
    if (mov.rh_liberada_folha_em) throw conflito('Esta movimentação já foi liberada para a Folha.', 'JA_LIBERADA_PARA_FOLHA')
    await client.query(
      `update movimentacoes set rh_liberada_folha_em = now(), rh_liberada_folha_por_id = $2, updated_at = now() where id = $1`,
      [mov.id, usuario.id],
    )
    await client.query(
      `insert into movimentacao_eventos (movimentacao_id, tipo, autor, autor_id, descricao)
       values ($1, 'aprovacao', $2, $3, $4)`,
      [mov.id, usuario.nome, usuario.id, `${usuario.nome} liberou ${mov.protocolo} para entrada na Folha.`],
    )
    return { protocolo: mov.protocolo as string }
  })
}
