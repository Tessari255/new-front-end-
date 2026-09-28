import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { exigirPerfil, exigirUsuario } from '../auth.ts'
import { resetarDemo } from '../db/seed.ts'
import { withTransaction } from '../db/pool.ts'
import { AppError, proibido } from '../errors.ts'
import { respostaLogs, respostaUsuariosDemo } from '../schemas.ts'
import { comLog, inserirLog } from '../services/logs.ts'

const DESCRICAO_PERFIL: Record<string, string> = {
  gestor: 'Aprova as movimentações da própria equipe (1ª etapa).',
  rh_local: 'Confere dados e políticas da planta (2ª etapa).',
  rh_central: 'Aprovação final e liberação para processamento (3ª etapa).',
  auditoria: 'Visualização completa do fluxo, sem ações de aprovação.',
}

const MENSAGENS_FALHA = [
  'Tempo limite excedido ao conectar ao Employee Central (simulado).',
  'Apdata retornou HTTP 503 — serviço temporariamente indisponível (simulado).',
  'Falha de validação: matrícula não encontrada no sistema de origem (simulado).',
]

/** Health/readiness na raiz, fora do prefixo /api/v1 e sem autenticação. */
export function rotasSaude(app: FastifyInstance, pool: pg.Pool) {
  app.get('/health', { config: { publica: true } }, async () => ({ status: 'ok' }))
  app.get('/ready', { config: { publica: true } }, async (_request, reply) => {
    try {
      await pool.query('select 1')
      return { status: 'ready' }
    } catch {
      return reply.status(503).send({ status: 'unavailable' })
    }
  })
}

export function rotasOperacao(app: FastifyInstance, pool: pg.Pool) {
  // Botão "Limpar log": única exceção ao append-only, restrita ao RH Central global e sempre auditada.
  app.delete('/logs-integracao', { schema: { response: { 200: respostaLogs } } }, async (request) => {
    const usuario = exigirUsuario(request)
    exigirPerfil(usuario, 'rh_central')
    if (usuario.plantasAutorizadas !== null) throw proibido('A limpeza de logs exige RH Central com acesso global.')
    const removidos = await withTransaction(pool, async (client) => {
      await client.query(`select set_config('nexo.permitir_limpeza_logs', 'on', true)`)
      const r = await client.query('delete from logs_integracao')
      return r.rowCount ?? 0
    })
    const log = await inserirLog(pool, {
      categoria: 'sistema',
      acao: 'Limpar log de integração',
      status: 'sucesso',
      duracaoMs: 0,
      detalhe: `${removidos} registro(s) removido(s) por ${usuario.nome}.`,
      correlationId: request.id,
      usuarioId: usuario.id,
    })
    return { logsIntegracao: [log] }
  })
}

/** Recursos de demonstração: só existem com DEMO_MODE=true (caso contrário, 404 padrão). */
export function rotasDemo(app: FastifyInstance, pool: pg.Pool) {
  app.get('/dev/users', { config: { publica: true }, schema: { response: { 200: respostaUsuariosDemo } } }, async () => {
    const { rows } = await pool.query(
      `select u.id, u.nome, u.perfil, p.nome as planta_nome
         from usuarios u left join plantas p on p.id = u.planta_id
        where u.ativo
        order by array_position(array['gestor','rh_local','rh_central','auditoria'], u.perfil), u.id`,
    )
    return {
      usuarios: rows.map((r) => ({
        id: r.id as string,
        nome: r.nome as string,
        perfil: r.perfil as string,
        plantaNome: (r.planta_nome as string | null) ?? null,
        descricao: DESCRICAO_PERFIL[r.perfil as string] ?? '',
      })),
    }
  })

  app.post('/dev/reset', { schema: { response: { 200: respostaLogs } } }, async (request) => {
    const usuario = exigirUsuario(request)
    const { log } = await comLog(
      pool,
      request,
      usuario,
      'sistema',
      'Restaurar demonstração',
      () => resetarDemo(pool),
      () => 'Dados fictícios reiniciados para o estado inicial.',
    )
    return { logsIntegracao: log ? [log] : [] }
  })

  app.post('/dev/integration-failure', async (request) => {
    const usuario = exigirUsuario(request)
    const mensagem = MENSAGENS_FALHA[Math.floor(Math.random() * MENSAGENS_FALHA.length)]!
    await comLog(
      pool,
      request,
      usuario,
      'sistema',
      'Verificação de conectividade (demonstração)',
      async () => {
        throw new AppError(502, 'INTEGRACAO_SIMULADA', mensagem)
      },
      () => '',
    )
  })
}
