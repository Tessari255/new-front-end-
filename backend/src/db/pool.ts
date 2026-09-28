import pg from 'pg'
import type { Config } from '../config.ts'

export type Queryable = Pick<pg.PoolClient, 'query'>

// NUMERIC(14,2) chega como string por padrão; a API trabalha com number.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v))
// DATE chega como string 'YYYY-MM-DD' (sem fuso), como o front espera.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v)
// BIGINT (ids) chega como string, que é como a API serializa os ids.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => v)

export function createPool(config: Pick<Config, 'databaseUrl' | 'poolMax' | 'statementTimeoutMs'>): pg.Pool {
  return new pg.Pool({
    connectionString: config.databaseUrl,
    max: config.poolMax,
    statement_timeout: config.statementTimeoutMs,
    idle_in_transaction_session_timeout: config.statementTimeoutMs * 2,
    connectionTimeoutMillis: 5000,
  })
}

export async function withTransaction<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}
