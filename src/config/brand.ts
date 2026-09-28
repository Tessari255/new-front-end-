/**
 * Configuração central de marca. Alterar aqui propaga nome, logotipo e
 * paleta para toda a aplicação (sidebar, topbar, favicon, exportações).
 */
export const brand = {
  name: 'Nexo People',
  shortName: 'Nexo',
  initials: 'NP',
  tagline: 'Operações de RH, do pedido à conclusão',
  colors: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    ink: '#17212B',
    accent: '#F43F5E',
    accentInk: '#FFFFFF',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
  },
} as const

export type Brand = typeof brand
