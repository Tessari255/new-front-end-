import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import {
  anexar, chamar, colaboradorPorNome, criarMudancaGestorEnviada, encerrar, iniciar, json, PDF_VALIDO, resetar, sha256, USUARIOS,
  type Ctx,
} from './helpers.ts'

describe('documentos', () => {
  let ctx: Ctx
  before(async () => {
    ctx = await iniciar()
  })
  after(async () => encerrar(ctx))
  beforeEach(async () => resetar(ctx))

  it('upload real grava metadados e hash; download devolve os mesmos bytes com headers seguros', async () => {
    const mov = await criarMudancaGestorEnviada(ctx)
    const res = await anexar(ctx, USUARIOS.yasmin, mov.id, { nome: 'evidência final.pdf', mime: 'application/pdf', conteudo: PDF_VALIDO })
    assert.equal(res.statusCode, 201)
    const corpo = json(res)
    const doc = corpo.documentos.find((d: { nome: string }) => d.nome === 'evidência final.pdf')
    assert.ok(doc)
    assert.equal(doc.sha256, sha256(PDF_VALIDO))
    assert.equal(doc.tamanhoBytes, PDF_VALIDO.length)
    assert.equal(doc.temConteudo, true)
    assert.equal(doc.autorNome, 'Yasmin Rodrigues Freitas')
    assert.ok(corpo.movimentacao.documentosIds.includes(doc.id))
    assert.ok(corpo.historico.some((e: { tipo: string }) => e.tipo === 'anexo'))
    assert.ok(!res.body.includes('JVBERi'), 'resposta não pode conter o binário (base64)')

    const dl = await chamar(ctx, USUARIOS.yasmin, 'GET', `/documentos/${doc.id}/download`)
    assert.equal(dl.statusCode, 200)
    assert.deepEqual(dl.rawPayload, PDF_VALIDO)
    assert.equal(dl.headers['content-type'], 'application/pdf')
    assert.match(String(dl.headers['content-disposition']), /^attachment; filename="/)
    assert.match(String(dl.headers['content-disposition']), /filename\*=UTF-8''/)
    assert.equal(dl.headers['x-content-type-options'], 'nosniff')

    // Persistiu no banco com o hash calculado no servidor.
    const { rows } = await ctx.pool.query('select sha256, octet_length(conteudo) as n from movimentacao_documentos where id = $1', [doc.id])
    assert.equal(rows[0].sha256, sha256(PDF_VALIDO))
    assert.equal(Number(rows[0].n), PDF_VALIDO.length)
  })

  it('download exige autorização: outra planta e anônimo não acessam', async () => {
    const mov = await criarMudancaGestorEnviada(ctx)
    const up = json(await anexar(ctx, USUARIOS.yasmin, mov.id, { nome: 'a.pdf', mime: 'application/pdf', conteudo: PDF_VALIDO }))
    const docId = up.documentos[0].id
    assert.equal((await chamar(ctx, null, 'GET', `/documentos/${docId}/download`)).statusCode, 401)
    assert.equal((await chamar(ctx, USUARIOS.brunoGru, 'GET', `/documentos/${docId}/download`)).statusCode, 404)
    assert.equal((await chamar(ctx, USUARIOS.rhLocalGru, 'GET', `/documentos/${docId}/download`)).statusCode, 404)
    assert.equal((await chamar(ctx, USUARIOS.auditoria, 'GET', `/documentos/${docId}/download`)).statusCode, 200)
  })

  it('documento de demonstração (só metadados) responde 404 no download', async () => {
    const { rows } = await ctx.pool.query('select id from movimentacao_documentos limit 1')
    const res = await chamar(ctx, USUARIOS.rhCentral, 'GET', `/documentos/${rows[0].id}/download`)
    assert.equal(res.statusCode, 404)
  })

  it('rejeita MIME, extensão, conteúdo e tamanho inválidos com 422 e não grava nada', async () => {
    const mov = await criarMudancaGestorEnviada(ctx)
    const casos: { nome: string; arquivo: { nome: string; mime: string; conteudo: Buffer }; trecho: RegExp }[] = [
      { nome: 'MIME divergente da extensão', arquivo: { nome: 'a.pdf', mime: 'text/plain', conteudo: PDF_VALIDO }, trecho: /não corresponde/ },
      { nome: 'extensão não permitida', arquivo: { nome: 'malware.exe', mime: 'application/octet-stream', conteudo: Buffer.from('MZ\x90\x00') }, trecho: /Formato não permitido/ },
      { nome: 'conteúdo vazio', arquivo: { nome: 'vazio.pdf', mime: 'application/pdf', conteudo: Buffer.alloc(0) }, trecho: /vazio/ },
      { nome: 'assinatura não bate com o formato', arquivo: { nome: 'falso.png', mime: 'image/png', conteudo: PDF_VALIDO }, trecho: /conteúdo do arquivo/ },
      { nome: 'acima de 10 MB', arquivo: { nome: 'grande.pdf', mime: 'application/pdf', conteudo: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(11 * 1024 * 1024, 65)]) }, trecho: /10 MB/ },
    ]
    for (const c of casos) {
      const res = await anexar(ctx, USUARIOS.yasmin, mov.id, c.arquivo)
      assert.equal(res.statusCode, 422, `${c.nome}: ${res.body}`)
      const erro = json(res).error
      assert.equal(erro.code, 'DOCUMENTO_INVALIDO', c.nome)
      assert.match(erro.message, c.trecho, c.nome)
      assert.ok(erro.fieldErrors.file, c.nome)
    }
    const { rows } = await ctx.pool.query('select count(*)::int as n from movimentacao_documentos where movimentacao_id = $1', [mov.id])
    assert.equal(rows[0].n, 0)
  })

  it('aceita DOCX, PNG e JPG dentro do limite; nome do arquivo é sanitizado', async () => {
    const mov = await criarMudancaGestorEnviada(ctx)
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 1)])
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 2)])
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 3)])
    const envios = [
      { nome: 'termo.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', conteudo: docx },
      { nome: 'foto.png', mime: 'image/png', conteudo: png },
      { nome: 'foto.jpg', mime: 'image/jpeg', conteudo: jpg },
      { nome: '../../etc/passwd.pdf', mime: 'application/pdf', conteudo: PDF_VALIDO },
    ]
    for (const e of envios) assert.equal((await anexar(ctx, USUARIOS.yasmin, mov.id, e)).statusCode, 201, e.nome)
    const boot = json(await chamar(ctx, USUARIOS.yasmin, 'GET', `/movimentacoes/${mov.id}`))
    const nomes = boot.documentos.map((d: { nome: string }) => d.nome)
    assert.ok(nomes.includes('passwd.pdf'), `nomes: ${nomes}`)
    assert.ok(nomes.every((n: string) => !n.includes('/')))
  })

  it('tipo de documento inválido, ausência de arquivo e perfil sem escrita são recusados', async () => {
    const mov = await criarMudancaGestorEnviada(ctx)
    const tipoRuim = await anexar(ctx, USUARIOS.yasmin, mov.id, { nome: 'a.pdf', mime: 'application/pdf', conteudo: PDF_VALIDO }, 'segredo')
    assert.equal(tipoRuim.statusCode, 422)
    const auditoria = await anexar(ctx, USUARIOS.auditoria, mov.id, { nome: 'a.pdf', mime: 'application/pdf', conteudo: PDF_VALIDO })
    assert.equal(auditoria.statusCode, 403)
    const json_ = await chamar(ctx, USUARIOS.yasmin, 'POST', `/movimentacoes/${mov.id}/documentos`, { x: 1 })
    assert.equal(json_.statusCode, 422)
    const bianca = await colaboradorPorNome(ctx, 'Bianca Ferreira Aguiar')
    assert.ok(bianca)
  })
})
