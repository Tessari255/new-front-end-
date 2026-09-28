import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { chamar, colaboradorPorNome, encerrar, iniciar, json, resetar, USUARIOS, type Ctx } from './helpers.ts'

describe('bootstrap e rascunhos', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  it('exige identidade e recusa header inválido (401)', async () => {
    assert.equal((await chamar(ctx, null, 'GET', '/bootstrap')).statusCode, 401)
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { 'x-demo-user-id': '999999' } })
    assert.equal(res.statusCode, 401)
    assert.equal(json(res).error.code, 'NAO_AUTENTICADO')
    assert.ok(json(res).error.correlationId)
  })

  it('bootstrap autorizado retorna o contrato esperado e nunca bytes de documento', async () => {
    const res = await chamar(ctx, USUARIOS.rhCentral, 'GET', '/bootstrap')
    assert.equal(res.statusCode, 200)
    const b = json(res)
    for (const chave of [
      'plantas', 'areas', 'cargos', 'centrosCusto', 'horarios', 'folhas', 'colaboradores', 'movimentacoes',
      'documentos', 'historico', 'divergencias', 'conferencia', 'logsIntegracao', 'currentUser', 'fechamentoFolha',
    ]) {
      assert.ok(chave in b, `faltou ${chave}`)
    }
    assert.equal(b.plantas.length, 3)
    assert.equal(b.colaboradores.length, 44)
    assert.equal(b.movimentacoes.length, 23)
    assert.equal(b.currentUser.perfil, 'rh_central')
    assert.equal(typeof b.movimentacoes[0].id, 'string')
    assert.ok(['rascunho', 'em_andamento', 'devolvida', 'reprovada', 'aprovada'].includes(b.movimentacoes[0].status))
    assert.equal(typeof b.colaboradores[0].salario, 'number')
    assert.equal(typeof b.cargos[0].salarioMin, 'number')
    assert.ok(Array.isArray(b.cargos[0].plantasPermitidas))
    assert.ok(!res.body.includes('conteudo'), 'nenhum campo de conteúdo binário deve sair no bootstrap')
    for (const d of b.documentos) assert.equal(d.temConteudo, false)
  })

  it('filtra dados sensíveis (colaboradores, movimentações) pelo escopo; catálogo de referência (plantas, CC) é sempre global', async () => {
    const gestor = json((await chamar(ctx, USUARIOS.yasmin, 'GET', '/bootstrap')))
    const joinville = gestor.plantas.find((p: { codigo: string }) => p.codigo === 'JOI')
    // Plantas e centros de custo são catálogo de referência global (necessário para exibir
    // corretamente movimentações que referenciam outra planta, ex.: transferência de localidade).
    assert.deepEqual(gestor.plantas.map((p: { codigo: string }) => p.codigo).sort(), ['BET', 'GRU', 'JOI'])
    assert.ok(gestor.centrosCusto.length > gestor.centrosCusto.filter((cc: { plantaId: string }) => cc.plantaId === joinville.id).length)
    // Dados sensíveis (colaboradores, movimentações) continuam restritos à planta do gestor.
    assert.ok(gestor.colaboradores.every((c: { plantaId: string }) => c.plantaId === joinville.id))
    assert.ok(gestor.movimentacoes.every((m: { plantaId: string }) => m.plantaId === joinville.id))
    const auditoria = json((await chamar(ctx, USUARIOS.auditoria, 'GET', '/bootstrap')))
    assert.equal(auditoria.plantas.length, 3)
  })

  it('criar rascunho e recarregar preserva os dados; valores atuais e planta vêm do servidor', async () => {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const { rows } = await ctx.pool.query('select salario, planta_id from colaboradores where id = $1', [bianca])
    const criada = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', {
      colaboradorId: bianca,
      tipo: 'alteracao_salarial',
      vigencia: '2026-10-01',
      justificativa: 'Ajuste conforme política de mercado da posição.',
      // Tudo abaixo é ignorado/derivado no servidor:
      plantaId: '999',
      solicitanteNome: 'Fulano Falso',
      autorId: '1',
      alteracao: { tipo: 'alteracao_salarial', salarioAtual: 1, salarioProposto: 4300 },
    })
    assert.equal(criada.statusCode, 201)
    const mov = json(criada).movimentacao
    assert.equal(mov.status, 'rascunho')
    assert.equal(mov.etapaAtual, 'gestor')
    assert.equal(mov.plantaId, rows[0].planta_id)
    assert.equal(mov.solicitanteNome, 'Yasmin Rodrigues Freitas')
    assert.equal(mov.alteracao.salarioAtual, rows[0].salario)
    assert.equal(mov.alteracao.salarioProposto, 4300)
    assert.match(mov.protocolo, /^MOV-2026-\d{4}$/)
    assert.ok(json(criada).historico.some((e: { tipo: string }) => e.tipo === 'abertura'))
    assert.equal(json(criada).logs[0].categoria, 'movimentacao')

    // "Recarregar o navegador" = novo bootstrap.
    const boot = json(await chamar(ctx, USUARIOS.yasmin, 'GET', '/bootstrap'))
    const salvo = boot.movimentacoes.find((m: { id: string }) => m.id === mov.id)
    assert.ok(salvo)
    assert.equal(salvo.justificativa, 'Ajuste conforme política de mercado da posição.')
    assert.equal(salvo.alteracao.salarioProposto, 4300)
    assert.ok(boot.logsIntegracao.some((l: { acao: string }) => l.acao === 'Salvar rascunho'))
  })

  it('rascunho exige apenas colaborador e tipo válidos; payload malformado retorna 400', async () => {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const vazio = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', { colaboradorId: bianca, tipo: 'promocao' })
    assert.equal(vazio.statusCode, 201)
    assert.equal(json(vazio).movimentacao.justificativa, '')
    assert.equal(json(vazio).movimentacao.vigencia, '')

    const semTipo = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', { colaboradorId: bianca })
    assert.equal(semTipo.statusCode, 400)
    assert.equal(json(semTipo).error.code, 'PAYLOAD_INVALIDO')
    const tipoInvalido = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', { colaboradorId: bianca, tipo: 'demissao' })
    assert.equal(tipoInvalido.statusCode, 400)
    const inexistente = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', { colaboradorId: '999999', tipo: 'promocao' })
    assert.equal(inexistente.statusCode, 404)
  })

  it('PATCH do rascunho persiste edição; auditoria não escreve; colaborador fora do escopo é 404', async () => {
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    const criada = json(await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', { colaboradorId: bianca, tipo: 'promocao' }))
    const id = criada.movimentacao.id
    const editada = await chamar(ctx, USUARIOS.yasmin, 'PATCH', `/movimentacoes/${id}/rascunho`, {
      colaboradorId: bianca, tipo: 'promocao', vigencia: '2026-11-01', justificativa: 'Nova justificativa mais completa.',
    })
    assert.equal(editada.statusCode, 200)
    assert.equal(json(editada).movimentacao.justificativa, 'Nova justificativa mais completa.')
    assert.ok(json(editada).historico.some((e: { tipo: string }) => e.tipo === 'edicao'))

    const auditoria = await chamar(ctx, USUARIOS.auditoria, 'POST', '/movimentacoes', { colaboradorId: bianca, tipo: 'promocao' })
    assert.equal(auditoria.statusCode, 403)
    const gru = await colaboradorPorNome(ctx, 'Ana Beatriz Souza')
    const fora = await chamar(ctx, USUARIOS.yasmin, 'POST', '/movimentacoes', { colaboradorId: gru, tipo: 'promocao' })
    assert.equal(fora.statusCode, 404)
  })
})
