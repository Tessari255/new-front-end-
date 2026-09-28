export function addDays(iso: string, dias: number): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  d.setDate(d.getDate() + dias)
  return d.toISOString()
}

export function estaNoMesAtual(iso: string, referencia = new Date()): boolean {
  const d = new Date(iso)
  return d.getFullYear() === referencia.getFullYear() && d.getMonth() === referencia.getMonth()
}

export function diasEntre(isoInicio: string, isoFim: string): number {
  const inicio = new Date(isoInicio).getTime()
  const fim = new Date(isoFim).getTime()
  return Math.round((fim - inicio) / 86_400_000)
}
