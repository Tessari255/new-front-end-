import { createHash } from 'node:crypto'
import path from 'node:path'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { runner } from 'node-pg-migrate'
import pg from 'pg'
import { buildApp } from '../src/app.ts'
import { loadConfig, type Config } from '../src/config.ts'
import { createPool } from '../src/db/pool.ts'
import { resetarDemo } from '../src/db/seed.ts'

function urlDoBancoDeTeste(): string {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  if (!base) throw new Error('Defina TEST_DATABASE_URL (ou DATABASE_URL) para rodar os testes.')
  const url = new URL(base)
  if (!process.env.TEST_DATABASE_URL) url.pathname = '/nexo_people_test'
  if (!url.pathname.replace('/', '').endsWith('_test')) {
    throw new Error(`Recusando rodar testes em "${url.pathname}": o banco de teste deve terminar com "_test".`)
  }
  return url.toString()
}

async function garantirBanco(url: string) {
  const alvo = new URL(url)
  const nome = alvo.pathname.replace('/', '')
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const client = new pg.Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    const { rows } = await client.query('select 1 from pg_database where datname = $1', [nome])
    if (rows.length === 0) await client.query(`create database "${nome.replace(/"/g, '')}"`)
  } finally {
    await client.end()
  }
}

export interface Ctx {
  app: FastifyInstance
  pool: pg.Pool
  config: Config
  ids: { [subject: string]: string }
}

export async function iniciar(): Promise<Ctx> {
  const url = urlDoBancoDeTeste()
  await garantirBanco(url)
  await runner({
    databaseUrl: url,
    dir: path.resolve(import.meta.dirname, '../migrations'),
    migrationsTable: 'pgmigrations',
    direction: 'up',
    count: Infinity,
    log: () => undefined,
  })
  const config: Config = {
    ...loadConfig({ DATABASE_URL: url, DEMO_MODE: 'true', LOG_LEVEL: 'silent', NODE_ENV: 'test' }),
  }
  const pool = createPool(config)
  const app = await buildApp(config, pool)
  const ctx: Ctx = { app, pool, config, ids: {} }
  await resetar(ctx)
  return ctx
}

export async function resetar(ctx: Ctx) {
  await resetarDemo(ctx.pool)
  const { rows } = await ctx.pool.query('select id, subject from usuarios')
  ctx.ids = Object.fromEntries(rows.map((r) => [r.subject, r.id]))
}

export async function encerrar(ctx: Ctx) {
  await ctx.app.close() // também encerra o pool (onClose)
}

export const USUARIOS = {
  yasmin: 'demo.gestor.col-joi-10', // gestora direta de Bianca (Joinville)
  brunoGru: 'demo.gestor.col-gru-02',
  thiagoJoi: 'demo.gestor.col-joi-07', // gestor em Joinville, mas não gestor direto de Bianca
  gerenteJoi: 'demo.gestor.col-joi-01',
  diretor: 'demo.gestor.col-cor-01',
  cio: 'demo.gestor.col-cor-09',
  rhLocalJoi: 'demo.rh-local.joi',
  rhLocalGru: 'demo.rh-local.gru',
  rhCentral: 'demo.rh-central',
  auditoria: 'demo.auditoria',
  share: 'demo.share',
} as const

export function chamar(ctx: Ctx, subject: string | null, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = {}
  if (subject) headers['x-demo-user-id'] = ctx.ids[subject] ?? '0'
  return ctx.app.inject({ method, url: `/api/v1${url}`, headers, payload: payload as object | undefined })
}

export function json<T = any>(res: LightMyRequestResponse): T {
  return res.json() as T
}

