import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { exigirUsuario } from '../auth.ts'
import { contentDispositionAnexo } from '../domain/documentos.ts'
import { paramsId } from '../schemas.ts'
import { gerarExportacao, type TipoExportacao } from '../services/exportacoes.ts'
import { comLog } from '../services/logs.ts'

export function rotasExportacoes(app: FastifyInstance, pool: pg.Pool) {
  const registrar = (caminho: string, tipo: TipoExportacao, acao: string, detalhe: (protocolo: string) => string) => {
    app.post<{ Params: { id: string } }>(caminho, { schema: { params: paramsId } }, async (request, reply) => {
      const usuario = exigirUsuario(request)
      const { resultado } = await comLog(pool, request, usuario, 'exportacao', acao, () => gerarExportacao(pool, usuario, request.params.id, tipo), (r) => detalhe(r.protocolo))
      return reply
        .header('Content-Type', resultado.mime)
        .header('Content-Disposition', contentDispositionAnexo(resultado.nome))
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'private, no-store')
        .header('X-Arquivo-Sha256', resultado.sha256)
        .header('X-Gerado-Em', resultado.geradoEm.toISOString())
        .send(resultado.conteudo)
    })
  }
  registrar('/movimentacoes/:id/exportacoes/apdata', 'apdata', 'Gerar carga Apdata', (p) => `Carga Apdata (.csv) gerada para ${p}.`)
  registrar(
    '/movimentacoes/:id/exportacoes/employee-central',
    'employee_central',
    'Gerar arquivo Employee Central',
    (p) => `Arquivo Employee Central (.json) gerado para ${p}.`,
  )
}
