import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createPool } from './db/pool.ts'

const config = loadConfig()
const pool = createPool(config)
const app = await buildApp(config, pool)

let encerrando = false
async function encerrar(sinal: string) {
  if (encerrando) return
  encerrando = true
  app.log.info({ sinal }, 'encerrando servidor')
  try {
    await app.close() // fecha o servidor e, via onClose, o pool de conexões
    process.exit(0)
  } catch (err) {
    app.log.error({ err }, 'falha ao encerrar')
    process.exit(1)
  }
}
process.on('SIGINT', () => void encerrar('SIGINT'))
process.on('SIGTERM', () => void encerrar('SIGTERM'))

try {
  await app.listen({ port: config.port, host: config.demoMode ? '127.0.0.1' : '0.0.0.0' })
  if (config.demoMode) app.log.warn('DEMO_MODE=true: identidade aceita via X-Demo-User-Id. Não use em produção.')
} catch (err) {
  app.log.error({ err }, 'falha ao iniciar')
  await pool.end().catch(() => undefined)
  process.exit(1)
}
