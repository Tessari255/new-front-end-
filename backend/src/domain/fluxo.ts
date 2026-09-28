import type { Decisao, EtapaMovimentacao, PerfilDemo, TipoEvento, TipoMovimentacao } from '../types.ts'

export const ETAPAS_ORDEM: Exclude<EtapaMovimentacao, 'concluida'>[] = ['gestor', 'rh_local', 'rh_central']

/**
 * Planilha (aba OBSERVAÇÕES): "Necessidade de aprovação do gestor para aprovar workflow qdo
 * transfere funcionário." Tipos aqui exigem, na etapa `gestor`, decisão tanto do gestor de origem
 * quanto do gestor de destino (quando um gestor de destino é informado). Mecanismo genérico e
 * configurável: a ordem exata dessa aprovação dupla, se deveria valer também para mudança de
 * gestor/transferência de CC e o que fazer quando o gestor de destino não é definido não estão
 * especificados na planilha — decisão de negócio pendente. Hoje aplica-se só a este tipo.
 */
export const EXIGE_APROVACAO_GESTOR_DESTINO: TipoMovimentacao[] = ['transferencia_localidade']

export function requerAprovacaoGestorDestino(tipo: TipoMovimentacao, gestorAtualId: string | null, gestorPropostoId: string | null): boolean {
  return EXIGE_APROVACAO_GESTOR_DESTINO.includes(tipo) && !!gestorPropostoId && gestorPropostoId !== gestorAtualId
}

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

/**
 * Planilha (aba OBSERVAÇÕES): "Gestor que cria o workflow não precisa aprovar." Quando quem envia
 * para aprovação é o próprio gestor atual do colaborador, a etapa `gestor` seria uma auto-aprovação
 * redundante — pula direto para `rh_local`. Nos demais casos (RH abrindo em nome de alguém, etc.),
 * a etapa `gestor` segue exigida normalmente.
 */
export function etapaInicial(colaboradorGestorId: string | null, solicitanteColaboradorId: string | null): Exclude<EtapaMovimentacao, 'concluida'> {
  if (solicitanteColaboradorId !== null && solicitanteColaboradorId === colaboradorGestorId) return 'rh_local'
  return 'gestor'
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
