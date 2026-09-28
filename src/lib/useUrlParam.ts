import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

/** Sincroniza um filtro simples com a query string, preservando os demais parâmetros. */
export function useUrlParam(chave: string, padrao = '') {
  const [searchParams, setSearchParams] = useSearchParams()
  const valor = searchParams.get(chave) ?? padrao

  const setValor = useCallback(
    (novo: string) => {
      setSearchParams(
        (atual) => {
          const proximo = new URLSearchParams(atual)
          if (!novo || novo === padrao) proximo.delete(chave)
          else proximo.set(chave, novo)
          if (chave !== 'pagina') proximo.delete('pagina')
          return proximo
        },
        { replace: true },
      )
    },
    [chave, padrao, setSearchParams],
  )

  return [valor, setValor] as const
}
