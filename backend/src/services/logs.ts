import type { FastifyRequest } from 'fastify'
import type { Queryable } from '../db/pool.ts'
import { mapLog } from '../db/queries.ts'
import { AppError } from '../errors.ts'
import type { UsuarioAutenticado } from '../auth.ts'
import type { CategoriaLog } from '../types.ts'

export interface NovoLog {
  categoria: CategoriaLog
  acao: string
  status: 'sucesso' | 'erro'
  duracaoMs: number
  detalhe: string
  erro?: string
  correlationId?: string
  usuarioId?: string | null
}

export async function inserirLog(q: Queryable, log: NovoLog) {
  const { rows } = await q.query(
    `insert into logs_integracao (acao, categoria, status, duracao_ms, detalhe, erro, correlation_id, usuario_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, data, acao, categoria, status, duracao_ms, detalhe, erro`,
    [log.acao, log.categoria, log.status, Math.max(0, Math.round(log.duracaoMs)), log.detalhe, log.erro ?? null, log.correlationId ?? null, log.usuarioId ?? null],
  )
  return mapLog(rows[0])
}

/**
 * Executa um caso de uso e registra o resultado no log de integração (sucesso ou erro),
 * sempre fora da transação do caso de uso para que o log de falha sobreviva ao rollback.
 * Mensagens de erro inesperadas nunca vazam detalhes internos para o log visível.
 */
export async function comLog<T>(
  q: Queryable,
  request: FastifyRequest,
  usuario: UsuarioAutenticado,
  categoria: CategoriaLog,
  acao: string,
  fn: () => Promise<T>,
  detalheSucesso: (resultado: T) => string,
): Promise<{ resultado: T; log: Awaited<ReturnType<typeof inserirLog>> | undefined }> {
  const inicio = performance.now()
  const base = { categoria, acao, correlationId: request.id, usuarioId: usuario.id }
  let resultado: T
  try {
    resultado = await fn()
  } catch (err) {
    const mensagem = err instanceof AppError ? err.message : 'Erro interno ao processar a operação.'
    try {
      await inserirLog(q, { ...base, status: 'erro', duracaoMs: performance.now() - inicio, detalhe: 'A operação não foi concluída.', erro: mensagem })
    } catch (logErr) {
      request.log.warn({ err: logErr }, 'falha ao registrar log de integração (erro)')
    }
    throw err
  }
  try {
    const log = await inserirLog(q, { ...base, status: 'sucesso', duracaoMs: performance.now() - inicio, detalhe: detalheSucesso(resultado) })
    return { resultado, log }
  } catch (logErr) {
    request.log.warn({ err: logErr }, 'falha ao registrar log de integração (sucesso)')
    return { resultado, log: undefined }
  }
}
