import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { chamar, colaboradorPorNome, encerrar, iniciar, json, resetar, USUARIOS, type Ctx } from './helpers.ts'

describe('fechamento mensal da folha (Share)', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  it('estado inicial é liberado; só Share trava/libera; mês é normalizado ao dia 1', async () => {
    const inicial = json(await chamar(ctx, USUARIOS.rhCentral, 'GET', '/folha'))
    assert.equal(inicial.mesTravado, null)

    for (const subject of [USUARIOS.rhCentral, USUARIOS.rhLocalJoi, USUARIOS.yasmin, USUARIOS.auditoria]) {
      const res = await chamar(ctx, subject, 'POST', '/folha/travar', { mes: '2026-09' })
      assert.equal(res.statusCode, 403, subject)
    }

    const travado = await chamar(ctx, USUARIOS.share, 'POST', '/folha/travar', { mes: '2026-09-15' })
    assert.equal(travado.statusCode, 200, travado.body)
    assert.equal(json(travado).fechamento.mesTravado, '2026-09-01')
    assert.equal(json(travado).fechamento.travadoPorNome, 'Share — Fechamento da Folha')

    const estado = json(await chamar(ctx, USUARIOS.rhCentral, 'GET', '/folha'))
    assert.equal(estado.mesTravado, '2026-09-01')
  })

  it('formato de mês inválido é 400 (schema); travar com a folha já travada é 409', async () => {
    const invalido = await chamar(ctx, USUARIOS.share, 'POST', '/folha/travar', { mes: '15/09/2026' })
    assert.equal(invalido.statusCode, 400)
    assert.equal(json(invalido).error.code, 'PAYLOAD_INVALIDO')

    assert.equal((await chamar(ctx, USUARIOS.share, 'POST', '/folha/travar', { mes: '2026-09' })).statusCode, 200)
    const segunda = await chamar(ctx, USUARIOS.share, 'POST', '/folha/travar', { mes: '2026-10' })
    assert.equal(segunda.statusCode, 409)
    assert.equal(json(segunda).error.code, 'FOLHA_JA_TRAVADA')
  })

  it('liberar exige Share, reabre a folha e não pode ser repetido sem travar de novo', async () => {
    await chamar(ctx, USUARIOS.share, 'POST', '/folha/travar', { mes: '2026-09' })
    assert.equal((await chamar(ctx, USUARIOS.rhCentral, 'POST', '/folha/liberar')).statusCode, 403)

    const liberado = await chamar(ctx, USUARIOS.share, 'POST', '/folha/liberar')
    assert.equal(liberado.statusCode, 200)
    assert.equal(json(liberado).fechamento.mesTravado, null)

    const repetido = await chamar(ctx, USUARIOS.share, 'POST', '/folha/liberar')
    assert.equal(repetido.statusCode, 409)
    assert.equal(json(repetido).error.code, 'FOLHA_JA_LIBERADA')
  })

  it('bloqueia o envio de movimentação com vigência no mês travado e sugere o mês seguinte (também não bloqueia meses não travados)', async () => {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const criada = json(
      await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', '/movimentacoes', {
        colaboradorId: bianca,
        tipo: 'mudanca_gestor',
        vigencia: '2026-09-20',
        justificativa: 'Reestruturação da coordenação de Qualidade, com alinhamento prévio entre as partes.',
        alteracao: { tipo: 'mudanca_gestor', gestorPropostoId: await colaboradorPorNome(ctx, 'Mariana Oliveira Castro') },
      }),
    )
    const id = criada.movimentacao.id as string

    await chamar(ctx, USUARIOS.share, 'POST', '/folha/travar', { mes: '2026-09' })
    const bloqueado = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', `/movimentacoes/${id}/enviar`)
    assert.equal(bloqueado.statusCode, 422, bloqueado.body)
    assert.equal(json(bloqueado).error.code, 'FOLHA_FECHADA')
    assert.match(json(bloqueado).error.fieldErrors.vigencia, /2026-10-01/)
    const estadoAposBloqueio = json(await chamar(ctx, USUARIOS.rhLocalJoi, 'GET', `/movimentacoes/${id}`)).movimentacao
    assert.equal(estadoAposBloqueio.status, 'rascunho')

    // Ajusta para a data sugerida (mês seguinte, já liberado): envio segue normalmente.
    await chamar(ctx, USUARIOS.rhLocalJoi, 'PATCH', `/movimentacoes/${id}/rascunho`, {
      colaboradorId: bianca,
      tipo: 'mudanca_gestor',
      vigencia: '2026-10-01',
      justificativa: 'Reestruturação da coordenação de Qualidade, com alinhamento prévio entre as partes.',
      alteracao: { tipo: 'mudanca_gestor', gestorPropostoId: await colaboradorPorNome(ctx, 'Mariana Oliveira Castro') },
    })
    const enviado = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', `/movimentacoes/${id}/enviar`)
    assert.equal(enviado.statusCode, 200, enviado.body)
  })

  it('liberação do RH para a Folha é um gate distinto: só RH Central, só aprovada, não duplica', async () => {
    const { rows } = await ctx.pool.query(`select id from movimentacoes where protocolo = 'MOV-2026-0001'`) // promoção aprovada
    const id = rows[0].id as string
    const { rows: pendente } = await ctx.pool.query(`select id from movimentacoes where protocolo = 'MOV-2026-0003'`) // em andamento
    const idPendente = pendente[0].id as string

    for (const subject of [USUARIOS.rhLocalJoi, USUARIOS.yasmin, USUARIOS.auditoria]) {
      assert.equal((await chamar(ctx, subject, 'POST', `/movimentacoes/${id}/liberar-folha`)).statusCode, 403, subject)
    }
    const naoAprovada = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${idPendente}/liberar-folha`)
    assert.equal(naoAprovada.statusCode, 409)
    assert.equal(json(naoAprovada).error.code, 'MOVIMENTACAO_NAO_APROVADA')

    const liberada = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/liberar-folha`)
    assert.equal(liberada.statusCode, 200, liberada.body)
    assert.ok(json(liberada).movimentacao.rhLiberadaFolhaEm)

    const duplicada = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/liberar-folha`)
    assert.equal(duplicada.statusCode, 409)
    assert.equal(json(duplicada).error.code, 'JA_LIBERADA_PARA_FOLHA')
  })

  it('geração de arquivos exige as três liberações: fluxo aprovado, RH liberou para a Folha e mês de vigência não travado', async () => {
    const { rows } = await ctx.pool.query(`select id, vigencia from movimentacoes where protocolo = 'MOV-2026-0001'`)
    const id = rows[0].id as string
    const vigencia = rows[0].vigencia as string

    // 1) Aprovada, mas RH ainda não liberou para a Folha.
    const semLiberacao = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/exportacoes/apdata`)
    assert.equal(semLiberacao.statusCode, 409, semLiberacao.body)
    assert.equal(json(semLiberacao).error.code, 'NAO_LIBERADA_PARA_FOLHA')

    await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/liberar-folha`)

    // 2) Liberada, mas o mês da vigência está travado pelo Share.
    await chamar(ctx, USUARIOS.share, 'POST', '/folha/travar', { mes: vigencia.slice(0, 7) })
    const travada = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/exportacoes/apdata`)
    assert.equal(travada.statusCode, 422, travada.body)
    assert.equal(json(travada).error.code, 'FOLHA_FECHADA')

    // 3) Share libera o mês: as três condições estão satisfeitas, geração funciona.
    await chamar(ctx, USUARIOS.share, 'POST', '/folha/liberar')
    const ok = await chamar(ctx, USUARIOS.rhCentral, 'POST', `/movimentacoes/${id}/exportacoes/apdata`)
    assert.equal(ok.statusCode, 200, ok.body)
  })
})
