// Comando idempotente para agendador externo (cron, Task Scheduler, etc.):
//   npm run reconcile
// Executa o mesmo caso de uso do endpoint POST /api/v1/conciliacoes.
import { loadConfig } from './config.ts'
import { createPool } from './db/pool.ts'
import { executarConciliacao } from './services/conciliacao.ts'

const config = loadConfig()
const pool = createPool(config)
try {
  const r = await executarConciliacao(pool, { origem: 'agendada' })
  console.log(
    `Conciliação #${r.conciliacaoId}: ${r.registrosComparados} registros comparados, ` +
      `${r.divergenciasCriadas} divergência(s) criada(s), ${r.divergenciasAtualizadas} atualizada(s).`,
  )
} catch (err) {
  console.error('Conciliação falhou:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await pool.end()
}
