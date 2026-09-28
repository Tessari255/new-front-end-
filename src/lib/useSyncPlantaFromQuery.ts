import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'

/** Aplica o parâmetro ?planta= (vindo de links do dashboard/insights) ao filtro global da topbar. */
export function useSyncPlantaFromQuery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const setPlantaSelecionada = useAppStore((s) => s.setPlantaSelecionada)

  useEffect(() => {
    const planta = searchParams.get('planta')
    if (planta) {
      setPlantaSelecionada(planta)
      setSearchParams(
        (atual) => {
          const proximo = new URLSearchParams(atual)
          proximo.delete('planta')
          return proximo
        },
        { replace: true },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
