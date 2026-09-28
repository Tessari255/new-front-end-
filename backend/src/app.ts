import { randomUUID } from 'node:crypto'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify, { LogController, type FastifyInstance } from 'fastify'
import type pg from 'pg'
import { criarAuthHook } from './auth.ts'
import { rotasEmailSenha } from './authSenha.ts'
import type { Config } from './config.ts'
import { criarEnvioSmtp, type EnviarEmail } from './email.ts'
import { LIMITE_BYTES } from './domain/documentos.ts'
import { proibido, registrarTratamentoDeErros } from './errors.ts'
import { rotasBootstrap } from './routes/bootstrap.ts'
import { rotasCargos } from './routes/cargos.ts'
import { rotasConciliacao } from './routes/conciliacao.ts'
import { rotasDocumentos } from './routes/documentos.ts'
import { rotasExportacoes } from './routes/exportacoes.ts'
import { rotasFolha } from './routes/folha.ts'
import { rotasMovimentacoes } from './routes/movimentacoes.ts'
import { rotasDemo, rotasOperacao, rotasSaude } from './routes/ops.ts'

const CORRELATION_VALIDO = /^[A-Za-z0-9._-]{8,64}$/

/** `enviarEmail` só é substituído nos testes; em execução normal o envio é SMTP real. */
export async function buildApp(config: Config, pool: pg.Pool, deps: { enviarEmail?: EnviarEmail } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: (_endereco: string, salto: number) => salto < config.trustProxy,
    logger: { level: config.logLevel, redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], remove: true } },
    requestIdHeader: false,
    logController: new LogController({ requestIdLogLabel: 'correlationId' }),
    genReqId: (req) => {
      const enviado = req.headers['x-correlation-id']
      const valor = Array.isArray(enviado) ? enviado[0] : enviado
      return valor && CORRELATION_VALIDO.test(valor) ? valor : randomUUID()
    },
  })

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: Boolean(config.emailSenha),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Demo-User-Id', 'X-Correlation-Id'],
    exposedHeaders: ['Content-Disposition', 'X-Correlation-Id', 'X-Gerado-Em', 'X-Arquivo-Sha256'],
  })
  await app.register(multipart, { limits: { fileSize: LIMITE_BYTES, files: 1, fields: 5, parts: 6 } })

  registrarTratamentoDeErros(app)
  if (config.emailSenha) {
    // Sessão por cookie: além de SameSite=Strict, recusa escrita vinda de origem não autorizada (CSRF).
    app.addHook('onRequest', async (request) => {
      const origem = request.headers.origin
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origem && !config.corsOrigins.includes(origem)) {
        throw proibido('Origem não autorizada.')
      }
    })
  }
  app.addHook('onSend', async (request, reply) => {
    void reply.header('X-Correlation-Id', request.id)
    void reply.header('X-Content-Type-Options', 'nosniff')
    void reply.header('X-Frame-Options', 'DENY')
    void reply.header('Referrer-Policy', 'no-referrer')
    void reply.header('Cache-Control', 'no-store')
  })
  app.addHook('onClose', async () => {
    await pool.end()
  })

  rotasSaude(app, pool)

  await app.register(
    async (api) => {
      api.addHook('preHandler', criarAuthHook(pool, config))
      rotasBootstrap(api, pool)
      rotasCargos(api, pool)
      rotasMovimentacoes(api, pool)
      rotasDocumentos(api, pool)
      rotasConciliacao(api, pool)
      rotasExportacoes(api, pool)
      rotasFolha(api, pool)
      rotasOperacao(api, pool)
      if (config.demoMode) rotasDemo(api, pool)
      if (config.emailSenha) rotasEmailSenha(api, pool, config.emailSenha, deps.enviarEmail ?? criarEnvioSmtp(config.emailSenha.smtp))
    },
    { prefix: '/api/v1' },
  )

  return app
}
