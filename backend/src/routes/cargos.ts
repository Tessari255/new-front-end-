import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { exigirEscrita, exigirPerfil, exigirUsuario, temAcessoAPlanta } from '../auth.ts'
import { naoEncontrado } from '../errors.ts'
import { bodyConfiguracaoCargo, paramsId, respostaConfiguracaoCargo } from '../schemas.ts'
import { comLog } from '../services/logs.ts'

interface ParamsId {
  id: string
}

interface CorpoConfiguracaoCargo {
  plantaId: string
  salarioBase: number | null
  ipe: number | null
}

interface ConfiguracaoCargoRow {
  planta_id: string
  salario_base: number | null
  ipe: number | null
}

export function rotasCargos(app: FastifyInstance, pool: pg.Pool) {
  app.patch<{ Params: ParamsId; Body: CorpoConfiguracaoCargo }>(
    '/cargos/:id/configuracao',
    { schema: { params: paramsId, body: bodyConfiguracaoCargo, response: { 200: respostaConfiguracaoCargo } } },
    async (request) => {
      const usuario = exigirUsuario(request)
      exigirEscrita(usuario)
      exigirPerfil(usuario, 'rh_local', 'rh_central')
      if (!temAcessoAPlanta(usuario, request.body.plantaId)) throw naoEncontrado('Planta não encontrada.')

      const { resultado, log } = await comLog(
        pool,
        request,
        usuario,
        'sistema',
        'Atualizar parâmetros do cargo',
        async () => {
          const { rows } = await pool.query<ConfiguracaoCargoRow>(
            `update cargo_plantas
                set salario_base = $1, ipe = $2
              where cargo_id = $3 and planta_id = $4
              returning planta_id, salario_base, ipe`,
            [request.body.salarioBase, request.body.ipe, request.params.id, request.body.plantaId],
          )
          if (!rows[0]) throw naoEncontrado('Cargo não disponível nesta planta.')
          return rows[0]
        },
        () => `Parâmetros atualizados para o cargo ${request.params.id} na planta ${request.body.plantaId}.`,
      )
      return {
        configuracao: { plantaId: resultado.planta_id, salarioBase: resultado.salario_base, ipe: resultado.ipe },
        logs: log ? [log] : [],
      }
    },
  )
}
