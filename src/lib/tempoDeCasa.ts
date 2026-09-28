export function tempoDeCasa(dataAdmissaoIso: string, referencia = new Date()): string {
  const admissao = new Date(`${dataAdmissaoIso}T00:00:00`)
  let anos = referencia.getFullYear() - admissao.getFullYear()
  let meses = referencia.getMonth() - admissao.getMonth()
  if (referencia.getDate() < admissao.getDate()) meses -= 1
  if (meses < 0) {
    anos -= 1
    meses += 12
  }
  const partes: string[] = []
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`)
  if (meses > 0 || anos === 0) partes.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`)
  return partes.join(' e ')
}
