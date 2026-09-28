// Fechamento mensal da folha (aba OBSERVAÇÕES): "Após início do fechamento da folha não seria
// possível mais lançar workflow com a data do mês de fechamento." / "Durante o período de
// fechamento apareceria para o solicitante a data do mês seguinte." Share é responsável pela trava.

/** Normaliza uma data (YYYY-MM-DD) para o primeiro dia do seu mês. */
export function primeiroDiaDoMes(dataIso: string): string {
  return `${dataIso.slice(0, 7)}-01`
}

/** Primeiro dia do mês seguinte ao informado (mês já normalizado ao dia 1). */
export function primeiroDiaDoMesSeguinte(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(ano, mes - 1 + 1, 1))
  return d.toISOString().slice(0, 10)
}

/** true quando a vigência cai no mês atualmente travado (mesmo mês/ano). */
export function vigenciaNoMesTravado(vigencia: string | null | undefined, mesTravado: string | null): boolean {
  if (!vigencia || !mesTravado) return false
  return primeiroDiaDoMes(vigencia) === mesTravado
}
