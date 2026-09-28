import type { PerfilDemoInfo } from '@/types'

export const PERFIS_DEMO: PerfilDemoInfo[] = [
  {
    id: 'gestor',
    nome: 'Gestor direto',
    descricao: 'Aprova as movimentações da própria equipe (1ª etapa).',
    etapa: 'gestor',
  },
  {
    id: 'rh_local',
    nome: 'RH Local',
    descricao: 'Confere dados e políticas da planta (2ª etapa).',
    etapa: 'rh_local',
  },
  {
    id: 'rh_central',
    nome: 'RH Central',
    descricao: 'Aprovação final e liberação para processamento (3ª etapa).',
    etapa: 'rh_central',
  },
  {
    id: 'auditoria',
    nome: 'Auditoria',
    descricao: 'Visualização completa do fluxo, sem ações de aprovação.',
    etapa: null,
  },
]

export function getPerfilDemo(id: string): PerfilDemoInfo | undefined {
  return PERFIS_DEMO.find((p) => p.id === id)
}
