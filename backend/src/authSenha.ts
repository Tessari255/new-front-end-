import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { exigirUsuario, usuarioPublico } from './auth.ts'
import type { EmailSenhaConfig } from './config.ts'
import { withTransaction } from './db/pool.ts'
import type { EnviarEmail } from './email.ts'
import { AppError, naoAutenticado } from './errors.ts'
import { respostaUsuarioAtual } from './schemas.ts'

export const COOKIE_SESSAO = 'nexo_sessao'
const SESSAO_SEGUNDOS = 8 * 60 * 60
const CONFIRMACAO = { finalidade: 'confirmacao', validade: '24 hours' } as const
const REDEFINICAO = { finalidade: 'redefinicao', validade: '30 minutes' } as const
const MAX_FALHAS = 5
const MENSAGEM_LOGIN_INVALIDO = 'E-mail ou senha inválidos. Após várias tentativas, o acesso fica bloqueado por 15 minutos.'

// ---------- Senhas (scrypt, parâmetros OWASP: N=2^16, r=8, p=2) ----------

const SCRYPT = { N: 2 ** 16, r: 8, p: 2 }

function derivar(senha: string, sal: Buffer, p: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(senha.normalize('NFKC'), sal, 32, { ...p, maxmem: 256 * 1024 * 1024 }, (err, chave) => (err ? reject(err) : resolve(chave))),
  )
}

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16)
  const chave = await derivar(senha, sal, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${sal.toString('base64')}$${chave.toString('base64')}`
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  const [alg, N, r, p, sal, chave] = hash.split('$')
  if (alg !== 'scrypt' || !sal || !chave) return false
  const esperado = Buffer.from(chave, 'base64')
  const obtido = await derivar(senha, Buffer.from(sal, 'base64'), { N: Number(N), r: Number(r), p: Number(p) })
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado)
}

// Hash descartável: e-mails inexistentes custam o mesmo tempo que os existentes.
let hashFicticio: Promise<string> | undefined
const hashParaComparar = (hash: string | null | undefined) => (hash ? Promise.resolve(hash) : (hashFicticio ??= hashSenha(randomBytes(16).toString('hex'))))

// ---------- Tokens opacos (só o SHA-256 vai para o banco) ----------

const novoToken = () => randomBytes(32).toString('base64url')
const sha256 = (token: string) => createHash('sha256').update(token).digest()

export function lerCookie(cabecalho: string | undefined, nome: string): string | undefined {
  for (const parte of cabecalho?.split(';') ?? []) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim() || undefined
  }
  return undefined
}

export const hashDaSessao = sha256

// ---------- Limite de tentativas por IP ----------

// ponytail: contador em memória por processo; com várias instâncias, aplique também na borda (WAF/gateway).
function criarLimitador(max: number, janelaMs: number) {
  const contagens = new Map<string, { n: number; ate: number }>()
  return (chave: string): boolean => {
    const agora = Date.now()
    if (contagens.size > 10_000) for (const [k, c] of contagens) if (c.ate <= agora) contagens.delete(k)
    const c = contagens.get(chave)
    if (!c || c.ate <= agora) {
      contagens.set(chave, { n: 1, ate: agora + janelaMs })
      return true
    }
    return ++c.n <= max
  }
}

// ---------- Schemas ----------

const email = { type: 'string', format: 'email', maxLength: 254 } as const
const senha = { type: 'string', minLength: 12, maxLength: 128 } as const
const token = { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' } as const
const corpo = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false }) as const
const respostaMensagem = corpo({ mensagem: { type: 'string' } })

const normalizarEmail = (valor: string) => valor.trim().toLowerCase()
const tokenInvalido = () => new AppError(400, 'TOKEN_INVALIDO', 'Link inválido, expirado ou já utilizado. Solicite um novo.')

interface UsuarioLogin {
  id: string
  email: string
  senha_hash: string | null
  bloqueado: boolean
}

export function rotasEmailSenha(app: FastifyInstance, pool: pg.Pool, config: EmailSenhaConfig, enviarEmail: EnviarEmail) {
  const limitar = criarLimitador(20, 15 * 60 * 1000)
  const publica = { publica: true }

  app.addHook('onRequest', async (request) => {
    const rota = request.routeOptions.url ?? ''
    if (rota.startsWith('/api/v1/auth/') && request.method === 'POST' && !limitar(`${request.ip}|${rota}`)) {
      throw new AppError(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    }
  })

  /** Envio fora do caminho da resposta: o tempo de resposta não revela se o e-mail existe. */
  function enviarEmSegundoPlano(request: FastifyRequest, usuarioId: string, para: string, assunto: string, texto: string) {
    enviarEmail({ para, assunto, texto }).catch((err: { code?: string; responseCode?: number; message?: string }) => {
      request.log.error({ usuarioId, code: err.code, responseCode: err.responseCode, message: err.message }, 'falha ao enviar e-mail')
    })
  }

  /** Emite um token de uso único; no máximo um por minuto por usuário e finalidade. */
  async function emitirToken(usuarioId: string, tipo: typeof CONFIRMACAO | typeof REDEFINICAO) {
    return withTransaction(pool, async (client) => {
      await client.query('select 1 from usuarios where id = $1 for update', [usuarioId])
      const recente = await client.query(
        `select 1 from auth_tokens where usuario_id = $1 and finalidade = $2 and created_at > now() - interval '1 minute'`,
        [usuarioId, tipo.finalidade],
      )
      if (recente.rowCount) return null
      await client.query(`update auth_tokens set usado_em = now() where usuario_id = $1 and finalidade = $2 and usado_em is null`, [usuarioId, tipo.finalidade])
      const valor = novoToken()
      await client.query(
        `insert into auth_tokens (usuario_id, finalidade, token_hash, expira_em) values ($1, $2, $3, now() + $4::interval)`,
        [usuarioId, tipo.finalidade, sha256(valor), tipo.validade],
      )
      return valor
    })
  }

  /** Consome o token (uma única vez, dentro da validade), define a senha e encerra todas as sessões do usuário. */
  async function consumirToken(valor: string, tipo: typeof CONFIRMACAO | typeof REDEFINICAO, senhaHash: string) {
    await withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ usuario_id: string }>(
        `update auth_tokens t set usado_em = now()
           from usuarios u
          where t.token_hash = $1 and t.finalidade = $2 and t.usado_em is null and t.expira_em > now()
            and u.id = t.usuario_id and u.ativo
          returning t.usuario_id`,
        [sha256(valor), tipo.finalidade],
      )
      const t = rows[0]
      if (!t) throw tokenInvalido()
      await client.query(
        `update usuarios set senha_hash = $2, email_verificado_em = coalesce(email_verificado_em, now()), falhas_login = 0, bloqueado_ate = null
          where id = $1`,
        [t.usuario_id, senhaHash],
      )
      await client.query(`update auth_tokens set usado_em = now() where usuario_id = $1 and usado_em is null`, [t.usuario_id])
      await client.query('delete from sessoes where usuario_id = $1', [t.usuario_id])
    })
  }

  function definirCookie(reply: FastifyReply, valor: string, maxAge: number) {
    const atributos = [`${COOKIE_SESSAO}=${valor}`, 'Path=/api/v1', `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Strict']
    if (config.cookieSeguro) atributos.push('Secure')
    void reply.header('Set-Cookie', atributos.join('; '))
  }

  const mensagemCadastro = { mensagem: 'Se este e-mail estiver autorizado, enviaremos um link de confirmação. Verifique sua caixa de entrada.' }
  app.post<{ Body: { email: string } }>(
    '/auth/cadastro',
    { config: publica, schema: { body: corpo({ email }), response: { 202: respostaMensagem } } },
    async (request, reply) => {
      // Só usuários já provisionados (perfil definido pelo RH) e ainda sem e-mail confirmado recebem o link.
      const { rows } = await pool.query<{ id: string; email: string }>(
        `select id, email from usuarios where lower(email) = $1 and ativo and email_verificado_em is null`,
        [normalizarEmail(request.body.email)],
      )
      const u = rows[0]
      const valor = u ? await emitirToken(u.id, CONFIRMACAO) : null
      if (u && valor) {
        const link = `${config.appUrl}/confirmar-email#token=${valor}`
        enviarEmSegundoPlano(
          request,
          u.id,
          u.email,
          'Confirme seu cadastro no Nexo People',
          `Olá,\n\nPara confirmar seu cadastro no Nexo People, abra o link abaixo em até 24 horas:\n\n${link}\n\nO link só pode ser usado uma vez. Se você não pediu este cadastro, ignore este e-mail.\n`,
        )
      }
      return reply.status(202).send(mensagemCadastro)
    },
  )

  app.post<{ Body: { token: string; senha: string } }>(
    '/auth/confirmar',
    { config: publica, schema: { body: corpo({ token, senha }), response: { 200: respostaMensagem } } },
    async (request) => {
      await consumirToken(request.body.token, CONFIRMACAO, await hashSenha(request.body.senha))
      return { mensagem: 'Cadastro confirmado. Você já pode entrar com seu e-mail e senha.' }
    },
  )

  app.post<{ Body: { email: string; senha: string } }>(
    '/auth/login',
    { config: publica, schema: { body: corpo({ email, senha: { type: 'string', minLength: 1, maxLength: 128 } }), response: { 200: respostaUsuarioAtual } } },
    async (request, reply) => {
      const { rows } = await pool.query<UsuarioLogin>(
        `select id, email, senha_hash, coalesce(bloqueado_ate > now(), false) as bloqueado
           from usuarios where lower(email) = $1 and ativo and email_verificado_em is not null`,
        [normalizarEmail(request.body.email)],
      )
      const u = rows[0]
      const senhaOk = await conferirSenha(request.body.senha, await hashParaComparar(u?.senha_hash))
      if (!u || !u.senha_hash || u.bloqueado || !senhaOk) {
        if (u && !u.bloqueado) {
          await pool.query(
            `update usuarios
                set falhas_login = case when falhas_login + 1 >= $2 then 0 else falhas_login + 1 end,
                    bloqueado_ate = case when falhas_login + 1 >= $2 then now() + interval '15 minutes' else bloqueado_ate end
              where id = $1`,
            [u.id, MAX_FALHAS],
          )
        }
        request.log.warn({ usuarioId: u?.id ?? null }, 'login recusado')
        throw naoAutenticado(MENSAGEM_LOGIN_INVALIDO)
      }
      const valor = novoToken()
      await withTransaction(pool, async (client) => {
        await client.query('update usuarios set falhas_login = 0, bloqueado_ate = null where id = $1', [u.id])
        await client.query('delete from sessoes where usuario_id = $1 and expira_em <= now()', [u.id])
        await client.query(`insert into sessoes (usuario_id, token_hash, expira_em) values ($1, $2, now() + make_interval(secs => $3))`, [
          u.id,
          sha256(valor),
          SESSAO_SEGUNDOS,
        ])
      })
      request.log.info({ usuarioId: u.id }, 'login por e-mail e senha')
      definirCookie(reply, valor, SESSAO_SEGUNDOS)
      const { rows: atual } = await pool.query(
        'select id, nome, email, perfil, planta_id as "plantaId", colaborador_id as "colaboradorId" from usuarios where id = $1',
        [u.id],
      )
      return { usuario: atual[0] }
    },
  )

  app.post('/auth/logout', { config: publica, schema: { response: { 200: respostaMensagem } } }, async (request, reply) => {
    const valor = lerCookie(request.headers.cookie, COOKIE_SESSAO)
    if (valor) await pool.query('delete from sessoes where token_hash = $1', [sha256(valor)])
    definirCookie(reply, '', 0)
    return { mensagem: 'Sessão encerrada.' }
  })

  const mensagemRecuperacao = { mensagem: 'Se houver uma conta confirmada com este e-mail, enviaremos um link para redefinir a senha.' }
  app.post<{ Body: { email: string } }>(
    '/auth/recuperar-senha',
    { config: publica, schema: { body: corpo({ email }), response: { 202: respostaMensagem } } },
    async (request, reply) => {
      const { rows } = await pool.query<{ id: string; email: string }>(
        `select id, email from usuarios where lower(email) = $1 and ativo and email_verificado_em is not null`,
        [normalizarEmail(request.body.email)],
      )
      const u = rows[0]
      const valor = u ? await emitirToken(u.id, REDEFINICAO) : null
      if (u && valor) {
        const link = `${config.appUrl}/redefinir-senha#token=${valor}`
        enviarEmSegundoPlano(
          request,
          u.id,
          u.email,
          'Redefinição de senha do Nexo People',
          `Olá,\n\nRecebemos um pedido para redefinir sua senha no Nexo People. Abra o link abaixo em até 30 minutos:\n\n${link}\n\nO link só pode ser usado uma vez. Se você não fez este pedido, ignore este e-mail; sua senha atual continua válida.\n`,
        )
      }
      return reply.status(202).send(mensagemRecuperacao)
    },
  )

  app.post<{ Body: { token: string; senha: string } }>(
    '/auth/redefinir-senha',
    { config: publica, schema: { body: corpo({ token, senha }), response: { 200: respostaMensagem } } },
    async (request) => {
      await consumirToken(request.body.token, REDEFINICAO, await hashSenha(request.body.senha))
      return { mensagem: 'Senha redefinida. Entre novamente com a nova senha.' }
    },
  )

  app.get('/auth/sessao', { schema: { response: { 200: respostaUsuarioAtual } } }, async (request) => ({
    usuario: usuarioPublico(exigirUsuario(request)),
  }))
}
