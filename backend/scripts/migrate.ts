import path from 'node:path'
import { runner } from 'node-pg-migrate'
import { loadConfig } from '../src/config.ts'

const direction = process.argv[2] === 'down' ? 'down' : 'up'
const config = loadConfig()

const applied = await runner({
  databaseUrl: config.databaseUrl,
  dir: path.resolve(import.meta.dirname, '../migrations'),
  migrationsTable: 'pgmigrations',
  direction,
  count: direction === 'down' ? 1 : Infinity,
  log: (msg: string) => console.log(msg),
})
console.log(`${applied.length} migração(ões) ${direction === 'up' ? 'aplicada(s)' : 'revertida(s)'}.`)
