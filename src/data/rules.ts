// Regras de negócio SIMULADAS para fins de demonstração.
// Em uma integração real, estas checagens viriam de serviços de RH (cargos,
// tabelas salariais, convenções coletivas) — aqui são fixas e simplificadas.
import type { Cargo, ChecagemRegra, Colaborador, TipoMovimentacao } from '@/types'
import { getCargo, getCentroCusto } from './catalog'

export const NOTA_REGRAS_DEMO =
  'Regras de demonstração: validações simplificadas para ilustrar o fluxo. Não substituem as políticas oficiais de RH.'

/** Tipos de movimentação que exigem ao menos uma evidência anexada. */
export const TIPOS_COM_EVIDENCIA_OBRIGATORIA: TipoMovimentacao[] = [
  'alteracao_salarial',
  'promocao',
  'enquadramento',
]

export function evidenciaObrigatoria(tipo: TipoMovimentacao): boolean {
  return TIPOS_COM_EVIDENCIA_OBRIGATORIA.includes(tipo)
}

export function cargoCompativelComPlanta(cargo: Cargo, plantaId: string): boolean {
  return cargo.plantasPermitidas.includes(plantaId)
}

export function centroCustoValidoParaPlanta(centroCustoId: string, plantaId: string): boolean {
  const cc = getCentroCusto(centroCustoId)
  return !!cc && cc.plantaId === plantaId
}

export function gestorValido(
  candidato: Colaborador | undefined,
  colaborador: Colaborador,
): { valido: boolean; motivo?: string } {
  if (!candidato) return { valido: false, motivo: 'Selecione um gestor.' }
  if (candidato.id === colaborador.id) return { valido: false, motivo: 'O gestor não pode ser o próprio colaborador.' }
  if (candidato.status !== 'ativo') return { valido: false, motivo: 'O gestor selecionado não está ativo.' }
  if (!candidato.isGestor) return { valido: false, motivo: 'Colaborador selecionado não possui perfil de gestor.' }
  return { valido: true }
}

export function percentualAlteracaoSalarial(atual: number, proposto: number): number {
  if (atual === 0) return 0
  return ((proposto - atual) / atual) * 100
}

export function faixaSalarialStatus(cargoId: string, salarioProposto: number) {
  const cargo = getCargo(cargoId)
  if (!cargo) return { dentroDaFaixa: true, cargo: undefined }
  const dentroDaFaixa = salarioProposto >= cargo.salarioMin && salarioProposto <= cargo.salarioMax
  return { dentroDaFaixa, cargo }
}

let checagemSeq = 0
function novaChecagem(descricao: string, atendida: boolean, severidade: ChecagemRegra['severidade'] = 'bloqueante'): ChecagemRegra {
  checagemSeq += 1
  return { id: `chk-${checagemSeq}`, descricao, atendida, severidade }
}

interface ContextoChecagem {
  colaborador: Colaborador
  plantaId: string
  justificativa: string
  temEvidencia: boolean
  vigencia: string
}

export function gerarChecagens(
  tipo: TipoMovimentacao,
  ctx: ContextoChecagem,
  extras: {
    gestorPropostoId?: string
    todosColaboradores?: Colaborador[]
    cargoPropostoId?: string
    centroCustoPropostoId?: string
    salarioProposto?: number
  },
): ChecagemRegra[] {
  const checagens: ChecagemRegra[] = []

  checagens.push(novaChecagem('Justificativa preenchida', ctx.justificativa.trim().length >= 10))
  checagens.push(novaChecagem('Vigência informada e válida', !!ctx.vigencia && !Number.isNaN(new Date(ctx.vigencia).getTime())))

  if (evidenciaObrigatoria(tipo)) {
    checagens.push(novaChecagem('Evidência obrigatória anexada', ctx.temEvidencia))
  }

  if (tipo === 'mudanca_gestor' && extras.gestorPropostoId) {
    const candidato = extras.todosColaboradores?.find((c) => c.id === extras.gestorPropostoId)
    const resultado = gestorValido(candidato, ctx.colaborador)
    checagens.push(novaChecagem('Gestor proposto ativo e distinto do colaborador', resultado.valido))
  }

  if ((tipo === 'alteracao_cargo' || tipo === 'promocao') && extras.cargoPropostoId) {
    const cargo = getCargo(extras.cargoPropostoId)
    const compativel = !!cargo && cargoCompativelComPlanta(cargo, ctx.plantaId)
    checagens.push(novaChecagem('Cargo compatível com a unidade', compativel))
  }

  if (tipo === 'transferencia_cc' && extras.centroCustoPropostoId) {
    checagens.push(
      novaChecagem(
        'Centro de custo válido para a planta de destino',
        centroCustoValidoParaPlanta(extras.centroCustoPropostoId, ctx.plantaId),
      ),
    )
  }

  if ((tipo === 'alteracao_salarial' || tipo === 'promocao') && extras.salarioProposto !== undefined) {
    const cargoRef = extras.cargoPropostoId ?? ctx.colaborador.cargoId
    const { dentroDaFaixa } = faixaSalarialStatus(cargoRef, extras.salarioProposto)
    checagens.push(novaChecagem('Salário proposto dentro da faixa do cargo', dentroDaFaixa, 'aviso'))
  }

  return checagens
}

export function checagensAtendemBloqueio(checagens: ChecagemRegra[]): boolean {
  return checagens.every((c) => c.atendida || c.severidade !== 'bloqueante')
}
