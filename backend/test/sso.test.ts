import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import { createPool } from '../src/db/pool.ts'
import { encerrar, iniciar, json, USUARIOS, type Ctx } from './helpers.ts'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const SPA_CLIENT_ID = '22222222-2222-4222-8222-222222222222'
const OBJECT_ID = '33333333-3333-4333-8333-333333333333'
const AUDIENCE = 'api://44444444-4444-4444-8444-444444444444'
const SCOPE = 'access_as_user'
const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`

describe('SSO Microsoft Entra', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))

  it('aceita somente access token válido, do tenant/SPA/escopo configurados e mapeado no banco', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const jwk = await exportJWK(publicKey)
    Object.assign(jwk, { kid: 'teste', alg: 'RS256', use: 'sig' })
    const fetchOriginal = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { 'content-type': 'application/json' } })

    const subjectDemo = USUARIOS.rhCentral
    const usuarioId = ctx.ids[subjectDemo]!
    const subjectEntra = `entra:${TENANT_ID}:${OBJECT_ID}`
    await ctx.pool.query('update usuarios set subject = $1 where id = $2', [subjectEntra, usuarioId])
    const config = loadConfig({
      DATABASE_URL: ctx.config.databaseUrl,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      MICROSOFT_ENTRA_TENANT_ID: TENANT_ID,
      MICROSOFT_ENTRA_AUDIENCE: AUDIENCE,
      MICROSOFT_ENTRA_SPA_CLIENT_ID: SPA_CLIENT_ID,
      MICROSOFT_ENTRA_REQUIRED_SCOPE: SCOPE,
    })
    const app = await buildApp(config, createPool(config))

    const assinar = (sobrescritas: Record<string, unknown> = {}, opcoes: { audience?: string; exp?: number } = {}) => {
      const agora = Math.floor(Date.now() / 1000)
      return new SignJWT({ tid: TENANT_ID, oid: OBJECT_ID, azp: SPA_CLIENT_ID, scp: SCOPE, ver: '2.0', ...sobrescritas })
        .setProtectedHeader({ alg: 'RS256', kid: 'teste', typ: 'JWT' })
        .setIssuer(ISSUER)
        .setAudience(opcoes.audience ?? AUDIENCE)
        .setIssuedAt(agora)
        .setNotBefore(agora - 1)
        .setExpirationTime(opcoes.exp ?? agora + 60)
        .sign(privateKey)
    }

    try {
      const valido = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { authorization: `Bearer ${await assinar()}` } })
      assert.equal(valido.statusCode, 200)
      assert.equal(json<{ currentUser: { id: string; perfil: string } }>(valido).currentUser.id, usuarioId)
      assert.equal(json<{ currentUser: { perfil: string } }>(valido).currentUser.perfil, 'rh_central')

      const semEscopo = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { authorization: `Bearer ${await assinar({ scp: 'outro' })}` } })
      assert.equal(semEscopo.statusCode, 401)
      const spaErrada = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { authorization: `Bearer ${await assinar({ azp: '55555555-5555-4555-8555-555555555555' })}` } })
      assert.equal(spaErrada.statusCode, 401)
      const audienciaErrada = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { authorization: `Bearer ${await assinar({}, { audience: 'api://outra-api' })}` } })
      assert.equal(audienciaErrada.statusCode, 401)
      const expirado = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { authorization: `Bearer ${await assinar({}, { exp: Math.floor(Date.now() / 1000) - 1 })}` } })
      assert.equal(expirado.statusCode, 401)
      const demoIgnorado = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { 'x-demo-user-id': usuarioId } })
      assert.equal(demoIgnorado.statusCode, 401)
      const assinaturaInvalida = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { authorization: `Bearer ${(await assinar()).slice(0, -1)}x` } })
      assert.equal(assinaturaInvalida.statusCode, 401)
    } finally {
      await app.close()
      await ctx.pool.query('update usuarios set subject = $1 where id = $2', [subjectDemo, usuarioId])
      globalThis.fetch = fetchOriginal
    }
  })
})
