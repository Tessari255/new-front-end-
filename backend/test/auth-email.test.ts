import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { buildApp } from '../src/app.ts'
import { conferirSenha, hashSenha } from '../src/authSenha.ts'
import { loadConfig } from '../src/config.ts'
import { createPool } from '../src/db/pool.ts'
import type { Email } from '../src/email.ts'
import { encerrar, iniciar, json, resetar, type Ctx } from './helpers.ts'

const EMAIL = 'rh.central@nexopeople.demo.br'
const SENHA = 'uma senha longa e correta'
const ORIGEM = 'http://localhost:4300'

describe('cadastro, confirmação, login e recuperação por e-mail', () => {
  let ctx: Ctx
  let app: FastifyInstance
  let enviados: Email[]

  before(async () => {
    ctx = await iniciar()
    const config = loadConfig({
      DATABASE_URL: ctx.config.databaseUrl,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      CORS_ORIGIN: ORIGEM,
      AUTH_EMAIL_SENHA: 'true',
      APP_URL: ORIGEM,
      SMTP_HOST: 'smtp.invalid',
      EMAIL_FROM: 'Nexo People <nao-responder@nexopeople.demo.br>',
    })
    app = await buildApp(config, createPool(config), { enviarEmail: async (e) => void enviados.push(e) })
  })
  after(async () => {
    await app.close()
    await encerrar(ctx)
  })
  beforeEach(async () => {
    enviados = []
    await resetar(ctx)
  })

  const post = (url: string, payload: object, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url: `/api/v1${url}`, payload, headers: { origin: ORIGEM, ...headers } })
  const tokenDo = (e: Email | undefined) => /#token=([A-Za-z0-9_-]{43})/.exec(e?.texto ?? '')?.[1] ?? ''
  const cookieDe = (res: LightMyRequestResponse) => String(res.headers['set-cookie']).split(';')[0]!

  async function cadastrarEConfirmar() {
    await post('/auth/cadastro', { email: EMAIL })
    const confirmado = await post('/auth/confirmar', { token: tokenDo(enviados[0]), senha: SENHA })
    assert.equal(confirmado.statusCode, 200)
  }

  it('scrypt: hash não contém a senha e só confere a senha correta', async () => {
    const hash = await hashSenha(SENHA)
    assert.match(hash, /^scrypt\$65536\$8\$2\$/)
    assert.ok(!hash.includes(SENHA))
    assert.equal(await conferirSenha(SENHA, hash), true)
    assert.equal(await conferirSenha('outra senha qualquer', hash), false)
  })

  it('fluxo completo: cadastro → e-mail ao endereço informado → confirmação única → login → sessão → logout', async () => {
    const desconhecido = await post('/auth/cadastro', { email: 'alguem@gmail.com' })
    const conhecido = await post('/auth/cadastro', { email: 'RH.Central@NexoPeople.demo.br' })
    assert.equal(desconhecido.statusCode, 202)
    assert.equal(conhecido.statusCode, 202)
    assert.equal(desconhecido.body, conhecido.body, 'mesma resposta: não revela se a conta existe')
    assert.equal(enviados.length, 1)
    assert.equal(enviados[0]!.para, EMAIL)

    const token = tokenDo(enviados[0])
    assert.ok(token)
    const { rows } = await ctx.pool.query(`select encode(token_hash, 'hex') as h from auth_tokens`)
    assert.deepEqual(rows.map((r) => r.h), [createHash('sha256').update(token).digest('hex')], 'o banco guarda só o hash do token')

    assert.equal((await post('/auth/login', { email: EMAIL, senha: SENHA })).statusCode, 401, 'sem confirmação não entra')
    assert.equal((await post('/auth/confirmar', { token, senha: 'curta' })).statusCode, 400)
    assert.equal((await post('/auth/confirmar', { token, senha: SENHA })).statusCode, 200)
    const reuso = await post('/auth/confirmar', { token, senha: 'outra senha longa e diferente' })
    assert.equal(reuso.statusCode, 400)
    assert.equal(json(reuso).error.code, 'TOKEN_INVALIDO')

    assert.equal((await post('/auth/login', { email: EMAIL, senha: 'senha errada 123' })).statusCode, 401)
    const login = await post('/auth/login', { email: EMAIL, senha: SENHA })
    assert.equal(login.statusCode, 200)
    assert.equal(json(login).usuario.perfil, 'rh_central')
    const setCookie = String(login.headers['set-cookie'])
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, /SameSite=Strict/)
    assert.match(setCookie, /Path=\/api\/v1/)
    const cookie = cookieDe(login)

    const boot = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { cookie } })
    assert.equal(boot.statusCode, 200)
    assert.equal(json(boot).currentUser.email, EMAIL)
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/auth/sessao', headers: { cookie } })).statusCode, 200)
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { cookie: 'nexo_sessao=forjado' } })).statusCode, 401)
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/bootstrap' })).statusCode, 401)

    const csrf = await app.inject({ method: 'POST', url: '/api/v1/conciliacoes', headers: { cookie, origin: 'https://evil.example' } })
    assert.equal(csrf.statusCode, 403)
    const cors = await app.inject({ method: 'OPTIONS', url: '/api/v1/auth/login', headers: { origin: ORIGEM, 'access-control-request-method': 'POST' } })
    assert.equal(cors.headers['access-control-allow-credentials'], 'true')

    assert.equal((await post('/auth/logout', {}, { cookie })).statusCode, 200)
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { cookie } })).statusCode, 401)
  })

  it('link de confirmação expirado é recusado', async () => {
    await post('/auth/cadastro', { email: EMAIL })
    await ctx.pool.query(`update auth_tokens set expira_em = now() - interval '1 second'`)
    assert.equal((await post('/auth/confirmar', { token: tokenDo(enviados[0]), senha: SENHA })).statusCode, 400)
  })

  it('recuperação: resposta neutra, token de uso único com validade, troca a senha e derruba sessões', async () => {
    await cadastrarEConfirmar()
    const cookie = cookieDe(await post('/auth/login', { email: EMAIL, senha: SENHA }))
    enviados = []

    const neutra = await post('/auth/recuperar-senha', { email: 'ninguem@empresa.com.br' })
    const real = await post('/auth/recuperar-senha', { email: EMAIL })
    assert.equal(neutra.body, real.body)
    assert.equal(enviados.length, 1)
    assert.equal(enviados[0]!.para, EMAIL)
    assert.match(enviados[0]!.texto, /30 minutos/)
    const token = tokenDo(enviados[0])

    const nova = 'a nova senha bem longa'
    assert.equal((await post('/auth/confirmar', { token, senha: nova })).statusCode, 400, 'token de redefinição não confirma cadastro')
    assert.equal((await post('/auth/redefinir-senha', { token, senha: nova })).statusCode, 200)
    assert.equal((await post('/auth/redefinir-senha', { token, senha: 'terceira senha longa' })).statusCode, 400)
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { cookie } })).statusCode, 401, 'sessões antigas encerradas')
    assert.equal((await post('/auth/login', { email: EMAIL, senha: SENHA })).statusCode, 401)
    assert.equal((await post('/auth/login', { email: EMAIL, senha: nova })).statusCode, 200)

    enviados = []
    await ctx.pool.query(`update auth_tokens set created_at = created_at - interval '2 minutes'`) // passa o limite de 1 e-mail/minuto
    await post('/auth/recuperar-senha', { email: EMAIL })
    assert.equal(enviados.length, 1)
    await ctx.pool.query(`update auth_tokens set expira_em = now() - interval '1 second' where usado_em is null`)
    assert.equal((await post('/auth/redefinir-senha', { token: tokenDo(enviados[0]), senha: 'mais uma senha longa' })).statusCode, 400)
  })

  it('bloqueia a conta após 5 senhas erradas, sem revelar o bloqueio, e limita reenvio de e-mails', async () => {
    await cadastrarEConfirmar()
    for (let i = 0; i < 5; i++) assert.equal((await post('/auth/login', { email: EMAIL, senha: `errada numero ${i}` })).statusCode, 401)
    const bloqueado = await post('/auth/login', { email: EMAIL, senha: SENHA })
    assert.equal(bloqueado.statusCode, 401)
    const inexistente = await post('/auth/login', { email: 'nao.existe@empresa.com.br', senha: SENHA })
    assert.equal(json(bloqueado).error.message, json(inexistente).error.message)

    enviados = []
    await post('/auth/recuperar-senha', { email: EMAIL })
    await post('/auth/recuperar-senha', { email: EMAIL })
    assert.equal(enviados.length, 1, 'no máximo um e-mail por minuto por usuário')
  })

  it('limita tentativas por IP (429, inclusive variando a query string) e rejeita e-mail inválido', async () => {
    assert.equal((await post('/auth/cadastro', { email: 'nao-e-email' })).statusCode, 400)
    const ip = { remoteAddress: '203.0.113.9' }
    let ultimo = 0
    for (let i = 0; i < 21; i++) {
      ultimo = (await app.inject({ method: 'POST', url: '/api/v1/auth/recuperar-senha?x=' + i, payload: { email: EMAIL }, ...ip })).statusCode
    }
    assert.equal(ultimo, 429)
  })

  it('configuração: exige SMTP/remetente, HTTPS em produção e não combina com DEMO_MODE', () => {
    const base = { DATABASE_URL: 'postgres://x', AUTH_EMAIL_SENHA: 'true', APP_URL: 'https://rh.empresa.com.br', SMTP_HOST: 'smtp.empresa.com.br', EMAIL_FROM: 'a@empresa.com.br' }
    assert.throws(() => loadConfig({ ...base, NODE_ENV: 'production', SMTP_HOST: '' }), /SMTP_HOST/)
    assert.throws(() => loadConfig({ ...base, NODE_ENV: 'production', APP_URL: 'http://rh.empresa.com.br' }), /HTTPS/)
    assert.throws(() => loadConfig({ ...base, NODE_ENV: 'production', SMTP_USER: 'u' }), /SMTP_PASSWORD/)
    assert.throws(() => loadConfig({ ...base, NODE_ENV: 'development', DEMO_MODE: 'true' }), /DEMO_MODE/)
    const ok = loadConfig({ ...base, NODE_ENV: 'production' })
    assert.equal(ok.emailSenha?.cookieSeguro, true)
    assert.equal(ok.emailSenha?.smtp.port, 587)
  })
})
