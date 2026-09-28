import type { Colaborador, EtapaMovimentacao, PerfilDemo } from '@/types'
import { getPlanta } from '@/data/catalog'

export const ETAPAS_ORDEM: EtapaMovimentacao[] = ['gestor', 'rh_local', 'rh_central']

export const PERFIL_DA_ETAPA: Record<Exclude<EtapaMovimentacao, 'concluida'>, PerfilDemo> = {
  gestor: 'gestor',
  rh_local: 'rh_local',
  rh_central: 'rh_central',
}

export function proximaEtapa(etapa: EtapaMovimentacao): EtapaMovimentacao {
  const idx = ETAPAS_ORDEM.indexOf(etapa)
  if (idx === -1 || idx === ETAPAS_ORDEM.length - 1) return 'concluida'
  return ETAPAS_ORDEM[idx + 1]!
}

export function nomeAprovador(etapa: EtapaMovimentacao, colaborador: Colaborador, todos: Colaborador[]): string {
  if (etapa === 'gestor') {
    const gestor = todos.find((c) => c.id === colaborador.gestorId)
    return gestor?.nome ?? 'Gestor direto'
  }
  const planta = getPlanta(colaborador.plantaId)
  if (etapa === 'rh_local') return `RH Local — ${planta?.nome ?? 'planta'}`
  return 'RH Central — Sede Corporativa'
}

export function rotuloEtapa(etapa: EtapaMovimentacao): string {
  switch (etapa) {
    case 'gestor':
      return 'Gestor'
    case 'rh_local':
      return 'RH Local'
    case 'rh_central':
      return 'RH Central'
    case 'concluida':
      return 'Concluída'
  }
}
