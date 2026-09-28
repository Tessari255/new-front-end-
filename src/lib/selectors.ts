import type { Colaborador, Divergencia, EtapaMovimentacao, Movimentacao, PerfilDemo, StatusMovimentacao, Usuario } from '@/types'
import { getPerfilDemo } from '@/data/perfis'
import { gestorPropostoDaAlteracao, nomeAprovador, requerAprovacaoGestorDestino } from './fluxoAprovacao'
import { addDays, estaNoMesAtual } from './dates'

export function filtrarPorPlanta<T extends { plantaId: string }>(lista: T[], plantaId: string | 'todas'): T[] {
  if (plantaId === 'todas') return lista
  return lista.filter((item) => item.plantaId === plantaId)
}

export function dataConclusao(mov: Movimentacao): string | undefined {
  if (mov.status !== 'aprovada') return undefined
  return mov.decisoes[mov.decisoes.length - 1]?.data
}

export function etapaDoPerfil(perfil: PerfilDemo): EtapaMovimentacao | null {
  return getPerfilDemo(perfil)?.etapa ?? null
}

/**
 * Espelha, para a interface, a regra aplicada pelo servidor: quem pode decidir a etapa atual.
 * (Gestor: só o gestor direto; RH Local: sua planta; RH Central: plantas autorizadas; Auditoria: ninguém.)
 * A decisão de fato é sempre validada no backend.
 */
export function usuarioPodeDecidir(usuario: Usuario | null, mov: Movimentacao, colaboradores: Colaborador[]): boolean {
  if (!usuario || mov.status !== 'em_andamento') return false
  const etapa = etapaDoPerfil(usuario.perfil)
  if (!etapa || etapa !== mov.etapaAtual) return false
  if (usuario.perfil === 'gestor') {
    if (usuario.colaboradorId === null) return false
    const gestorAtualId = colaboradores.find((c) => c.id === mov.colaboradorId)?.gestorId ?? null
    if (gestorAtualId === usuario.colaboradorId) return true
    const gestorPropostoId = gestorPropostoDaAlteracao(mov.alteracao)
    if (mov.etapaAtual === 'gestor' && requerAprovacaoGestorDestino(mov.tipo, gestorAtualId, gestorPropostoId) && gestorPropostoId === usuario.colaboradorId) {
      // Já registrou a própria decisão? A API é a autoridade; aqui é só para não reoferecer a ação.
      return !mov.decisoes.some((d) => d.etapa === 'gestor' && d.decisao === 'aprovado' && d.aprovadorNome === usuario.nome)
    }
    return false
  }
  return usuario.plantaId === null || usuario.plantaId === mov.plantaId
}

export function movimentacoesAcionaveisPeloUsuario(movimentacoes: Movimentacao[], usuario: Usuario | null, colaboradores: Colaborador[]): Movimentacao[] {
  return movimentacoes.filter((m) => usuarioPodeDecidir(usuario, m, colaboradores))
}

export interface Indicadores {
  emAndamento: number
  aprovacoesPendentes: number
  divergenciasAbertas: number
  concluidasNoMes: number
}

export function calcularIndicadores(
  movimentacoes: Movimentacao[],
  divergencias: Divergencia[],
  usuario: Usuario | null,
  colaboradores: Colaborador[],
): Indicadores {
  return {
    emAndamento: movimentacoes.filter((m) => m.status === 'em_andamento').length,
    aprovacoesPendentes: movimentacoesAcionaveisPeloUsuario(movimentacoes, usuario, colaboradores).length,
    divergenciasAbertas: divergencias.filter((d) => d.status !== 'resolvida').length,
    concluidasNoMes: movimentacoes.filter((m) => {
      const conclusao = dataConclusao(m)
      return conclusao && estaNoMesAtual(conclusao)
    }).length,
  }
}

export function distribuicaoPorStatus(movimentacoes: Movimentacao[]): Record<StatusMovimentacao, number> {
  const base: Record<StatusMovimentacao, number> = { rascunho: 0, em_andamento: 0, devolvida: 0, reprovada: 0, aprovada: 0 }
  for (const m of movimentacoes) base[m.status] += 1
  return base
}

export interface ResumoPlanta {
  plantaId: string
  nome: string
  total: number
  emAndamento: number
  aprovadas: number
  divergenciasAbertas: number
}

export function resumoPorPlanta(
  plantas: { id: string; nome: string }[],
  movimentacoes: Movimentacao[],
  divergencias: Divergencia[],
): ResumoPlanta[] {
  return plantas.map((planta) => {
    const movsDaPlanta = movimentacoes.filter((m) => m.plantaId === planta.id)
    return {
      plantaId: planta.id,
      nome: planta.nome,
      total: movsDaPlanta.length,
      emAndamento: movsDaPlanta.filter((m) => m.status === 'em_andamento').length,
      aprovadas: movsDaPlanta.filter((m) => m.status === 'aprovada').length,
      divergenciasAbertas: divergencias.filter((d) => d.plantaId === planta.id && d.status !== 'resolvida').length,
    }
  })
}

export interface PendenciaAcao {
  movimentacao: Movimentacao
  responsavel: string
  prazo: string
  atrasada: boolean
}

export function pendenciasComAcao(movimentacoes: Movimentacao[], colaboradores: Colaborador[]): PendenciaAcao[] {
  const pendentes = movimentacoes.filter((m) => m.status === 'em_andamento')
  const agora = new Date()
  return pendentes
    .map((mov) => {
      const colaborador = colaboradores.find((c) => c.id === mov.colaboradorId)
      const responsavel = colaborador ? nomeAprovador(mov.etapaAtual, colaborador, colaboradores) : 'A definir'
      const ultimaData = mov.decisoes[mov.decisoes.length - 1]?.data ?? `${mov.dataAbertura}T08:00:00`
      const prazo = addDays(ultimaData, 5)
      return { movimentacao: mov, responsavel, prazo, atrasada: new Date(prazo) < agora }
    })
    .sort((a, b) => new Date(a.prazo).getTime() - new Date(b.prazo).getTime())
}
