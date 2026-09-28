import type { Colaborador, DetalheAlteracao, Movimentacao } from '@/types'
import { getCargo, getCentroCusto, getFolha, getHorario, getPlanta } from '@/data/catalog'
import { formatCurrency } from './format'
import { evidenciaObrigatoria } from '@/data/rules'
import { rotuloTipoMovimentacao } from './rotulos'

export interface CampoComparado {
  label: string
  antes: string
  depois: string
}

export function compararAlteracao(alteracao: DetalheAlteracao, colaboradores: Colaborador[]): CampoComparado[] {
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
