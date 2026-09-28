// Espelha backend/src/domain/folha.ts — só para feedback imediato na UI; o servidor é a autoridade.
export function primeiroDiaDoMes(dataIso: string): string {
  return `${dataIso.slice(0, 7)}-01`
}

export function primeiroDiaDoMesSeguinte(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(ano, mes - 1 + 1, 1))
  return d.toISOString().slice(0, 10)
}

export function vigenciaNoMesTravado(vigencia: string | null | undefined, mesTravado: string | null | undefined): boolean {
  if (!vigencia || !mesTravado) return false
  return primeiroDiaDoMes(vigencia) === mesTravado
}
