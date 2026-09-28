// Catálogo de referência (plantas, áreas, cargos, centros de custo, horários, folhas).
// A fonte de verdade é o backend: este módulo apenas indexa, em memória, o catálogo
// recebido em /bootstrap para que helpers síncronos (labels, comparações) continuem simples.
import type { Area, Cargo, CentroCusto, Folha, Horario, Planta } from '@/types'

export interface Catalogo {
  plantas: Planta[]
  areas: Area[]
  cargos: Cargo[]
  centrosCusto: CentroCusto[]
  horarios: Horario[]
  folhas: Folha[]
}

const indices = {
  plantas: new Map<string, Planta>(),
  areas: new Map<string, Area>(),
  cargos: new Map<string, Cargo>(),
  centrosCusto: new Map<string, CentroCusto>(),
  horarios: new Map<string, Horario>(),
  folhas: new Map<string, Folha>(),
}

function indexar<T extends { id: string }>(mapa: Map<string, T>, itens: T[]) {
  mapa.clear()
  for (const item of itens) mapa.set(item.id, item)
}

export function definirCatalogo(catalogo: Catalogo) {
  indexar(indices.plantas, catalogo.plantas)
  indexar(indices.areas, catalogo.areas)
  indexar(indices.cargos, catalogo.cargos)
  indexar(indices.centrosCusto, catalogo.centrosCusto)
  indexar(indices.horarios, catalogo.horarios)
  indexar(indices.folhas, catalogo.folhas)
}

export const getPlanta = (id: string): Planta | undefined => indices.plantas.get(id)
export const getArea = (id: string): Area | undefined => indices.areas.get(id)
export const getCargo = (id: string): Cargo | undefined => indices.cargos.get(id)
export const getCentroCusto = (id: string): CentroCusto | undefined => indices.centrosCusto.get(id)
export const getHorario = (id: string): Horario | undefined => indices.horarios.get(id)
export const getFolha = (id: string): Folha | undefined => indices.folhas.get(id)
