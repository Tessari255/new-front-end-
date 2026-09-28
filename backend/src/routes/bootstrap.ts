import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { exigirUsuario, usuarioPublico } from '../auth.ts'
import {
  carregarCatalogos,
  listarColaboradores,
  listarDivergencias,
  listarDocumentos,
  listarEventos,
  listarLogs,
  listarMovimentacoes,
  ultimaConferencia,
} from '../db/queries.ts'
import { obterFechamento } from '../services/folha.ts'
import { respostaBootstrap, respostaLogs } from '../schemas.ts'

export function rotasBootstrap(app: FastifyInstance, pool: pg.Pool) {
  // Snapshot único e consistente: nunca inclui o binário dos documentos.
  app.get('/bootstrap', { schema: { response: { 200: respostaBootstrap } } }, async (request) => {
    const usuario = exigirUsuario(request)
    const client = await pool.connect()
    try {
      await client.query('begin transaction isolation level repeatable read read only')
      const escopo = usuario.plantasAutorizadas
      const catalogos = await carregarCatalogos(client, escopo)
      const movimentacoes = await listarMovimentacoes(client, escopo, null, usuario.perfil === 'gestor' ? usuario.colaboradorId : null)
      const idsMovimentacoes = movimentacoes.map((m) => m.id)
      const colaboradores = await listarColaboradores(client, escopo, movimentacoes.map((m) => m.colaboradorId))
      const documentos = await listarDocumentos(client, null, idsMovimentacoes)
      const historico = await listarEventos(client, null, idsMovimentacoes)
      const divergencias = await listarDivergencias(client, escopo)
      const conferencia = await ultimaConferencia(client)
      const logsIntegracao = await listarLogs(client, usuario)
      const fechamentoFolha = await obterFechamento(client)
      await client.query('commit')
      return {
        ...catalogos,
        colaboradores,
        movimentacoes,
        documentos,
        historico,
        divergencias,
        conferencia,
        logsIntegracao,
        currentUser: usuarioPublico(usuario),
        fechamentoFolha,
      }
    } catch (err) {
      await client.query('rollback').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
  })

  app.get('/logs-integracao', { schema: { response: { 200: respostaLogs } } }, async (request) => {
    const usuario = exigirUsuario(request)
    return { logsIntegracao: await listarLogs(pool, usuario) }
  })
}
