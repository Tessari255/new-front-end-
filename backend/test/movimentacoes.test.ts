import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import {
  anexar, chamar, colaboradorPorNome, criarMudancaGestorEnviada, criarMudancaGestorEnviadaPorRH, encerrar, idPorNome, iniciar, json,
  PDF_VALIDO, resetar, USUARIOS, type Ctx,
} from './helpers.ts'

describe('regras de envio', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  async function rascunhoSalarial(salarioProposto: number, justificativa = 'Ajuste salarial conforme política de mercado.') {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const res = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', {
      colaboradorId: bianca, tipo: 'alteracao_salarial', vigencia: '2026-10-01', justificativa,
      alteracao: { tipo: 'alteracao_salarial', salarioProposto },
    })
    assert.equal(res.statusCode, 201)
    return json(res).movimentacao.id as string
  }

  it('envio é bloqueado por checagem bloqueante (evidência obrigatória ausente) e não muda o estado', async () => {
    const id = await rascunhoSalarial(4300)
    const res = await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${id}/enviar`)
    assert.equal(res.statusCode, 422)
    const erro = json(res).error
    assert.equal(erro.code, 'MOVIMENTACAO_INVALIDA')
    assert.ok(erro.fieldErrors.arquivos)
    assert.match(erro.fieldErrors.checagens, /Evidência obrigatória/)
    const estado = json(await chamar(ctx, USUARIOS.yasmin, 'GET', `/movimentacoes/${id}`)).movimentacao
    assert.equal(estado.status, 'rascunho')
  })

  it('envio é bloqueado por justificativa curta, vigência inválida e salário igual ao atual', async () => {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const { rows } = await ctx.pool.query('select salario from colaboradores where id = $1', [bianca])
    const res = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', {
      colaboradorId: bianca, tipo: 'alteracao_salarial', vigencia: '2026-13-45', justificativa: 'curta',
      alteracao: { tipo: 'alteracao_salarial', salarioProposto: rows[0].salario },
    })
    const id = json(res).movimentacao.id
    const envio = await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${id}/enviar`)
    assert.equal(envio.statusCode, 422)
    const f = json(envio).error.fieldErrors
    assert.ok(f.justificativa && f.vigencia && f.salarioProposto && f.arquivos, JSON.stringify(f))
  })

  it('salário fora da faixa do cargo é apenas aviso: envio é aceito', async () => {
    const id = await rascunhoSalarial(99999)
    const anexo = await anexar(ctx, USUARIOS.yasmin, id, { nome: 'memo.pdf', mime: 'application/pdf', conteudo: PDF_VALIDO })
    assert.equal(anexo.statusCode, 201)
    const faixa = json(anexo).movimentacao.checagens.find((c: { descricao: string }) => c.descricao.includes('faixa'))
    assert.equal(faixa.severidade, 'aviso')
    assert.equal(faixa.atendida, false)

    const envio = await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${id}/enviar`)
    assert.equal(envio.statusCode, 200, envio.body)
    const mov = json(envio).movimentacao
    assert.equal(mov.status, 'em_andamento')
    // Yasmin é a gestora direta de Bianca: pela regra "gestor não aprova a própria solicitação",
    // o envio pula direto para RH Local.
    assert.equal(mov.etapaAtual, 'rh_local')
    assert.ok(json(envio).historico.some((e: { tipo: string }) => e.tipo === 'validacao'))
  })

  it('mudança de gestor: obrigatório, diferente do atual e do próprio colaborador, ativo e gestor', async () => {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const atual = await colaboradorPorNome(ctx, 'Yasmin Rodrigues Freitas')
    const naoGestor = await colaboradorPorNome(ctx, 'Vanessa Pires Guimarães')
    const testar = async (gestorPropostoId: string | null, campo: RegExp) => {
      const res = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', {
        colaboradorId: bianca, tipo: 'mudanca_gestor', vigencia: '2026-10-01', justificativa: 'Reestruturação da linha de reporte.',
        alteracao: { tipo: 'mudanca_gestor', gestorPropostoId },
      })
      const envio = await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${json(res).movimentacao.id}/enviar`)
      assert.equal(envio.statusCode, 422)
      assert.match(json(envio).error.fieldErrors.gestorPropostoId, campo)
    }
    await testar(null, /diferente do atual/) // sem informar cai no gestor atual
    await testar(atual, /diferente do atual/)
    await testar(bianca, /próprio colaborador/)
    await testar(naoGestor, /perfil de gestor/)
  })

  it('cargo precisa ser permitido na planta; transferência de CC só dentro da planta atual; enquadramento muda algo', async () => {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    // Engenharia não é habilitada em Joinville (regra de demonstração).
    const engenheiro = await idPorNome(ctx, 'cargos', 'Engenheiro de Processos Jr.')
    const r1 = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', {
      colaboradorId: bianca, tipo: 'alteracao_cargo', vigencia: '2026-10-01', justificativa: 'Mudança de função por competências.',
      alteracao: { tipo: 'alteracao_cargo', cargoPropostoId: engenheiro },
    })
    const e1 = await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${json(r1).movimentacao.id}/enviar`)
    assert.equal(e1.statusCode, 422)
    assert.match(json(e1).error.fieldErrors.cargoPropostoId, /não habilitado para esta planta/)

    const ccGru = await idPorNome(ctx, 'centros_custo', 'CC Produção') // primeiro CC "CC Produção" pertence a GRU
    const r2 = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', {
      colaboradorId: bianca, tipo: 'transferencia_cc', vigencia: '2026-10-01', justificativa: 'Realocação orçamentária entre áreas.',
      alteracao: { tipo: 'transferencia_cc', centroCustoPropostoId: ccGru },
    })
    const e2 = await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${json(r2).movimentacao.id}/enviar`)
    assert.equal(e2.statusCode, 422)
    assert.match(json(e2).error.fieldErrors.centroCustoPropostoId, /não pertence à planta/)

    const r3 = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', {
      colaboradorId: bianca, tipo: 'enquadramento', vigencia: '2026-10-01', justificativa: 'Adequação à nova rotina da função.',
      alteracao: { tipo: 'enquadramento' },
    })
    const e3 = await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${json(r3).movimentacao.id}/enviar`)
    assert.equal(e3.statusCode, 422)
    assert.match(json(e3).error.fieldErrors.horarioPropostoId, /ao menos a folha ou o horário/)
  })
})

describe('fluxo de aprovação', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  const decidir = (subject: string, id: string, decisao: string, comentario?: string) =>
    chamar(ctx, subject, 'POST', `/movimentacoes/${id}/decisoes`, { decisao, comentario })

  it('Gestor → RH Local → RH Central conclui o fluxo e grava decisões e eventos', async () => {
    const mov = await criarMudancaGestorEnviadaPorRH(ctx)
    assert.equal(mov.etapaAtual, 'gestor')

    const r1 = await decidir(USUARIOS.yasmin, mov.id, 'aprovado')
    assert.equal(r1.statusCode, 200, r1.body)
    assert.equal(json(r1).movimentacao.etapaAtual, 'rh_local')
    assert.equal(json(r1).movimentacao.status, 'em_andamento')

    const r2 = await decidir(USUARIOS.rhLocalJoi, mov.id, 'aprovado', 'Conferido com a política da planta.')
    assert.equal(json(r2).movimentacao.etapaAtual, 'rh_central')

    const r3 = await decidir(USUARIOS.rhCentral, mov.id, 'aprovado')
    const final = json(r3)
    assert.equal(final.movimentacao.status, 'aprovada')
    assert.equal(final.movimentacao.etapaAtual, 'concluida')
    assert.deepEqual(final.movimentacao.decisoes.map((d: { etapa: string }) => d.etapa), ['gestor', 'rh_local', 'rh_central'])
    assert.equal(final.movimentacao.decisoes[0].aprovadorPerfil, 'gestor')
    assert.equal(final.movimentacao.decisoes[0].aprovadorNome, 'Yasmin Rodrigues Freitas')
    assert.equal(final.movimentacao.decisoes[1].comentario, 'Conferido com a política da planta.')
    const tipos = final.historico.map((e: { tipo: string }) => e.tipo)
    assert.equal(tipos.filter((t: string) => t === 'aprovacao').length, 3)
    assert.ok(tipos.includes('conclusao'))
    assert.ok(final.logs[0].acao.startsWith('Decisão de aprovação'))

    const { rows } = await ctx.pool.query('select count(*)::int as n from movimentacao_decisoes where movimentacao_id = $1', [mov.id])
    assert.equal(rows[0].n, 3)
    // Aprovação final não altera o cadastro canônico.
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const { rows: c } = await ctx.pool.query('select gestor_id from colaboradores where id = $1', [bianca])
    assert.equal(c[0].gestor_id, await colaboradorPorNome(ctx, 'Yasmin Rodrigues Freitas'))

    // Concluída: novas decisões são conflito de estado.
    assert.equal((await decidir(USUARIOS.rhCentral, mov.id, 'aprovado')).statusCode, 409)
  })

  it('gestor que cria o workflow para o próprio liderado não aprova a própria solicitação: pula direto para RH Local', async () => {
    const mov = await criarMudancaGestorEnviada(ctx) // criado e enviado por Yasmin, gestora direta de Bianca
    assert.equal(mov.status, 'em_andamento')
    assert.equal(mov.etapaAtual, 'rh_local')
    // Yasmin não tem mais nada a decidir aqui: a etapa pendente é rh_local, não gestor.
    assert.equal((await decidir(USUARIOS.yasmin, mov.id, 'aprovado')).statusCode, 403)

    const r1 = await decidir(USUARIOS.rhLocalJoi, mov.id, 'aprovado')
    assert.equal(r1.statusCode, 200, r1.body)
    assert.equal(json(r1).movimentacao.etapaAtual, 'rh_central')
    // Nenhuma decisão foi registrada na etapa gestor (foi pulada, não "auto aprovada").
    assert.equal(json(r1).movimentacao.decisoes.some((d: { etapa: string }) => d.etapa === 'gestor'), false)
  })

  it('perfil ou escopo errado recebe 403 (ou 404 fora da planta); auditoria é somente leitura', async () => {
    const mov = await criarMudancaGestorEnviadaPorRH(ctx)
    // Etapa é do gestor: RH Local, RH Central e Auditoria não podem decidir.
    for (const subject of [USUARIOS.rhLocalJoi, USUARIOS.rhCentral, USUARIOS.auditoria]) {
      const res = await decidir(subject, mov.id, 'aprovado')
      assert.equal(res.statusCode, 403, subject)
      assert.equal(json(res).error.code, 'PROIBIDO')
    }
    // Gestor de outra equipe na mesma planta: não é o gestor direto.
    assert.equal((await decidir(USUARIOS.thiagoJoi, mov.id, 'aprovado')).statusCode, 403)
    // Gestor de outra planta não enxerga a movimentação.
    assert.equal((await decidir(USUARIOS.brunoGru, mov.id, 'aprovado')).statusCode, 404)
    // Sem identidade.
    assert.equal((await chamar(ctx, null, 'POST', `/movimentacoes/${mov.id}/decisoes`, { decisao: 'aprovado' })).statusCode, 401)

    await decidir(USUARIOS.yasmin, mov.id, 'aprovado')
    // RH Local de outra planta não decide a etapa rh_local de Joinville.
    assert.equal((await decidir(USUARIOS.rhLocalGru, mov.id, 'aprovado')).statusCode, 404)
    // O gestor não decide a etapa de RH Local.
    assert.equal((await decidir(USUARIOS.yasmin, mov.id, 'aprovado')).statusCode, 403)
    const estado = json(await chamar(ctx, USUARIOS.yasmin, 'GET', `/movimentacoes/${mov.id}`)).movimentacao
    assert.equal(estado.etapaAtual, 'rh_local')
  })

  it('duas decisões concorrentes na mesma etapa resultam em uma transição e um 409', async () => {
    const mov = await criarMudancaGestorEnviadaPorRH(ctx)
    const [a, b] = await Promise.all([decidir(USUARIOS.yasmin, mov.id, 'aprovado'), decidir(USUARIOS.yasmin, mov.id, 'aprovado')])
    assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409])
    const perdedora = a.statusCode === 409 ? a : b
    assert.equal(json(perdedora).error.code, 'CONFLITO_DE_ESTADO')

    const { rows: decisoes } = await ctx.pool.query('select etapa from movimentacao_decisoes where movimentacao_id = $1', [mov.id])
    assert.equal(decisoes.length, 1)
    const { rows: m } = await ctx.pool.query('select etapa_atual, status from movimentacoes where id = $1', [mov.id])
    assert.equal(m[0].etapa_atual, 'rh_local')
    assert.equal(m[0].status, 'em_andamento')
    const { rows: ev } = await ctx.pool.query(`select count(*)::int as n from movimentacao_eventos where movimentacao_id = $1 and tipo = 'aprovacao'`, [mov.id])
    assert.equal(ev[0].n, 1)
  })

  it('aprovação e reprovação concorrentes também não avançam a etapa duas vezes', async () => {
    const mov = await criarMudancaGestorEnviadaPorRH(ctx)
    const [a, b] = await Promise.all([
      decidir(USUARIOS.yasmin, mov.id, 'aprovado'),
      decidir(USUARIOS.yasmin, mov.id, 'reprovado', 'Motivo suficiente para reprovar.'),
    ])
    assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409])
    const { rows } = await ctx.pool.query('select count(*)::int as n from movimentacao_decisoes where movimentacao_id = $1', [mov.id])
    assert.equal(rows[0].n, 1)
  })

  it('devolução e reprovação exigem comentário com ao menos 5 caracteres (422)', async () => {
    const mov = await criarMudancaGestorEnviadaPorRH(ctx)
    for (const decisao of ['devolvido', 'reprovado']) {
      for (const comentario of [undefined, '', '    ', 'abc', ' ab ']) {
        const res = await decidir(USUARIOS.yasmin, mov.id, decisao, comentario)
        assert.equal(res.statusCode, 422, `${decisao} / ${JSON.stringify(comentario)}`)
        assert.ok(json(res).error.fieldErrors.comentario)
      }
    }
    const { rows } = await ctx.pool.query('select etapa_atual, status from movimentacoes where id = $1', [mov.id])
    assert.equal(rows[0].etapa_atual, 'gestor')
    assert.equal(rows[0].status, 'em_andamento')
  })

  it('devolução volta para o gestor como "devolvida" e permite reenvio; reprovação encerra o fluxo', async () => {
    const mov = await criarMudancaGestorEnviadaPorRH(ctx)
    await decidir(USUARIOS.yasmin, mov.id, 'aprovado')
    const dev = await decidir(USUARIOS.rhLocalJoi, mov.id, 'devolvido', 'Faltou detalhar a justificativa.')
    assert.equal(json(dev).movimentacao.status, 'devolvida')
    assert.equal(json(dev).movimentacao.etapaAtual, 'gestor')
    assert.ok(json(dev).historico.some((e: { tipo: string; comentario?: string }) => e.tipo === 'devolucao' && e.comentario === 'Faltou detalhar a justificativa.'))

    // Reenvio pelo mesmo solicitante original (RH Local): a etapa gestor continua pendente. Se
    // quem reenviasse fosse a própria Yasmin (gestora de Bianca), o envio pularia para rh_local.
    const reenvio = await chamar(ctx, USUARIOS.rhLocalJoi, 'POST', `/movimentacoes/${mov.id}/enviar`)
    assert.equal(reenvio.statusCode, 200, reenvio.body)
    assert.equal(json(reenvio).movimentacao.status, 'em_andamento')
    assert.equal(json(reenvio).movimentacao.etapaAtual, 'gestor')

    const rep = await decidir(USUARIOS.yasmin, mov.id, 'reprovado', 'Não se aplica ao caso.')
    assert.equal(json(rep).movimentacao.status, 'reprovada')
    assert.equal(json(rep).movimentacao.etapaAtual, 'gestor')
    assert.equal((await decidir(USUARIOS.yasmin, mov.id, 'aprovado')).statusCode, 409)
    // Reprovada não pode mais ser editada nem reenviada.
    assert.equal((await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${mov.id}/enviar`)).statusCode, 409)
  })

  it('eventos e decisões são append-only no banco; logs também, exceto limpeza autorizada', async () => {
    const mov = await criarMudancaGestorEnviadaPorRH(ctx)
    await decidir(USUARIOS.yasmin, mov.id, 'aprovado')
    await assert.rejects(ctx.pool.query('update movimentacao_eventos set descricao = $1 where movimentacao_id = $2', ['x', mov.id]), /append-only/)
    await assert.rejects(ctx.pool.query('delete from movimentacao_decisoes where movimentacao_id = $1', [mov.id]), /append-only/)
    await assert.rejects(ctx.pool.query('delete from logs_integracao'), /append-only/)

    assert.equal((await chamar(ctx, USUARIOS.rhLocalJoi, 'DELETE', '/logs-integracao')).statusCode, 403)
    const { rows: plantas } = await ctx.pool.query<{ id: string }>(`select id from plantas where codigo = 'JOI'`)
    await ctx.pool.query('update usuarios set planta_id = $1 where id = $2', [plantas[0]!.id, ctx.ids[USUARIOS.rhCentral]!])
    assert.equal((await chamar(ctx, USUARIOS.rhCentral, 'DELETE', '/logs-integracao')).statusCode, 403)
    await ctx.pool.query('update usuarios set planta_id = null where id = $1', [ctx.ids[USUARIOS.rhCentral]!])
    const limpo = await chamar(ctx, USUARIOS.rhCentral, 'DELETE', '/logs-integracao')
    assert.equal(limpo.statusCode, 200)
    const { rows } = await ctx.pool.query('select acao from logs_integracao')
    assert.deepEqual(rows.map((r) => r.acao), ['Limpar log de integração'])
  })
})
