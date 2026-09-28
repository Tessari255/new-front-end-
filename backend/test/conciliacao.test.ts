import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { executarConciliacao, normalizarValor } from '../src/services/conciliacao.ts'
import { chamar, colaboradorPorNome, encerrar, iniciar, json, resetar, USUARIOS, type Ctx } from './helpers.ts'

describe('conciliação Apdata × Employee Central', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  const duplicadas = async () => {
    const { rows } = await ctx.pool.query(
      `select colaborador_id, campo, count(*)::int as n from divergencias
        where status <> 'resolvida' group by 1, 2 having count(*) > 1`,
    )
    return rows
  }
  const contar = async (where = 'true') => {
    const { rows } = await ctx.pool.query(`select count(*)::int as n from divergencias where ${where}`)
    return rows[0].n as number
  }
  const divergirCargo = async (nome: string, valor: string) => {
    const id = await colaboradorPorNome(ctx, nome)
    await ctx.pool.query(`update colaborador_fontes set cargo = $2 where colaborador_id = $1 and fonte = 'employee_central'`, [id, valor])
    return id
  }

  it('normaliza acentos, caixa e espaços antes de comparar', () => {
    assert.equal(normalizarValor('  Coordenação   de Qualidade '), normalizarValor('coordenacao de qualidade'))
    assert.notEqual(normalizarValor('Produção'), normalizarValor('Manutenção'))
  })

  it('execução é idempotente: reexecutar não duplica divergências abertas e persiste cada execução', async () => {
    const antes = await contar()
    assert.equal(antes, 5)
    for (let i = 0; i < 2; i++) {
      const res = await chamar(ctx, USUARIOS.rhCentral, 'POST', '/conciliacoes')
      assert.equal(res.statusCode, 201, res.body)
      const corpo = json(res)
      assert.equal(corpo.conferencia.registrosComparados, 44 * 4)
      assert.equal(corpo.divergencias.length, 5)
      assert.equal(corpo.logs[0].categoria, 'conciliacao')
    }
    assert.equal(await contar(), 5)
    assert.deepEqual(await duplicadas(), [])
    const { rows } = await ctx.pool.query(`select origem, status, registros_comparados, finalizada_em is not null as fim from conciliacoes order by id`)
    assert.equal(rows.length, 3) // 1 do seed + 2 execuções
    assert.deepEqual(rows.slice(1).map((r) => [r.origem, r.status, r.registros_comparados, r.fim]), [['manual', 'concluida', 176, true], ['manual', 'concluida', 176, true]])
  })

  it('RH Local concilia somente as plantas autorizadas', async () => {
    const { rows: plantas } = await ctx.pool.query<{ id: string; codigo: string }>('select id, codigo from plantas where codigo in ($1, $2)', ['JOI', 'GRU'])
    const joi = plantas.find((p) => p.codigo === 'JOI')
    const gru = plantas.find((p) => p.codigo === 'GRU')
    assert.ok(joi && gru)
    const { rows: colaboradores } = await ctx.pool.query<{ id: string; planta_id: string }>('select id, planta_id from colaboradores where planta_id in ($1, $2) order by id', [joi.id, gru.id])
    const colaboradorJoi = colaboradores.find((c) => c.planta_id === joi.id)!
    const colaboradorGru = colaboradores.find((c) => c.planta_id === gru.id)!
    await ctx.pool.query(`update colaborador_fontes set cargo = 'Cargo local JOI' where colaborador_id = $1 and fonte = 'employee_central'`, [colaboradorJoi.id])
    await ctx.pool.query(`update colaborador_fontes set cargo = 'Cargo bloqueado GRU' where colaborador_id = $1 and fonte = 'employee_central'`, [colaboradorGru.id])

    const resposta = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', '/conciliacoes')
    assert.equal(resposta.statusCode, 201, resposta.body)
    const corpo = json<{ conferencia: { registrosComparados: number }; colaboradores: Array<{ plantaId: string }> }>(resposta)
    assert.equal(corpo.conferencia.registrosComparados, corpo.colaboradores.length * 4)
    assert.ok(corpo.colaboradores.every((c) => c.plantaId === joi.id))
    const { rows: geradas } = await ctx.pool.query<{ colaborador_id: string; valor_employee_central: string }>(
      `select colaborador_id, valor_employee_central from divergencias where campo = 'cargo' and valor_employee_central in ('Cargo local JOI', 'Cargo bloqueado GRU')`,
    )
    assert.deepEqual(geradas, [{ colaborador_id: colaboradorJoi.id, valor_employee_central: 'Cargo local JOI' }])
  })

  it('detecta divergência nova, atribui responsável e resolve com justificativa; reabre se a diferença persiste', async () => {
    const colab = await divergirCargo('Camila Ferreira Duarte', 'Cargo Legado Inexistente')
    const run1 = json(await chamar(ctx, USUARIOS.rhCentral, 'POST', '/conciliacoes'))
    assert.equal(run1.divergencias.length, 6)
    const nova = run1.divergencias.find((d: { colaboradorId: string; campo: string }) => d.colaboradorId === colab && d.campo === 'cargo')
    assert.ok(nova)
    assert.equal(nova.status, 'aberta')
    assert.equal(nova.valorEmployeeCentral, 'Cargo Legado Inexistente')
    assert.equal(nova.responsavelId, null)
    assert.equal(run1.colaboradores.find((c: { id: string }) => c.id === colab).externos.statusSincronizacao, 'divergente')

    json(await chamar(ctx, USUARIOS.rhCentral, 'POST', '/conciliacoes'))
    assert.equal(await contar(), 6)
    assert.deepEqual(await duplicadas(), [])

    // Atribuição: só RH; responsável precisa ser colaborador ativo de RH.
    const simone = await colaboradorPorNome(ctx, 'Simone Rezende Costa')
    const naoRh = await colaboradorPorNome(ctx, 'Camila Ferreira Duarte')
    assert.equal((await chamar(ctx, USUARIOS.yasmin, 'PATCH', `/divergencias/${nova.id}/responsavel`, { responsavelId: simone })).statusCode, 403)
    const invalido = await chamar(ctx, USUARIOS.rhCentral, 'PATCH', `/divergencias/${nova.id}/responsavel`, { responsavelId: naoRh })
    assert.equal(invalido.statusCode, 422)
    assert.equal(json(invalido).error.code, 'RESPONSAVEL_INVALIDO')
    const atrib = await chamar(ctx, USUARIOS.rhCentral, 'PATCH', `/divergencias/${nova.id}/responsavel`, { responsavelId: simone })
    assert.equal(atrib.statusCode, 200, atrib.body)
    assert.equal(json(atrib).divergencia.status, 'em_tratamento')
    assert.equal(json(atrib).divergencia.responsavelId, simone)

    // Resolução: justificativa mínima de 10 caracteres.
    const curta = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/divergencias/${nova.id}/resolucao`, { justificativa: 'curta' })
    assert.equal(curta.statusCode, 422)
    assert.ok(json(curta).error.fieldErrors.justificativa)
    const ok = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/divergencias/${nova.id}/resolucao`, { justificativa: 'Employee Central corrigido após confirmação.' })
    assert.equal(ok.statusCode, 200, ok.body)
    const resolvida = json(ok)
    assert.equal(resolvida.divergencia.status, 'resolvida')
    assert.ok(resolvida.divergencia.resolvidaEm)
    assert.equal(resolvida.divergencia.justificativaResolucao, 'Employee Central corrigido após confirmação.')
    assert.equal(resolvida.colaborador.externos.statusSincronizacao, 'sincronizado')
    assert.equal((await chamar(ctx, USUARIOS.rhCentral, 'POST', `/divergencias/${nova.id}/resolucao`, { justificativa: 'Tentativa repetida de resolução.' })).statusCode, 409)
    assert.equal((await chamar(ctx, USUARIOS.rhCentral, 'PATCH', `/divergencias/${nova.id}/responsavel`, { responsavelId: simone })).statusCode, 409)

    // Diferença ainda presente na fonte: a próxima conferência reabre a mesma divergência (sem duplicar).
    const run3 = json(await chamar(ctx, USUARIOS.rhCentral, 'POST', '/conciliacoes'))
    const reaberta = run3.divergencias.find((d: { id: string }) => d.id === nova.id)
    assert.equal(reaberta.status, 'aberta')
    assert.equal(reaberta.resolvidaEm, undefined)
    assert.equal(await contar(), 6)
    assert.deepEqual(await duplicadas(), [])
  })

  it('divergência de outra planta é 404 para RH Local; auditoria não executa nem altera', async () => {
    const { rows } = await ctx.pool.query(`select d.id from divergencias d join plantas p on p.id = d.planta_id where p.codigo = 'GRU' and d.status = 'aberta' limit 1`)
    const idGru = rows[0].id
    const simone = await colaboradorPorNome(ctx, 'Simone Rezende Costa')
    assert.equal((await chamar(ctx, USUARIOS.rhLocalJoi, 'PATCH', `/divergencias/${idGru}/responsavel`, { responsavelId: simone })).statusCode, 404)
    assert.equal((await chamar(ctx, USUARIOS.rhLocalGru, 'PATCH', `/divergencias/${idGru}/responsavel`, { responsavelId: simone })).statusCode, 200)
    assert.equal((await chamar(ctx, USUARIOS.auditoria, 'POST', '/conciliacoes')).statusCode, 403)
    assert.equal((await chamar(ctx, USUARIOS.auditoria, 'POST', `/divergencias/${idGru}/resolucao`, { justificativa: 'Tentativa da auditoria aqui.' })).statusCode, 403)
    assert.equal((await chamar(ctx, USUARIOS.rhCentral, 'PATCH', '/divergencias/abc/responsavel', { responsavelId: simone })).statusCode, 400)
  })

  it('execuções simultâneas não duplicam e o comando agendado usa o mesmo caso de uso', async () => {
    await divergirCargo('Diego Martins Pereira', 'Outro Cargo Legado')
    const [a, b] = await Promise.all([
      chamar(ctx, USUARIOS.rhCentral, 'POST', '/conciliacoes'),
      chamar(ctx, USUARIOS.rhCentral, 'POST', '/conciliacoes'),
    ])
    for (const r of [a, b]) assert.ok([201, 409].includes(r.statusCode), String(r.statusCode))
    assert.deepEqual(await duplicadas(), [])
    assert.equal(await contar(), 6)

    const cli = await executarConciliacao(ctx.pool, { origem: 'agendada' })
    assert.equal(cli.registrosComparados, 176)
    assert.equal(cli.divergenciasCriadas, 0)
    const { rows } = await ctx.pool.query(`select origem, status from conciliacoes where id = $1`, [cli.conciliacaoId])
    assert.deepEqual(rows[0], { origem: 'agendada', status: 'concluida' })
  })

  it('falha durante a execução é persistida com status "erro" e sem efeitos parciais', async () => {
    await divergirCargo('Eduarda Ribeiro Alves', 'Cargo Que Vai Falhar')
    await ctx.pool.query(`create function falhar_teste() returns trigger language plpgsql as $$ begin raise exception 'falha simulada no teste'; end; $$`)
    await ctx.pool.query(`create trigger falhar_teste before insert on divergencias for each row execute function falhar_teste()`)
    try {
      const res = await chamar(ctx, USUARIOS.rhCentral, 'POST', '/conciliacoes')
      assert.equal(res.statusCode, 500)
      assert.ok(!res.body.includes('falha simulada'), 'detalhes internos não vazam para o cliente')
      assert.ok(json(res).error.correlationId)
    } finally {
      await ctx.pool.query('drop trigger falhar_teste on divergencias')
      await ctx.pool.query('drop function falhar_teste()')
    }
    const { rows } = await ctx.pool.query(`select status, erro, finalizada_em is not null as fim from conciliacoes order by id desc limit 1`)
    assert.equal(rows[0].status, 'erro')
    assert.match(rows[0].erro, /falha simulada/)
    assert.equal(rows[0].fim, true)
    assert.equal(await contar(), 5)
    const { rows: logs } = await ctx.pool.query(`select status, erro from logs_integracao where categoria = 'conciliacao' order by id desc limit 1`)
    assert.equal(logs[0].status, 'erro')
    assert.ok(!String(logs[0].erro).includes('falha simulada'), 'log visível não expõe mensagem interna')
  })
})
