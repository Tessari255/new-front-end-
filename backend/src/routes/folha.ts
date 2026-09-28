import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { exigirUsuario } from '../auth.ts'
import { bodyTravarFolha, fechamentoFolha, paramsId, respostaFechamentoFolha, respostaMovimentacao } from '../schemas.ts'
import { comLog } from '../services/logs.ts'
import { liberarFolha, liberarMovimentacaoParaFolha, obterFechamento, travarFolha } from '../services/folha.ts'
import { recursoCanonico } from '../services/movimentacoes.ts'

interface ParamsId {
  id: string
}

export function rotasFolha(app: FastifyInstance, pool: pg.Pool) {
  // Estado da trava é visível a qualquer usuário autenticado (banner de mês fechado, tela do Share).
  app.get('/folha', { schema: { response: { 200: fechamentoFolha } } }, async (request) => {
    exigirUsuario(request)
    return obterFechamento(pool)
  })

  app.post<{ Body: { mes: string } }>(
    '/folha/travar',
    { schema: { body: bodyTravarFolha, response: { 200: respostaFechamentoFolha } } },
    async (request) => {
      const usuario = exigirUsuario(request)
      const mes = request.body.mes
      const { resultado, log } = await comLog(
        pool,
        request,
        usuario,
        'sistema',
        'Travar fechamento da folha',
        () => travarFolha(pool, usuario, mes),
        (r) => `Folha travada para ${r.mesTravado}.`,
      )
      return { fechamento: resultado, logs: log ? [log] : [] }
    },
  )

  app.post('/folha/liberar', { schema: { response: { 200: respostaFechamentoFolha } } }, async (request) => {
    const usuario = exigirUsuario(request)
    const { resultado, log } = await comLog(
      pool,
      request,
      usuario,
      'sistema',
      'Liberar fechamento da folha',
      () => liberarFolha(pool, usuario),
      () => 'Folha liberada.',
    )
    return { fechamento: resultado, logs: log ? [log] : [] }
  })

  app.post<{ Params: ParamsId }>(
    '/movimentacoes/:id/liberar-folha',
    { schema: { params: paramsId, response: { 200: respostaMovimentacao } } },
    async (request) => {
      const usuario = exigirUsuario(request)
      const { id } = request.params
      const { log } = await comLog(
        pool,
        request,
        usuario,
        'sistema',
        'Liberar movimentação para a Folha',
        () => liberarMovimentacaoParaFolha(pool, usuario, id),
        (r) => `${r.protocolo} liberada para entrada na Folha.`,
      )
      return { ...(await recursoCanonico(pool, usuario, id)), logs: log ? [log] : [] }
    },
  )
}
