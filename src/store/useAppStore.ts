import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Area,
  Cargo,
  CentroCusto,
  Colaborador,
  ConferenciaConciliacao,
  Divergencia,
  Documento,
  EventoHistorico,
  Folha,
  Horario,
  LogIntegracao,
  Movimentacao,
  PerfilDemo,
  Planta,
  Usuario,
  UsuarioDemo,
} from '@/types'
import { definirCatalogo } from '@/data/catalog'

// Antiga chave que guardava TODOS os dados de negócio no navegador. Removida: a fonte de verdade é a API.
const CHAVE_LEGADA = 'nexo-people-demo-v1'
try {
  localStorage.removeItem(CHAVE_LEGADA)
} catch {
  // armazenamento indisponível (modo privado etc.): nada a migrar
}

const MAX_LOGS = 300

export interface DadosBootstrap {
  plantas: Planta[]
  areas: Area[]
  cargos: Cargo[]
  centrosCusto: CentroCusto[]
  horarios: Horario[]
  folhas: Folha[]
  colaboradores: Colaborador[]
  movimentacoes: Movimentacao[]
  documentos: Documento[]
  historico: EventoHistorico[]
  divergencias: Divergencia[]
  conferencia: ConferenciaConciliacao
  logsIntegracao: LogIntegracao[]
  currentUser: Usuario
}

/** Resposta canônica de qualquer mutação de movimentação (recurso + documentos + eventos + logs). */
export interface RecursoMovimentacao {
  movimentacao: Movimentacao
  documentos: Documento[]
  historico: EventoHistorico[]
  logs: LogIntegracao[]
}

export interface RecursoDivergencia {
  divergencia: Divergencia
  colaborador: Colaborador
  logs: LogIntegracao[]
}

export interface RecursoConciliacao {
  conferencia: ConferenciaConciliacao
  divergencias: Divergencia[]
  colaboradores: Colaborador[]
  logs: LogIntegracao[]
}

interface DadosDoServidor {
  plantas: Planta[]
  areas: Area[]
  cargos: Cargo[]
  centrosCusto: CentroCusto[]
  horarios: Horario[]
  folhas: Folha[]
  colaboradores: Colaborador[]
  movimentacoes: Movimentacao[]
  documentos: Documento[]
  historico: EventoHistorico[]
  divergencias: Divergencia[]
  conferencia: ConferenciaConciliacao
  logsIntegracao: LogIntegracao[]
}

interface AppState extends DadosDoServidor {
  // ---- sessão (memória) ----
  hidratado: boolean
  currentUser: Usuario | null
  /** Perfil do usuário autenticado no servidor (derivado; nunca enviado ao servidor). */
  perfilAtivo: PerfilDemo
  usuariosDemo: UsuarioDemo[]

  // ---- preferências de UI (únicos dados persistidos no navegador) ----
  plantaSelecionadaId: string | 'todas'
  demoUserId: string | null

  setPlantaSelecionada: (id: string | 'todas') => void
  setDemoUserId: (id: string | null) => void
  definirUsuariosDemo: (usuarios: UsuarioDemo[]) => void
  aplicarBootstrap: (dados: DadosBootstrap) => void
  mesclarMovimentacao: (recurso: RecursoMovimentacao) => void
  mesclarDivergencia: (recurso: RecursoDivergencia) => void
  mesclarConciliacao: (recurso: RecursoConciliacao) => void
  mesclarLogs: (logs: LogIntegracao[]) => void
  substituirLogs: (logs: LogIntegracao[]) => void
}

function juntarLogs(atuais: LogIntegracao[], novos: LogIntegracao[]): LogIntegracao[] {
  if (novos.length === 0) return atuais
  const ids = new Set(atuais.map((l) => l.id))
  const todos = [...atuais, ...novos.filter((l) => !ids.has(l.id))]
  return todos.length > MAX_LOGS ? todos.slice(todos.length - MAX_LOGS) : todos
}

const VAZIO: DadosDoServidor = {
  plantas: [],
  areas: [],
  cargos: [],
  centrosCusto: [],
  horarios: [],
  folhas: [],
  colaboradores: [],
  movimentacoes: [],
  documentos: [],
  historico: [],
  divergencias: [],
  conferencia: { executadaEm: new Date(0).toISOString(), registrosComparados: 0 },
  logsIntegracao: [],
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...VAZIO,
      hidratado: false,
      currentUser: null,
      perfilAtivo: 'gestor',
      usuariosDemo: [],
      plantaSelecionadaId: 'todas',
      demoUserId: null,

      setPlantaSelecionada: (id) => set({ plantaSelecionadaId: id }),
      setDemoUserId: (id) => set({ demoUserId: id }),
      definirUsuariosDemo: (usuarios) => set({ usuariosDemo: usuarios }),

      aplicarBootstrap: (dados) => {
        definirCatalogo(dados)
        const { currentUser, ...resto } = dados
        const plantaAindaValida =
          get().plantaSelecionadaId === 'todas' || dados.plantas.some((p) => p.id === get().plantaSelecionadaId)
        set({
          ...resto,
          currentUser,
          perfilAtivo: currentUser.perfil,
          hidratado: true,
          plantaSelecionadaId: plantaAindaValida ? get().plantaSelecionadaId : 'todas',
        })
      },

      // Somente mescla o que o servidor devolveu: nenhuma transição é feita de forma otimista.
      mesclarMovimentacao: ({ movimentacao, documentos, historico, logs }) => {
        const s = get()
        const existe = s.movimentacoes.some((m) => m.id === movimentacao.id)
        set({
          movimentacoes: existe ? s.movimentacoes.map((m) => (m.id === movimentacao.id ? movimentacao : m)) : [...s.movimentacoes, movimentacao],
          documentos: [...s.documentos.filter((d) => d.movimentacaoId !== movimentacao.id), ...documentos],
          historico: [...s.historico.filter((e) => e.movimentacaoId !== movimentacao.id), ...historico],
          logsIntegracao: juntarLogs(s.logsIntegracao, logs),
        })
      },

      mesclarDivergencia: ({ divergencia, colaborador, logs }) => {
        const s = get()
        set({
          divergencias: s.divergencias.map((d) => (d.id === divergencia.id ? divergencia : d)),
          colaboradores: s.colaboradores.map((c) => (c.id === colaborador.id ? colaborador : c)),
          logsIntegracao: juntarLogs(s.logsIntegracao, logs),
        })
      },

      mesclarConciliacao: ({ conferencia, divergencias, colaboradores, logs }) => {
        const s = get()
        set({ conferencia, divergencias, colaboradores, logsIntegracao: juntarLogs(s.logsIntegracao, logs) })
      },

      mesclarLogs: (logs) => set({ logsIntegracao: juntarLogs(get().logsIntegracao, logs) }),
      substituirLogs: (logs) => set({ logsIntegracao: logs }),
    }),
    {
      name: 'nexo-people-ui-v1',
      version: 1,
      // Apenas preferências de UI. Colaboradores, salários, documentos, movimentações,
      // divergências, histórico e logs nunca são gravados no navegador.
      partialize: (s) => ({ plantaSelecionadaId: s.plantaSelecionadaId, demoUserId: s.demoUserId }),
    },
  ),
)
