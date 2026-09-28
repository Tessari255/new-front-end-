import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export class AppError extends Error {
  statusCode: number
  code: string
  fieldErrors: Record<string, string>

  constructor(statusCode: number, code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export const naoAutenticado = (msg = 'Identidade não informada ou inválida.') => new AppError(401, 'NAO_AUTENTICADO', msg)
export const proibido = (msg = 'Você não tem permissão para executar esta ação.') => new AppError(403, 'PROIBIDO', msg)
export const naoEncontrado = (msg = 'Recurso não encontrado.') => new AppError(404, 'NAO_ENCONTRADO', msg)
export const conflito = (msg: string, code = 'CONFLITO_DE_ESTADO') => new AppError(409, code, msg)
export const regraDeNegocio = (code: string, msg: string, fieldErrors: Record<string, string> = {}) =>
  new AppError(422, code, msg, fieldErrors)

export function errorBody(request: FastifyRequest, code: string, message: string, fieldErrors: Record<string, string> = {}) {
  return { error: { code, message, fieldErrors, correlationId: request.id } }
}

function fieldErrorsDeValidacao(validation: FastifyError['validation']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of validation ?? []) {
    const caminho = (v.instancePath || '')
      .split('/')
      .filter(Boolean)
      .join('.')
    const campo = caminho || (typeof v.params?.missingProperty === 'string' ? v.params.missingProperty : '_')
    const faltando = v.keyword === 'required' && caminho ? `${caminho}.${String(v.params?.missingProperty)}` : campo
    out[faltando] = v.message ?? 'valor inválido'
  }
  return out
}

export function registrarTratamentoDeErros(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send(errorBody(request, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.'))
  })

  app.setErrorHandler((err: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send(errorBody(request, err.code, err.message, err.fieldErrors))
    }
    const fe = err as FastifyError
    if (fe.validation) {
      return reply
        .status(400)
        .send(errorBody(request, 'PAYLOAD_INVALIDO', 'Requisição malformada.', fieldErrorsDeValidacao(fe.validation)))
    }
    if (fe.code === 'FST_REQ_FILE_TOO_LARGE' || fe.code === 'FST_FILES_LIMIT' || fe.code === 'FST_PARTS_LIMIT') {
      return reply
        .status(422)
        .send(errorBody(request, 'DOCUMENTO_INVALIDO', 'Arquivo acima do limite de 10 MB.', { file: 'Arquivo acima do limite de 10 MB.' }))
    }
    if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) {
      return reply.status(400).send(errorBody(request, 'REQUISICAO_INVALIDA', 'Requisição inválida.'))
    }
    request.log.error({ err }, 'erro inesperado')
    return reply
      .status(500)
      .send(errorBody(request, 'ERRO_INTERNO', 'Erro inesperado. Informe o código de correlação ao suporte.'))
  })
}
