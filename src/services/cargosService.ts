import { apiJson } from '@/lib/apiClient'
import { carregarDadosIniciais, mutar } from './bootstrapService'

export interface ParametrosCargoInput {
  plantaId: string
  salarioBase: number | null
  ipe: number | null
}

export async function atualizarParametrosCargo(cargoId: string, parametros: ParametrosCargoInput): Promise<void> {
  await mutar(() => apiJson(`/cargos/${cargoId}/configuracao`, { method: 'PATCH', json: parametros }))
  await carregarDadosIniciais()
}
