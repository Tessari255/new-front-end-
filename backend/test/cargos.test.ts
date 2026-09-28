import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { chamar, colaboradorPorNome, encerrar, iniciar, json, resetar, USUARIOS, type Ctx } from './helpers.ts'

describe('faixa atual e IPE por cargo e planta', () => {
  let ctx: Ctx

  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  async function contextoDaBianca() {
    const colaboradorId = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const { rows } = await ctx.pool.query(
      `select c.id as colaborador_id, c.cargo_id, c.planta_id,
              (select cp.planta_id from cargo_plantas cp where cp.cargo_id = c.cargo_id and cp.planta_id <> c.planta_id order by cp.planta_id limit 1) as outra_planta_id
         from colaboradores c where c.id = $1`,
      [colaboradorId],
    )
    return rows[0] as { colaborador_id: string; cargo_id: string; planta_id: string; outra_planta_id: string }
  }

  async function colaboradorNoBootstrap(id: string) {
    const resposta = await chamar(ctx, USUARIOS.rhLocalJoi, 'GET', '/bootstrap')
    assert.equal(resposta.statusCode, 200, resposta.body)
    const colaborador = json(resposta).colaboradores.find((item: { id: string }) => item.id === id)
    assert.ok(colaborador)
    return colaborador as { salarioBaseCargo: number | null; faixaAtualPercentual: number | null }
  }

  it('calcula 80%, 100% e acima de 100% no banco, sem persistir o percentual', async () => {
    const { colaborador_id, cargo_id, planta_id } = await contextoDaBianca()
    await ctx.pool.query(`update cargo_plantas set salario_base = 1000 where cargo_id = $1 and planta_id = $2`, [cargo_id, planta_id])

    for (const [salario, esperado] of [[800, 80], [1000, 100], [1200, 120]]) {
      await ctx.pool.query(`update colaboradores set salario = $1 where id = $2`, [salario, colaborador_id])
      const colaborador = await colaboradorNoBootstrap(colaborador_id)
      assert.equal(colaborador.salarioBaseCargo, 1000)
      assert.equal(colaborador.faixaAtualPercentual, esperado)
    }
  })

  it('não calcula a faixa quando o salário-base está ausente ou é zero', async () => {
    const { colaborador_id, cargo_id, planta_id } = await contextoDaBianca()

    for (const base of [null, 0]) {
      await ctx.pool.query(`update cargo_plantas set salario_base = $1 where cargo_id = $2 and planta_id = $3`, [base, cargo_id, planta_id])
      const colaborador = await colaboradorNoBootstrap(colaborador_id)
      assert.equal(colaborador.faixaAtualPercentual, null)
    }
  })

  it('aceita IPE de 1 a 5 e rejeita valores fora da escala', async () => {
    const { cargo_id, planta_id } = await contextoDaBianca()
    const valido = await chamar(ctx, USUARIOS.rhLocalJoi, 'PATCH', `/cargos/${cargo_id}/configuracao`, {
      plantaId: planta_id,
      salarioBase: 1000,
      ipe: 5,
    })
    assert.equal(valido.statusCode, 200, valido.body)
    assert.equal(json(valido).configuracao.ipe, 5)

    for (const ipe of [0, 6]) {
      const invalido = await chamar(ctx, USUARIOS.rhLocalJoi, 'PATCH', `/cargos/${cargo_id}/configuracao`, {
        plantaId: planta_id,
        salarioBase: 1000,
        ipe,
      })
      assert.equal(invalido.statusCode, 400, invalido.body)
      assert.equal(json(invalido).error.code, 'PAYLOAD_INVALIDO')
    }
  })

  it('mantém IPE distinto para o mesmo cargo em plantas diferentes e respeita o escopo de escrita', async () => {
    const { cargo_id, planta_id, outra_planta_id } = await contextoDaBianca()
    assert.ok(outra_planta_id)

    const primeiro = await chamar(ctx, USUARIOS.rhLocalJoi, 'PATCH', `/cargos/${cargo_id}/configuracao`, {
      plantaId: planta_id,
      salarioBase: null,
      ipe: 2,
    })
    assert.equal(primeiro.statusCode, 200, primeiro.body)

    const segundo = await chamar(ctx, USUARIOS.rhCentral, 'PATCH', `/cargos/${cargo_id}/configuracao`, {
      plantaId: outra_planta_id,
      salarioBase: null,
      ipe: 5,
    })
    assert.equal(segundo.statusCode, 200, segundo.body)

    const semPerfil = await chamar(ctx, USUARIOS.yasmin, 'PATCH', `/cargos/${cargo_id}/configuracao`, {
      plantaId: planta_id,
      salarioBase: null,
      ipe: 3,
    })
    assert.equal(semPerfil.statusCode, 403, semPerfil.body)

    const foraDoEscopo = await chamar(ctx, USUARIOS.rhLocalJoi, 'PATCH', `/cargos/${cargo_id}/configuracao`, {
      plantaId: outra_planta_id,
      salarioBase: null,
      ipe: 3,
    })
    assert.equal(foraDoEscopo.statusCode, 404, foraDoEscopo.body)

    const bootstrap = await chamar(ctx, USUARIOS.rhCentral, 'GET', '/bootstrap')
    const cargo = json(bootstrap).cargos.find((item: { id: string }) => item.id === cargo_id)
    const ipePorPlanta = new Map(cargo.configuracoesPorPlanta.map((item: { plantaId: string; ipe: number | null }) => [item.plantaId, item.ipe]))
    assert.equal(ipePorPlanta.get(planta_id), 2)
    assert.equal(ipePorPlanta.get(outra_planta_id), 5)
  })
})
