import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { exigirUsuario } from '../auth.ts'
import { contentDispositionAnexo } from '../domain/documentos.ts'
import { paramsId } from '../schemas.ts'
import { buscarDocumentoParaDownload } from '../services/movimentacoes.ts'

export function rotasDocumentos(app: FastifyInstance, pool: pg.Pool) {
  app.get<{ Params: { id: string } }>('/documentos/:id/download', { schema: { params: paramsId } }, async (request, reply) => {
    const usuario = exigirUsuario(request)
    const doc = await buscarDocumentoParaDownload(pool, usuario, request.params.id)
    return reply
      .header('Content-Type', doc.mime)
      .header('Content-Disposition', contentDispositionAnexo(doc.nome))
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, no-store')
      .send(doc.conteudo)
  })
}
