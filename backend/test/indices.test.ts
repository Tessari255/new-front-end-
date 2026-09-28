import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { encerrar, iniciar, type Ctx } from './helpers.ts'

// Com a base de demonstração (poucas linhas) o planner prefere seq scan; desligá-lo prova que
// cada filtro/ordenação principal consegue usar o índice composto planejado.
describe('planos de consulta (EXPLAIN)', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
    await ctx.pool.query('analyze')
  })
  after(async () => encerrar(ctx))

  async function plano(sql: string, params: unknown[] = []): Promise<string> {
    const client = await ctx.pool.connect()
    try {
      await client.query('begin')
      await client.query('set local enable_seqscan = off')
      const { rows } = await client.query(`explain (format text) ${sql}`, params)
      await client.query('rollback')
      return rows.map((r) => r['QUERY PLAN']).join('\n')
    } finally {
      client.release()
    }
  }

  const casos: { nome: string; sql: string; params?: unknown[]; indice: string }[] = [
    {
      nome: 'movimentações por planta/status/etapa (mais recentes primeiro)',
      sql: `select id from movimentacoes where planta_id = $1 and status = 'em_andamento' and etapa_atual = 'gestor' order by data_abertura desc, id desc`,
      params: ['1'],
      indice: 'movimentacoes_planta_status_etapa_idx',
    },
    {
      nome: 'movimentações de um colaborador',
      sql: `select id from movimentacoes where colaborador_id = $1 order by data_abertura desc, id desc`,
      params: ['1'],
      indice: 'movimentacoes_colaborador_idx',
    },
    {
      nome: 'colaboradores por planta/status ordenados por nome',
      sql: `select id from colaboradores where planta_id = $1 and status = 'ativo' order by nome, id`,
      params: ['1'],
      indice: 'colaboradores_planta_status_nome_idx',
    },
    {
      nome: 'divergências por planta/status (mais recentes primeiro)',
      sql: `select id from divergencias where planta_id = $1 and status = 'aberta' order by detectada_em desc, id desc`,
      params: ['1'],
      indice: 'divergencias_planta_status_detectada_idx',
    },
    {
      nome: 'eventos de uma movimentação',
      sql: `select id from movimentacao_eventos where movimentacao_id = $1 order by data desc, id desc`,
      params: ['1'],
      indice: 'movimentacao_eventos_mov_idx',
    },
    {
      nome: 'documentos de uma movimentação',
      sql: `select id from movimentacao_documentos where movimentacao_id = $1 order by criado_em, id`,
      params: ['1'],
      indice: 'movimentacao_documentos_mov_idx',
    },
    {
      nome: 'log de integração por data/categoria/status',
      sql: `select id from logs_integracao where categoria = 'aprovacao' and status = 'sucesso' order by data desc, id desc limit 50`,
      indice: 'logs_integracao_data_idx',
    },
    {
      nome: 'divergência aberta única por colaborador/campo',
      sql: `select id from divergencias where colaborador_id = $1 and campo = 'cargo' and status <> 'resolvida'`,
      params: ['1'],
      indice: 'divergencias_aberta_unica_idx',
    },
  ]

  for (const c of casos) {
    it(c.nome, async () => {
      const p = await plano(c.sql, c.params)
      assert.ok(p.includes(c.indice), `esperava ${c.indice} no plano:\n${p}`)
    })
  }
})
