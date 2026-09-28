// "Resumo inteligente" — análise SIMULADA (heurísticas simples sobre os dados
// locais). Não há chamada a nenhum serviço de IA; identificado como simulado
// na própria interface.
import type { CampoDivergente, Divergencia, EtapaMovimentacao, Movimentacao, Planta } from '@/types'
import { rotuloCampoDivergente, rotuloEtapaMovimentacao } from './rotulos'
import { diasEntre } from './dates'

export interface Insight {
  id: string
  titulo: string
  descricao: string
  to: string
}

function camposComPlantaDominante(divergencias: Divergencia[], plantas: Planta[]) {
  const porCampo = new Map<CampoDivergente, Divergencia[]>()
  for (const d of divergencias) {
    const lista = porCampo.get(d.campo) ?? []
    lista.push(d)
    porCampo.set(d.campo, lista)
  }

  let melhor: { campo: CampoDivergente; plantaId: string; count: number; total: number } | undefined
  for (const [campo, itens] of porCampo) {
    if (itens.length < 2) continue
    const porPlanta = new Map<string, number>()
    for (const item of itens) porPlanta.set(item.plantaId, (porPlanta.get(item.plantaId) ?? 0) + 1)
    for (const [plantaId, count] of porPlanta) {
      if (count >= 2 && (!melhor || count > melhor.count)) {
        melhor = { campo, plantaId, count, total: itens.length }
      }
    }
  }
  if (!melhor) return undefined
  const planta = plantas.find((p) => p.id === melhor!.plantaId)
  return { ...melhor, plantaNome: planta?.nome ?? 'planta não identificada' }
}

function etapaComMaiorFila(movimentacoes: Movimentacao[]) {
  const emAndamento = movimentacoes.filter((m) => m.status === 'em_andamento')
  const porEtapa = new Map<EtapaMovimentacao, number>()
  for (const m of emAndamento) porEtapa.set(m.etapaAtual, (porEtapa.get(m.etapaAtual) ?? 0) + 1)
  let melhor: { etapa: EtapaMovimentacao; count: number } | undefined
  for (const [etapa, count] of porEtapa) {
    if (!melhor || count > melhor.count) melhor = { etapa, count }
  }
  return melhor
}

function solicitacaoMaisAntiga(movimentacoes: Movimentacao[]) {
  const emAndamento = movimentacoes.filter((m) => m.status === 'em_andamento')
  if (emAndamento.length === 0) return undefined
  const agora = new Date().toISOString()
  return emAndamento
    .map((m) => {
      const ultima = m.decisoes[m.decisoes.length - 1]?.data ?? `${m.dataAbertura}T08:00:00`
      return { mov: m, dias: diasEntre(ultima, agora) }
    })
    .sort((a, b) => b.dias - a.dias)[0]
}

export function gerarResumoInteligente(divergencias: Divergencia[], movimentacoes: Movimentacao[], plantas: Planta[]): Insight[] {
  const insights: Insight[] = []

  const concentracao = camposComPlantaDominante(divergencias, plantas)
  if (concentracao) {
    insights.push({
      id: 'insight-concentracao',
      titulo: `Divergências de ${rotuloCampoDivergente(concentracao.campo).toLowerCase()} concentradas na ${concentracao.plantaNome}`,
      descricao: `${concentracao.count} de ${concentracao.total} casos deste campo estão nesta unidade. Vale priorizar a conferência com o RH local antes do próximo fechamento.`,
      to: `/conciliacao?campo=${concentracao.campo}&planta=${concentracao.plantaId}`,
    })
  }

  const gargalo = etapaComMaiorFila(movimentacoes)
  if (gargalo && gargalo.etapa !== 'concluida') {
    insights.push({
      id: 'insight-gargalo',
      titulo: `Etapa ${rotuloEtapaMovimentacao(gargalo.etapa)} concentra a maior fila de aprovação`,
      descricao: `${gargalo.count} solicitação(ões) aguardam decisão nesta etapa — maior volume entre as três etapas do fluxo.`,
      to: `/movimentacoes?status=em_andamento&etapa=${gargalo.etapa}`,
    })
  }

  const antiga = solicitacaoMaisAntiga(movimentacoes)
  if (antiga && antiga.dias >= 3) {
    insights.push({
      id: 'insight-antiga',
      titulo: `${antiga.mov.protocolo} aguarda decisão há ${antiga.dias} dias`,
      descricao: 'É a solicitação em andamento há mais tempo sem movimentação — candidata a priorização.',
      to: `/movimentacoes/${antiga.mov.id}`,
    })
  }

  return insights.slice(0, 3)
}
