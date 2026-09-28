import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { chamar, colaboradorPorNome, encerrar, iniciar, json, resetar, USUARIOS, type Ctx } from './helpers.ts'

describe('chamados (múltiplas alterações) e cancelamento', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  async function criarRascunhoMeritoBianca(chamadoPaiId?: string) {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const res = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', '/movimentacoes', {
      colaboradorId: bianca,
      tipo: 'merito',
      vigencia: '2026-11-01',
      justificativa: 'Mérito por desempenho no ciclo — reconhecimento anual da unidade.',
      alteracao: { tipo: 'merito', salarioProposto: 9500 },
      chamadoPaiId: chamadoPaiId ?? null,
    })
    return res
  }

  it('cria uma segunda alteração no mesmo chamado: ambas compartilham chamadoId, a raiz continua com chamadoPaiId nulo', async () => {
    const raiz = await criarRascunhoMeritoBianca()
    assert.equal(raiz.statusCode, 201, raiz.body)
    const movRaiz = json(raiz).movimentacao
    assert.equal(movRaiz.chamadoId, movRaiz.id)
    assert.equal(movRaiz.chamadoPaiId, null)

    const filha = await criarRascunhoMeritoBianca(movRaiz.id)
    assert.equal(filha.statusCode, 201, filha.body)
    const movFilha = json(filha).movimentacao
    assert.equal(movFilha.chamadoId, movRaiz.id, 'a segunda alteração deve apontar para a raiz do chamado')
    assert.equal(movFilha.chamadoPaiId, movRaiz.id)
    assert.notEqual(movFilha.id, movRaiz.id)
  })

  it('referenciar qualquer alteração do chamado (não só a raiz) resolve para a mesma raiz', async () => {
    const raiz = json(await criarRascunhoMeritoBianca()).movimentacao
    const filha = json(await criarRascunhoMeritoBianca(raiz.id)).movimentacao
    const neta = json(await criarRascunhoMeritoBianca(filha.id)).movimentacao
    assert.equal(neta.chamadoId, raiz.id, 'anexar a uma alteração não-raiz deve normalizar para a raiz do chamado')
    assert.equal(neta.chamadoPaiId, raiz.id)
  })

  it('rejeita anexar a um chamado de outro colaborador (422)', async () => {
    const raizBianca = json(await criarRascunhoMeritoBianca()).movimentacao
    const outro = await colaboradorPorNome(ctx, 'Mariana Oliveira Castro')
    const res = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', '/movimentacoes', {
      colaboradorId: outro,
      tipo: 'merito',
      vigencia: '2026-11-01',
      justificativa: 'Mérito por desempenho no ciclo — reconhecimento anual da unidade.',
      alteracao: { tipo: 'merito', salarioProposto: 8000 },
      chamadoPaiId: raizBianca.id,
    })
    assert.equal(res.statusCode, 422, res.body)
    assert.equal(json(res).error.code, 'CHAMADO_COLABORADOR_DIVERGENTE')
  })

  it('cancelar uma alteração do chamado não afeta as demais', async () => {
    const raiz = json(await criarRascunhoMeritoBianca()).movimentacao
    const filha = json(await criarRascunhoMeritoBianca(raiz.id)).movimentacao

    const cancelada = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', `/movimentacoes/${filha.id}/cancelar`)
    assert.equal(cancelada.statusCode, 200, cancelada.body)
    assert.equal(json(cancelada).movimentacao.status, 'cancelada')

    const raizAtualizada = await chamar(ctx, USUARIOS.rhLocalJoi, 'GET', `/movimentacoes/${raiz.id}`)
    assert.equal(json(raizAtualizada).movimentacao.status, 'rascunho', 'a raiz do chamado não deve ser afetada pelo cancelamento da outra alteração')
  })

  it('cancelamento fica registrado no histórico com o tipo "cancelamento"', async () => {
    const raiz = json(await criarRascunhoMeritoBianca()).movimentacao
    const res = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', `/movimentacoes/${raiz.id}/cancelar`)
    assert.equal(res.statusCode, 200, res.body)
    const evento = json(res).historico.find((e: { tipo: string }) => e.tipo === 'cancelamento')
    assert.ok(evento, 'deve haver um evento de cancelamento no histórico')
  })

  it('não permite cancelar duas vezes, nem cancelar uma solicitação já aprovada (409)', async () => {
    const raiz = json(await criarRascunhoMeritoBianca()).movimentacao
    const primeira = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', `/movimentacoes/${raiz.id}/cancelar`)
    assert.equal(primeira.statusCode, 200, primeira.body)
    const segunda = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', `/movimentacoes/${raiz.id}/cancelar`)
    assert.equal(segunda.statusCode, 409, segunda.body)
    assert.equal(json(segunda).error.code, 'MOVIMENTACAO_NAO_CANCELAVEL')
  })

  it('perfil auditoria (somente leitura) não pode cancelar', async () => {
    const raiz = json(await criarRascunhoMeritoBianca()).movimentacao
    const res = await chamar(ctx, USUARIOS.auditoria, 'POST', `/movimentacoes/${raiz.id}/cancelar`)
    assert.equal(res.statusCode, 403, res.body)
  })
})
