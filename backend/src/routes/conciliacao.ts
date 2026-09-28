import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { exigirEscrita, exigirPerfil, exigirUsuario } from '../auth.ts'
import { listarColaboradores, listarDivergencias, ultimaConferencia } from '../db/queries.ts'
import { bodyResolucao, bodyResponsavel, paramsId, respostaConciliacao, respostaDivergencia } from '../schemas.ts'
import { atribuirResponsavel, executarConciliacao, recursoDivergencia, resolverDivergencia } from '../services/conciliacao.ts'
import { comLog } from '../services/logs.ts'

export function rotasConciliacao(app: FastifyInstance, pool: pg.Pool) {
  app.post('/conciliacoes', { schema: { response: { 201: respostaConciliacao } } }, async (request, reply) => {
    const usuario = exigirUsuario(request)
    exigirPerfil(usuario, 'rh_local', 'rh_central')
    const { log } = await comLog(
      pool,
      request,
      usuario,
      'conciliacao',
      'Executar conferência Apdata × Employee Central',
      () => executarConciliacao(pool, { origem: 'manual', usuarioId: usuario.id, plantasAutorizadas: usuario.plantasAutorizadas }),
      (r) => `${r.registrosComparados} registros comparados.`,
    )
    const [conferencia, divergencias, colaboradores] = await Promise.all([
      ultimaConferencia(pool),
      listarDivergencias(pool, usuario.plantasAutorizadas),
      listarColaboradores(pool, usuario.plantasAutorizadas),
    ])
    return reply.status(201).send({ conferencia, divergencias, colaboradores, logs: log ? [log] : [] })
  })

  app.patch<{ Params: { id: string }; Body: { responsavelId: string } }>(
    '/divergencias/:id/responsavel',
    { schema: { params: paramsId, body: bodyResponsavel, response: { 200: respostaDivergencia } } },
    async (request) => {
      const usuario = exigirUsuario(request)
      exigirEscrita(usuario)
      exigirPerfil(usuario, 'rh_local', 'rh_central')
      const { id } = request.params
      const { log } = await comLog(
        pool,
        request,
        usuario,
        'conciliacao',
        'Atribuir responsável',
        () => atribuirResponsavel(pool, usuario, id, request.body.responsavelId),
        () => `Divergência ${id} atribuída a ${request.body.responsavelId}.`,
      )
      return { ...(await recursoDivergencia(pool, usuario, id)), logs: log ? [log] : [] }
    },
  )

  app.post<{ Params: { id: string }; Body: { justificativa: string } }>(
    '/divergencias/:id/resolucao',
    { schema: { params: paramsId, body: bodyResolucao, response: { 200: respostaDivergencia } } },
    async (request) => {
      const usuario = exigirUsuario(request)
      exigirPerfil(usuario, 'rh_local', 'rh_central')
      const { id } = request.params
      const { log } = await comLog(
        pool,
        request,
        usuario,
        'conciliacao',
        'Resolver divergência',
        () => resolverDivergencia(pool, usuario, id, request.body.justificativa),
        () => `Divergência ${id} marcada como resolvida.`,
      )
      return { ...(await recursoDivergencia(pool, usuario, id)), logs: log ? [log] : [] }
    },
  )
}
