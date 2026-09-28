import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { chamar, colaboradorPorNome, encerrar, iniciar, json, resetar, USUARIOS, type Ctx } from './helpers.ts'

describe('aprovação dupla (gestor de destino em transferência de localidade)', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  const decidir = (subject: string, id: string, decisao: string, comentario?: string) =>
    chamar(ctx, subject, 'POST', `/movimentacoes/${id}/decisoes`, { decisao, comentario })

  /** Bianca (Joinville, gestora Yasmin) transferida para Guarulhos, com o gestor de demo.gestor.col-gru-02 (USUARIOS.brunoGru) como destino. */
  async function criarTransferenciaLocalidade(comGestorDestino: boolean) {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const { rows: gestorDestino } = await ctx.pool.query(
      `select c.id, c.nome from usuarios u join colaboradores c on c.id = u.colaborador_id where u.subject = 'demo.gestor.col-gru-02'`,
    )
    const bruno = gestorDestino[0].id as string
    const nomeBruno = gestorDestino[0].nome as string
    const { rows } = await ctx.pool.query(
      `select cc.id, cc.planta_id from centros_custo cc join plantas p on p.id = cc.planta_id where p.codigo = 'GRU' order by cc.id limit 1`,
    )
    const ccGru = rows[0].id as string
    const plantaGru = rows[0].planta_id as string
    // Criado pelo RH Local (não pelo gestor) para preservar a etapa gestor normalmente.
    const criada = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', '/movimentacoes', {
      colaboradorId: bianca,
      tipo: 'transferencia_localidade',
      vigencia: '2026-11-01',
      justificativa: 'Transferência de localidade por necessidade operacional da unidade de destino.',
      alteracao: {
        tipo: 'transferencia_localidade',
        plantaPropostaId: plantaGru,
        centroCustoPropostoId: ccGru,
        gestorPropostoId: comGestorDestino ? bruno : null,
      },
    })
    if (criada.statusCode !== 201) throw new Error(`criação falhou: ${criada.body}`)
    const id = json(criada).movimentacao.id as string
    const enviada = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', `/movimentacoes/${id}/enviar`)
    if (enviada.statusCode !== 200) throw new Error(`envio falhou: ${enviada.body}`)
    return { id, protocolo: json(enviada).movimentacao.protocolo as string, nomeGestorDestino: nomeBruno }
  }

  it('sem gestor de destino informado: aprovação única do gestor de origem já avança para RH Local', async () => {
    const { id } = await criarTransferenciaLocalidade(false)
    const res = await decidir(USUARIOS.yasmin, id, 'aprovado')
    assert.equal(res.statusCode, 200, res.body)
    assert.equal(json(res).movimentacao.etapaAtual, 'rh_local')
    assert.equal(json(res).movimentacao.decisoes.filter((d: { etapa: string }) => d.etapa === 'gestor').length, 1)
  })

  it('com gestor de destino: exige aprovação de ambos antes de avançar; qualquer ordem funciona', async () => {
    const { id, nomeGestorDestino } = await criarTransferenciaLocalidade(true)

    const r1 = await decidir(USUARIOS.yasmin, id, 'aprovado')
    assert.equal(r1.statusCode, 200, r1.body)
    assert.equal(json(r1).movimentacao.status, 'em_andamento')
    assert.equal(json(r1).movimentacao.etapaAtual, 'gestor', 'não deve avançar com só uma das duas aprovações')
    assert.equal(json(r1).movimentacao.decisoes.filter((d: { etapa: string }) => d.etapa === 'gestor').length, 1)

    // Outro gestor qualquer (nem origem nem destino) continua proibido.
    assert.equal((await decidir(USUARIOS.thiagoJoi, id, 'aprovado')).statusCode, 403)

    const r2 = await decidir(USUARIOS.brunoGru, id, 'aprovado')
    assert.equal(r2.statusCode, 200, r2.body)
    assert.equal(json(r2).movimentacao.status, 'em_andamento')
    assert.equal(json(r2).movimentacao.etapaAtual, 'rh_local', 'com as duas aprovações, avança para RH Local')
    const decisoesGestor = json(r2).movimentacao.decisoes.filter((d: { etapa: string }) => d.etapa === 'gestor')
    assert.equal(decisoesGestor.length, 2)
    assert.deepEqual(decisoesGestor.map((d: { aprovadorNome: string }) => d.aprovadorNome).sort(), [nomeGestorDestino, 'Yasmin Rodrigues Freitas'].sort())
  })

  it('o mesmo gestor não pode aprovar duas vezes na etapa (409)', async () => {
    const { id } = await criarTransferenciaLocalidade(true)
    assert.equal((await decidir(USUARIOS.yasmin, id, 'aprovado')).statusCode, 200)
    const repetida = await decidir(USUARIOS.yasmin, id, 'aprovado')
    assert.equal(repetida.statusCode, 409, repetida.body)
    assert.equal(json(repetida).error.code, 'CONFLITO_DE_ESTADO')
  })

  it('devolução ou reprovação de qualquer um dos dois se aplica imediatamente, sem esperar o outro', async () => {
    const { id: idDevolvida } = await criarTransferenciaLocalidade(true)
    const dev = await decidir(USUARIOS.brunoGru, idDevolvida, 'devolvido', 'Centro de custo de destino ainda não tem orçamento aprovado.')
    assert.equal(dev.statusCode, 200, dev.body)
    assert.equal(json(dev).movimentacao.status, 'devolvida')
    assert.equal(json(dev).movimentacao.etapaAtual, 'gestor')

    const { id: idReprovada } = await criarTransferenciaLocalidade(true)
    const rep = await decidir(USUARIOS.yasmin, idReprovada, 'reprovado', 'Colaboradora não confirmou disponibilidade para mudança de cidade.')
    assert.equal(rep.statusCode, 200, rep.body)
    assert.equal(json(rep).movimentacao.status, 'reprovada')
  })

  it('ambos aprovam, depois RH Local e RH Central concluem o fluxo normalmente', async () => {
    const { id } = await criarTransferenciaLocalidade(true)
    await decidir(USUARIOS.yasmin, id, 'aprovado')
    await decidir(USUARIOS.brunoGru, id, 'aprovado')
    const rhLocal = await decidir(USUARIOS.rhLocalJoi, id, 'aprovado', 'Conferido com a política da planta de origem.')
    assert.equal(json(rhLocal).movimentacao.etapaAtual, 'rh_central')
    const rhCentral = await decidir(USUARIOS.rhCentral, id, 'aprovado')
    assert.equal(json(rhCentral).movimentacao.status, 'aprovada')
    assert.equal(json(rhCentral).movimentacao.decisoes.length, 4)
  })
})
