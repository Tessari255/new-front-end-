import type { Colaborador, DetalheAlteracao, Movimentacao, TipoMaoDeObra } from '@/types'
import { getArea, getCargo, getCentroCusto, getFolha, getHorario, getPlanta } from '@/data/catalog'
import { formatCurrency } from './format'
import { evidenciaObrigatoria } from '@/data/rules'
import { rotuloIpe, rotuloTipoMovimentacao } from './rotulos'

const ROTULO_MAO_DE_OBRA: Record<TipoMaoDeObra, string> = { direta: 'Mão de obra direta', indireta: 'Mão de obra indireta' }

/** IPE é derivado do cargo na planta (cargo_plantas), nunca persistido por movimentação. */
export function ipeDoCargoNaPlanta(cargoId: string | undefined, plantaId: string | undefined): number | null {
  if (!cargoId || !plantaId) return null
  return getCargo(cargoId)?.configuracoesPorPlanta.find((c) => c.plantaId === plantaId)?.ipe ?? null
}

export interface CampoComparado {
  label: string
  antes: string
  depois: string
}

/** `plantaId` é usado só para derivar o IPE (cargo × planta) nas mudanças de cargo. */
export function compararAlteracao(alteracao: DetalheAlteracao, colaboradores: Colaborador[], plantaId?: string): CampoComparado[] {
  switch (alteracao.tipo) {
    case 'mudanca_gestor': {
      const atual = colaboradores.find((c) => c.id === alteracao.gestorAtualId)
      const proposto = colaboradores.find((c) => c.id === alteracao.gestorPropostoId)
      return [{ label: 'Gestor', antes: atual?.nome ?? 'Sem gestor definido', depois: proposto?.nome ?? '—' }]
    }
    case 'alteracao_cargo':
      return [
        {
          label: 'Cargo',
          antes: getCargo(alteracao.cargoAtualId)?.nome ?? '—',
          depois: getCargo(alteracao.cargoPropostoId)?.nome ?? '—',
        },
        {
          label: 'IPE',
          antes: rotuloIpe(ipeDoCargoNaPlanta(alteracao.cargoAtualId, plantaId)),
          depois: rotuloIpe(ipeDoCargoNaPlanta(alteracao.cargoPropostoId, plantaId)),
        },
      ]
    case 'alteracao_salarial':
      return [
        { label: 'Salário', antes: formatCurrency(alteracao.salarioAtual), depois: formatCurrency(alteracao.salarioProposto) },
      ]
    case 'promocao':
      return [
        {
          label: 'Cargo',
          antes: getCargo(alteracao.cargoAtualId)?.nome ?? '—',
          depois: getCargo(alteracao.cargoPropostoId)?.nome ?? '—',
        },
        {
          label: 'IPE',
          antes: rotuloIpe(ipeDoCargoNaPlanta(alteracao.cargoAtualId, plantaId)),
          depois: rotuloIpe(ipeDoCargoNaPlanta(alteracao.cargoPropostoId, plantaId)),
        },
        { label: 'Salário', antes: formatCurrency(alteracao.salarioAtual), depois: formatCurrency(alteracao.salarioProposto) },
      ]
    case 'enquadramento':
      return [
        {
          label: 'Folha',
          antes: getFolha(alteracao.folhaAtualId)?.nome ?? '—',
          depois: getFolha(alteracao.folhaPropostaId)?.nome ?? '—',
        },
        {
          label: 'Horário',
          antes: getHorario(alteracao.horarioAtualId)?.nome ?? '—',
          depois: getHorario(alteracao.horarioPropostoId)?.nome ?? '—',
        },
      ]
    case 'transferencia_cc': {
      const campos: CampoComparado[] = [
        {
          label: 'Centro de custo',
          antes: getCentroCusto(alteracao.centroCustoAtualId)?.nome ?? '—',
          depois: getCentroCusto(alteracao.centroCustoPropostoId)?.nome ?? '—',
        },
      ]
      if (alteracao.plantaAtualId !== alteracao.plantaPropostaId) {
        campos.push({
          label: 'Planta',
          antes: getPlanta(alteracao.plantaAtualId)?.nome ?? '—',
          depois: getPlanta(alteracao.plantaPropostaId)?.nome ?? '—',
        })
      }
      return campos
    }
    case 'merito':
      return [{ label: 'Salário', antes: formatCurrency(alteracao.salarioAtual), depois: formatCurrency(alteracao.salarioProposto) }]
    case 'transferencia_localidade': {
      const campos: CampoComparado[] = [
        {
          label: 'Localidade',
          antes: getPlanta(alteracao.plantaAtualId)?.nome ?? '—',
          depois: getPlanta(alteracao.plantaPropostaId)?.nome ?? '—',
        },
        {
          label: 'Centro de custo',
          antes: getCentroCusto(alteracao.centroCustoAtualId)?.nome ?? '—',
          depois: getCentroCusto(alteracao.centroCustoPropostoId)?.nome ?? '—',
        },
      ]
      if (alteracao.gestorPropostoId && alteracao.gestorPropostoId !== alteracao.gestorAtualId) {
        const atual = colaboradores.find((c) => c.id === alteracao.gestorAtualId)
        const proposto = colaboradores.find((c) => c.id === alteracao.gestorPropostoId)
        campos.push({ label: 'Gestor', antes: atual?.nome ?? 'Sem gestor definido', depois: proposto?.nome ?? '—' })
      }
      return campos
    }
    case 'alteracao_mao_de_obra':
      return [
        {
          label: 'Tipo de mão de obra',
          antes: alteracao.tipoMaoDeObraAtual ? ROTULO_MAO_DE_OBRA[alteracao.tipoMaoDeObraAtual] : 'Não definido',
          depois: ROTULO_MAO_DE_OBRA[alteracao.tipoMaoDeObraProposto],
        },
      ]
    case 'alteracao_area_atuacao':
      return [
        {
          label: 'Área de atuação',
          antes: getArea(alteracao.areaAtualId)?.nome ?? '—',
          depois: getArea(alteracao.areaPropostaId)?.nome ?? '—',
        },
      ]
  }
}

export function resumoAlteracao(mov: Movimentacao, colaboradores: Colaborador[]) {
  const campos = compararAlteracao(mov.alteracao, colaboradores)
  return {
    campo: campos.map((c) => c.label).join(' + '),
    antes: campos.map((c) => c.antes).join(' | '),
    depois: campos.map((c) => c.depois).join(' | '),
  }
}

export function tituloMovimentacao(mov: Movimentacao, colaborador?: Colaborador): string {
  return `${rotuloTipoMovimentacao(mov.tipo)} — ${colaborador?.nome ?? 'Colaborador'}`
}

export function movimentacaoExigeEvidencia(mov: Movimentacao): boolean {
  return evidenciaObrigatoria(mov.tipo)
}
