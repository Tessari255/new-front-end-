import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { exigirUsuario } from '../auth.ts'
import { validarArquivo, validarTipoDocumento, LIMITE_BYTES } from '../domain/documentos.ts'
import { regraDeNegocio } from '../errors.ts'
import { bodyDecisao, bodyMovimentacao, paramsId, respostaMovimentacao } from '../schemas.ts'
import { comLog } from '../services/logs.ts'
import {
  anexarDocumento,
  atualizarRascunho,
  criarRascunho,
  decidirEtapa,
  enviarParaAprovacao,
  recursoCanonico,
  type CorpoMovimentacao,
} from '../services/movimentacoes.ts'
import type { Decisao } from '../types.ts'

interface ParamsId {
  id: string
}

export function rotasMovimentacoes(app: FastifyInstance, pool: pg.Pool) {
  const schemaRecurso = { params: paramsId, response: { 200: respostaMovimentacao } }

  app.get<{ Params: ParamsId }>('/movimentacoes/:id', { schema: schemaRecurso }, async (request) => {
    const usuario = exigirUsuario(request)
    return { ...(await recursoCanonico(pool, usuario, request.params.id)), logs: [] }
  })

  app.post<{ Body: CorpoMovimentacao }>(
    '/movimentacoes',
    { schema: { body: bodyMovimentacao, response: { 201: respostaMovimentacao } } },
    async (request, reply) => {
      const usuario = exigirUsuario(request)
      const { resultado, log } = await comLog(
        pool,
        request,
        usuario,
        'movimentacao',
        'Salvar rascunho',
        () => criarRascunho(pool, usuario, request.body),
        (r) => `${r.protocolo} registrada com status "rascunho".`,
      )
      const recurso = await recursoCanonico(pool, usuario, resultado.id)
      return reply.status(201).send({ ...recurso, logs: log ? [log] : [] })
    },
  )

  app.patch<{ Params: ParamsId; Body: CorpoMovimentacao }>(
    '/movimentacoes/:id/rascunho',
    { schema: { params: paramsId, body: bodyMovimentacao, response: { 200: respostaMovimentacao } } },
    async (request) => {
      const usuario = exigirUsuario(request)
      const { id } = request.params
      const { log } = await comLog(pool, request, usuario, 'movimentacao', 'Atualizar rascunho', () => atualizarRascunho(pool, usuario, id, request.body), () => `Rascunho ${id} atualizado.`)
      return { ...(await recursoCanonico(pool, usuario, id)), logs: log ? [log] : [] }
    },
  )

  app.post<{ Params: ParamsId }>('/movimentacoes/:id/enviar', { schema: schemaRecurso }, async (request) => {
    const usuario = exigirUsuario(request)
    const { id } = request.params
    const { log } = await comLog(
      pool,
      request,
      usuario,
      'aprovacao',
      'Enviar para aprovação',
      () => enviarParaAprovacao(pool, usuario, id),
      (r) => `${r.protocolo} encaminhada para a etapa ${r.etapaAtual === 'gestor' ? 'Gestor' : 'RH Local'}.`,
    )
    return { ...(await recursoCanonico(pool, usuario, id)), logs: log ? [log] : [] }
  })

  app.post<{ Params: ParamsId; Body: { decisao: Decisao; comentario?: string | null } }>(
    '/movimentacoes/:id/decisoes',
    { schema: { params: paramsId, body: bodyDecisao, response: { 200: respostaMovimentacao } } },
    async (request) => {
      const usuario = exigirUsuario(request)
      const { id } = request.params
      const { log } = await comLog(
        pool,
        request,
        usuario,
        'aprovacao',
        `Decisão de aprovação — ${request.body.decisao}`,
        () => decidirEtapa(pool, usuario, id, request.body),
        (r) => `${r.protocolo}: decisão "${r.decisao}" registrada.`,
      )
      return { ...(await recursoCanonico(pool, usuario, id)), logs: log ? [log] : [] }
    },
  )

  app.post<{ Params: ParamsId }>(
    '/movimentacoes/:id/documentos',
    { schema: { params: paramsId, response: { 201: respostaMovimentacao } } },
    async (request, reply) => {
      const usuario = exigirUsuario(request)
      const { id } = request.params
      const arquivo = await lerMultipart(request)
      const { log } = await comLog(
        pool,
        request,
        usuario,
        'movimentacao',
        'Anexar documento',
        () => anexarDocumento(pool, usuario, id, arquivo),
        (r) => `Documento "${r.nome}" anexado a ${r.protocolo}.`,
      )
      return reply.status(201).send({ ...(await recursoCanonico(pool, usuario, id)), logs: log ? [log] : [] })
    },
  )
}

async function lerMultipart(request: FastifyRequest) {
  if (!request.isMultipart()) {
    throw regraDeNegocio('DOCUMENTO_INVALIDO', 'Envie o arquivo como multipart/form-data.', { file: 'Arquivo não informado.' })
  }
  let tipo: string | undefined
  let arquivo: { nome: string; mimeDeclarado: string; conteudo: Buffer; truncado: boolean } | undefined
  for await (const parte of request.parts({ limits: { fileSize: LIMITE_BYTES, files: 1, fields: 5 } })) {
    if (parte.type === 'field') {
      if (parte.fieldname === 'tipo' && typeof parte.value === 'string') tipo = parte.value
    } else if (parte.fieldname === 'file' && !arquivo) {
      try {
        const conteudo = await parte.toBuffer()
        arquivo = { nome: parte.filename, mimeDeclarado: parte.mimetype, conteudo, truncado: parte.file.truncated }
      } catch (err) {
        if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
          throw regraDeNegocio('DOCUMENTO_INVALIDO', 'Arquivo acima do limite de 10 MB.', { file: 'Arquivo acima do limite de 10 MB.' })
        }
        throw err
      }
    } else {
      parte.file.resume()
    }
  }
  if (!arquivo) throw regraDeNegocio('DOCUMENTO_INVALIDO', 'Arquivo não informado.', { file: 'Arquivo não informado.' })
  const tipoValido = validarTipoDocumento(tipo)
  const { nome, mime, sha256 } = validarArquivo(arquivo)
  return { nome, tipo: tipoValido, mime, conteudo: arquivo.conteudo, sha256 }
}
