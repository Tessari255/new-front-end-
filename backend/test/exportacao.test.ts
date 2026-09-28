import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { chamar, encerrar, iniciar, json, resetar, sha256, USUARIOS, type Ctx } from './helpers.ts'

describe('exportações demonstrativas', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  const idPorProtocolo = async (protocolo: string) => {
    const { rows } = await ctx.pool.query('select id from movimentacoes where protocolo = $1', [protocolo])
    return rows[0].id as string
  }

  it('gera a carga Apdata (CSV) de movimentação aprovada e audita hash, autor, timestamp e evento', async () => {
    const id = await idPorProtocolo('MOV-2026-0001') // promoção aprovada
    const antes = json(await chamar(ctx, USUARIOS.rhCentral, 'GET', `/movimentacoes/${id}`))
    const res = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/exportacoes/apdata`)
    assert.equal(res.statusCode, 200, res.body)
    assert.match(String(res.headers['content-disposition']), /attachment; filename="apdata-demo-MOV-2026-0001\.csv"/)
    assert.match(String(res.headers['content-type']), /^text\/csv/)
    const texto = res.body
    assert.ok(texto.startsWith('AMBIENTE;DEMONSTRACAO'))
    assert.ok(texto.includes('FORMATO;DEMONSTRATIVO — nao homologado'))
    assert.ok(texto.includes('MOV-2026-0001;'))
    assert.ok(texto.includes('Cargo + Salário'), 'promoção altera cargo e salário')
    assert.equal(res.headers['x-arquivo-sha256'], sha256(res.rawPayload))

    const { rows } = await ctx.pool.query('select tipo, nome_arquivo, sha256, autor_id, autor_nome, tamanho_bytes from exports where movimentacao_id = $1', [id])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].tipo, 'apdata')
    assert.equal(rows[0].sha256, sha256(res.rawPayload))
    assert.equal(rows[0].autor_id, ctx.ids[USUARIOS.rhCentral])
    assert.equal(rows[0].tamanho_bytes, res.rawPayload.length)

    const depois = json(await chamar(ctx, USUARIOS.rhCentral, 'GET', `/movimentacoes/${id}`))
    assert.equal(depois.historico.length, antes.historico.length + 1)
    const evento = depois.historico[depois.historico.length - 1]
    assert.equal(evento.tipo, 'geracao_arquivo')
    assert.equal(evento.autor, 'RH Central — Sede Corporativa')
    assert.notEqual(depois.movimentacao.arquivosGerados.apdataGeradoEm, antes.movimentacao.arquivosGerados.apdataGeradoEm)
    assert.equal(depois.movimentacao.arquivosGerados.apdataGeradoEm, res.headers['x-gerado-em'])
    const { rows: logs } = await ctx.pool.query(`select acao, status from logs_integracao where categoria = 'exportacao'`)
    assert.deepEqual(logs, [{ acao: 'Gerar carga Apdata', status: 'sucesso' }])
  })

  it('gera o arquivo Employee Central (JSON) demonstrativo, marcado como não homologado', async () => {
    const id = await idPorProtocolo('MOV-2026-0010') // alteração salarial aprovada
    const res = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/exportacoes/employee-central`)
    assert.equal(res.statusCode, 200, res.body)
    assert.match(String(res.headers['content-disposition']), /employee-central-demo-MOV-2026-0010\.json/)
    const payload = JSON.parse(res.body)
    assert.equal(payload.ambiente, 'DEMONSTRACAO')
    assert.equal(payload.formato, 'DEMONSTRATIVO_NAO_HOMOLOGADO')
    assert.equal(payload.protocolo, 'MOV-2026-0010')
    assert.equal(payload.movimentacao.campoAlterado, 'Salário')
    assert.match(payload.movimentacao.valorNovo, /R\$/)
    const { rows } = await ctx.pool.query(`select tipo from exports where movimentacao_id = $1`, [id])
    assert.deepEqual(rows, [{ tipo: 'employee_central' }])
  })

  it('só movimentações aprovadas geram arquivos (409) e a tentativa fica no log de integração', async () => {
    for (const protocolo of ['MOV-2026-0003', 'MOV-2026-0006', 'MOV-2026-0005', 'MOV-2026-0007']) {
      // em andamento, rascunho, devolvida, reprovada
      const id = await idPorProtocolo(protocolo)
      const res = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/exportacoes/apdata`)
      assert.equal(res.statusCode, 409, protocolo)
      assert.equal(json(res).error.code, 'MOVIMENTACAO_NAO_APROVADA')
    }
    const { rows } = await ctx.pool.query('select count(*)::int as n from exports')
    assert.equal(rows[0].n, 0)
    const { rows: logs } = await ctx.pool.query(`select status from logs_integracao where categoria = 'exportacao'`)
    assert.equal(logs.length, 4)
    assert.ok(logs.every((l) => l.status === 'erro'))
  })

  it('somente RH Central exporta; inexistente é 404', async () => {
    const id = await idPorProtocolo('MOV-2026-0001')
    for (const subject of [USUARIOS.rhLocalGru, USUARIOS.yasmin, USUARIOS.auditoria]) {
      const res = await chamar(ctx, subject, 'POST', `/movimentacoes/${id}/exportacoes/employee-central`)
      assert.equal(res.statusCode, 403, subject)
    }
    assert.equal((await chamar(ctx, USUARIOS.rhCentral, 'POST', '/movimentacoes/99999/exportacoes/apdata')).statusCode, 404)
    assert.equal((await chamar(ctx, null, 'POST', `/movimentacoes/${id}/exportacoes/apdata`)).statusCode, 401)
    const { rows } = await ctx.pool.query('select count(*)::int as n from exports')
    assert.equal(rows[0].n, 0)
  })

  it('CSV neutraliza separadores e quebras de linha da justificativa', async () => {
    const id = await idPorProtocolo('MOV-2026-0001')
    await ctx.pool.query(`update movimentacoes set justificativa = $2 where id = $1`, [id, 'linha um;com ponto e vírgula\nlinha dois'])
    const res = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/exportacoes/apdata`)
    const linhas = res.body.split('\n')
    assert.equal(linhas.length, 6)
    assert.ok(linhas[5]!.endsWith('linha um,com ponto e vírgula,linha dois'))
    assert.equal(linhas[5]!.split(';').length, linhas[4]!.split(';').length)
  })
})
