import { useLocation } from 'react-router-dom'

const TITULOS_EXATOS: Record<string, string> = {
  '/': 'Visão geral',
  '/colaboradores': 'Colaboradores',
  '/movimentacoes': 'Movimentações',
  '/movimentacoes/nova': 'Nova movimentação',
  '/aprovacoes': 'Aprovações',
  '/conciliacao': 'Conciliação de dados',
  '/historico': 'Histórico e evidências',
  '/integracao': 'Log de integração',
}

const PREFIXOS: [string, string][] = [
  ['/colaboradores/', 'Colaborador'],
  ['/movimentacoes/', 'Movimentação'],
  ['/conciliacao/', 'Divergência'],
]

export function useTituloRota(): string {
  const { pathname } = useLocation()
  if (TITULOS_EXATOS[pathname]) return TITULOS_EXATOS[pathname]!
  for (const [prefixo, titulo] of PREFIXOS) {
    if (pathname.startsWith(prefixo)) return titulo
  }
  return 'Nexo People'
}