export function multipart(campos: Record<string, string>, arquivo?: { nome: string; mime: string; conteudo: Buffer }) {
  const boundary = '----nexo' + Math.random().toString(16).slice(2)
  const partes: Buffer[] = []
  for (const [k, v] of Object.entries(campos)) {
    partes.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`))
  }
  if (arquivo) {
    partes.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n`),
      arquivo.conteudo,
      Buffer.from('\r\n'),
    )
  }
  partes.push(Buffer.from(`--${boundary}--\r\n`))
  return { body: Buffer.concat(partes), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

export async function anexar(ctx: Ctx, subject: string, movId: string, arquivo: { nome: string; mime: string; conteudo: Buffer }, tipo = 'evidencia') {
  const { body, headers } = multipart({ tipo }, arquivo)
  return ctx.app.inject({
    method: 'POST',
    url: `/api/v1/movimentacoes/${movId}/documentos`,
    headers: { ...headers, 'x-demo-user-id': ctx.ids[subject] ?? '0' },
    payload: body,
  })
}

export const PDF_VALIDO = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('conteúdo de teste '.repeat(50))])
export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')

export async function colaboradorPorNome(ctx: Ctx, nome: string): Promise<string> {
  const { rows } = await ctx.pool.query('select id from colaboradores where nome = $1', [nome])
  if (!rows[0]) throw new Error(`Colaborador de teste não encontrado: ${nome}`)
  return rows[0].id as string
}

export async function idPorNome(ctx: Ctx, tabela: 'cargos' | 'centros_custo' | 'folhas' | 'horarios', nome: string): Promise<string> {
  const { rows } = await ctx.pool.query(`select id from ${tabela} where nome = $1 order by id limit 1`, [nome])
  if (!rows[0]) throw new Error(`${tabela} de teste não encontrado: ${nome}`)
  return rows[0].id as string
}

/**
 * Cria e envia uma mudança de gestor válida (Bianca → Mariana) como Yasmin (gestora direta de
 * Bianca); devolve a movimentação. Pela regra "gestor que cria o workflow não precisa aprovar",
 * o envio pula a etapa `gestor` e já sai em `rh_local` — use este helper para testar exatamente
 * esse comportamento. Para testar a decisão na etapa `gestor`, use
 * `criarMudancaGestorEnviadaPorRH`, que preserva essa etapa pendente.
 */
export async function criarMudancaGestorEnviada(ctx: Ctx) {
  const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
  const mariana = await colaboradorPorNome(ctx, 'Mariana Oliveira Castro')
  const criada = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', {
    colaboradorId: bianca,
    tipo: 'mudanca_gestor',
    vigencia: '2026-10-01',
    justificativa: 'Reestruturação da coordenação de Qualidade, reporte direto à gerência.',
    alteracao: { tipo: 'mudanca_gestor', gestorPropostoId: mariana },
  })
  if (criada.statusCode !== 201) throw new Error(`criação falhou: ${criada.body}`)
  const id = json(criada).movimentacao.id as string
  const enviada = await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${id}/enviar`)
  if (enviada.statusCode !== 200) throw new Error(`envio falhou: ${enviada.body}`)
  return json(enviada).movimentacao as { id: string; protocolo: string; status: string; etapaAtual: string }
}

/**
 * Mesmo cenário (Bianca → Mariana), mas criado e enviado pelo RH Local de Joinville em nome de
 * Bianca — não pelo gestor direto. A etapa `gestor` continua pendente, exigindo decisão de
 * Yasmin; use este helper para testar a etapa `gestor` (permissões, concorrência, devolução…).
 */
export async function criarMudancaGestorEnviadaPorRH(ctx: Ctx) {
  const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
  const mariana = await colaboradorPorNome(ctx, 'Mariana Oliveira Castro')
  const criada = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', '/movimentacoes', {
    colaboradorId: bianca,
    tipo: 'mudanca_gestor',
    vigencia: '2026-10-01',
    justificativa: 'Reestruturação da coordenação de Qualidade, reporte direto à gerência.',
    alteracao: { tipo: 'mudanca_gestor', gestorPropostoId: mariana },
  })
  if (criada.statusCode !== 201) throw new Error(`criação falhou: ${criada.body}`)
  const id = json(criada).movimentacao.id as string
  const enviada = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', `/movimentacoes/${id}/enviar`)
  if (enviada.statusCode !== 200) throw new Error(`envio falhou: ${enviada.body}`)
  return json(enviada).movimentacao as { id: string; protocolo: string; status: string; etapaAtual: string }
}
