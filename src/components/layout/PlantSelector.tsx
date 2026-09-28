import { Factory } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { useAppStore } from '@/store/useAppStore'

export function PlantSelector() {
  const plantas = useAppStore((s) => s.plantas)
  const plantaSelecionadaId = useAppStore((s) => s.plantaSelecionadaId)
  const setPlantaSelecionada = useAppStore((s) => s.setPlantaSelecionada)

  return (
    <Select value={plantaSelecionadaId} onValueChange={setPlantaSelecionada}>
      <SelectTrigger className="w-[210px]" aria-label="Selecionar planta">
        <Factory className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
        <SelectValue placeholder="Todas as plantas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">Todas as plantas</SelectItem>
        {plantas.map((planta) => (
          <SelectItem key={planta.id} value={planta.id}>
            {planta.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
