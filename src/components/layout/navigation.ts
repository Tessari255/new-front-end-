import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Users, ArrowLeftRight, ClipboardCheck, GitCompareArrows, History, Terminal, Lock } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/colaboradores', label: 'Colaboradores', icon: Users },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/aprovacoes', label: 'Aprovações', icon: ClipboardCheck },
  { to: '/conciliacao', label: 'Conciliação de dados', icon: GitCompareArrows },
  { to: '/folha', label: 'Fechamento da folha', icon: Lock },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/integracao', label: 'Log de integração', icon: Terminal },
]
