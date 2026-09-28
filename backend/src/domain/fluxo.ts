import type { Decisao, EtapaMovimentacao, PerfilDemo, TipoEvento } from '../types.ts'

export const ETAPAS_ORDEM: Exclude<EtapaMovimentacao, 'concluida'>[] = ['gestor', 'rh_local', 'rh_central']

export const PERFIL_DA_ETAPA: Record<Exclude<EtapaMovimentacao, 'concluida'>, PerfilDemo> = {
  gestor: 'gestor',
  rh_local: 'rh_local',
  rh_central: 'rh_central',
}

export function proximaEtapa(etapa: EtapaMovimentacao): EtapaMovimentacao {
  const idx = (ETAPAS_ORDEM as string[]).indexOf(etapa)
  if (idx === -1 || idx === ETAPAS_ORDEM.length - 1) return 'concluida'
  return ETAPAS_ORDEM[idx + 1]!
}

export function nomeAprovador(etapa: EtapaMovimentacao, gestorNome: string | null, plantaNome: string): string {
  if (etapa === 'gestor') return gestorNome ?? 'Gestor direto'
  if (etapa === 'rh_local') return `RH Local — ${plantaNome}`
  return 'RH Central — Sede Corporativa'
}

export interface TransicaoDecisao {
  novoStatus: 'em_andamento' | 'devolvida' | 'reprovada' | 'aprovada'
  novaEtapa: EtapaMovimentacao
  tipoEvento: TipoEvento
  verbo: string
}

export function transicaoDaDecisao(etapa: Exclude<EtapaMovimentacao, 'concluida'>, decisao: Decisao): TransicaoDecisao {
  if (decisao === 'aprovado') {
    const seguinte = proximaEtapa(etapa)
    return {
      novoStatus: seguinte === 'concluida' ? 'aprovada' : 'em_andamento',
      novaEtapa: seguinte,
      tipoEvento: 'aprovacao',
      verbo: 'aprovou',
    }
  }
  if (decisao === 'devolvido') {
    return { novoStatus: 'devolvida', novaEtapa: 'gestor', tipoEvento: 'devolucao', verbo: 'devolveu' }
  }
  return { novoStatus: 'reprovada', novaEtapa: etapa, tipoEvento: 'reprovacao', verbo: 'reprovou' }
}
