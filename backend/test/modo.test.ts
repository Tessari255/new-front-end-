import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import { createPool } from '../src/db/pool.ts'
import { chamar, encerrar, iniciar, json, USUARIOS, type Ctx } from './helpers.ts'

describe('modo de execução, CORS e operação', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))

  it('restringe demo a desenvolvimento/teste, exige SSO em produção e rejeita CORS curinga', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production', DEMO_MODE: 'true', DATABASE_URL: 'postgres://x' }), /DEMO_MODE/)
    assert.throws(() => loadConfig({ NODE_ENV: 'staging', DEMO_MODE: 'true', DATABASE_URL: 'postgres://x' }), /DEMO_MODE/)
    assert.throws(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x' }), /MICROSOFT_ENTRA/)
    assert.throws(() => loadConfig({ NODE_ENV: 'development', DEMO_MODE: 'true' }), /DATABASE_URL/)
    assert.throws(() => loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true', DATABASE_URL: 'postgres://x', CORS_ORIGIN: '*' }), /CORS_ORIGIN/)
    assert.equal(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://x',
        MICROSOFT_ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
        MICROSOFT_ENTRA_AUDIENCE: 'api://nexo-people',
        MICROSOFT_ENTRA_SPA_CLIENT_ID: '22222222-2222-4222-8222-222222222222',
        MICROSOFT_ENTRA_REQUIRED_SCOPE: 'access_as_user',
      }).demoMode,
      false,
    )
  })

  it('sem DEMO_MODE: recursos de demonstração dão 404 e o header de identidade não autentica', async () => {
    const config = { ...ctx.config, demoMode: false }
    const pool = createPool(config)
    const app = await buildApp(config, pool)
    try {
      const headers = { 'x-demo-user-id': ctx.ids[USUARIOS.rhCentral]! }
      for (const [method, url] of [['POST', '/api/v1/dev/reset'], ['GET', '/api/v1/dev/users'], ['POST', '/api/v1/dev/integration-failure']] as const) {
        const res = await app.inject({ method, url, headers })
        assert.equal(res.statusCode, 404, url)
      }
      const boot = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers })
      assert.equal(boot.statusCode, 401)
      assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200)
    } finally {
      await app.close()
    }
  })

  it('/health não consulta o banco; /ready verifica o banco', async () => {
    assert.deepEqual(json(await ctx.app.inject({ method: 'GET', url: '/health' })), { status: 'ok' })
    assert.deepEqual(json(await ctx.app.inject({ method: 'GET', url: '/ready' })), { status: 'ready' })
    const config = { ...ctx.config, databaseUrl: 'postgres://nexo:errada@127.0.0.1:1/nada' }
    const pool = createPool(config)
    const app = await buildApp(config, pool)
    try {
      assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200)
      assert.equal((await app.inject({ method: 'GET', url: '/ready' })).statusCode, 503)
    } finally {
      await app.close()
    }
  })

  it('CORS só libera a origem configurada e nunca "*"', async () => {
    const ok = await ctx.app.inject({ method: 'OPTIONS', url: '/api/v1/bootstrap', headers: { origin: 'http://localhost:4300', 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization, x-demo-user-id' } })
    assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:4300')
    assert.match(ok.headers['access-control-allow-headers']!, /authorization/i)
    const negado = await ctx.app.inject({ method: 'OPTIONS', url: '/api/v1/bootstrap', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } })
    assert.equal(negado.headers['access-control-allow-origin'], undefined)
    assert.notEqual(ok.headers['access-control-allow-origin'], '*')
  })

  it('rota inexistente e erros seguem o formato padrão, sem stack ou SQL; correlationId é propagado', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/nada', headers: { 'x-correlation-id': 'teste-correlacao-123' } })
    assert.equal(res.statusCode, 404)
    assert.equal(json(res).error.code, 'ROTA_NAO_ENCONTRADA')
    assert.equal(json(res).error.correlationId, 'teste-correlacao-123')
    assert.equal(res.headers['x-correlation-id'], 'teste-correlacao-123')
    assert.equal(res.headers['x-frame-options'], 'DENY')
    assert.equal(res.headers['referrer-policy'], 'no-referrer')
    assert.equal(res.headers['cache-control'], 'no-store')
    const ruim = await chamar(ctx, USUARIOS.rhCentral, 'GET', '/movimentacoes/abc')
    assert.equal(ruim.statusCode, 400)
    assert.ok(!/stack|select |at /i.test(ruim.body))
  })

  it('reset e falha simulada existem em DEMO_MODE, registram log e restauram o estado inicial', async () => {
    const falha = await chamar(ctx, USUARIOS.rhCentral, 'POST', '/dev/integration-failure')
    assert.equal(falha.statusCode, 502)
    assert.equal(json(falha).error.code, 'INTEGRACAO_SIMULADA')
    const { rows } = await ctx.pool.query(`select status, erro from logs_integracao where categoria = 'sistema' order by id desc limit 1`)
    assert.equal(rows[0].status, 'erro')
    assert.match(rows[0].erro, /simulado/)

    await ctx.pool.query(`update colaboradores set salario = 1 where matricula = 'GRU0001'`)
    const reset = await chamar(ctx, USUARIOS.rhCentral, 'POST', '/dev/reset')
    assert.equal(reset.statusCode, 200)
    const { rows: c } = await ctx.pool.query(`select salario from colaboradores where matricula = 'GRU0001'`)
    assert.notEqual(c[0].salario, 1)
    const { rows: logs } = await ctx.pool.query('select acao from logs_integracao')
    assert.deepEqual(logs.map((l) => l.acao), ['Restaurar demonstração'])
    const { rows: usuarios } = await ctx.pool.query('select count(*)::int as n from usuarios')
    assert.equal(usuarios[0].n, 27)
  })

  it('re-executar o seed não sobrescreve dados alterados nem duplica registros', async () => {
    const { semearDemo } = await import('../src/db/seed.ts')
    await ctx.pool.query(`update colaboradores set salario = 12345 where matricula = 'GRU0001'`)
    await semearDemo(ctx.pool)
    await semearDemo(ctx.pool)
    const { rows } = await ctx.pool.query(`select salario from colaboradores where matricula = 'GRU0001'`)
    assert.equal(rows[0].salario, 12345)
    const { rows: n } = await ctx.pool.query(`select (select count(*) from colaboradores)::int as c, (select count(*) from movimentacoes)::int as m, (select count(*) from usuarios)::int as u`)
    assert.deepEqual(n[0], { c: 45, m: 23, u: 27 })
    await ctx.pool.query(`update colaboradores set salario = (select salario_min from cargos c where c.id = colaboradores.cargo_id) where matricula = 'GRU0001'`)
  })
})
