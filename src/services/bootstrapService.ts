// Hidratação do estado inicial a partir da API (/bootstrap) e troca de usuário demo.
import { ApiError, apiJson, definirUsuarioDemo } from '@/lib/apiClient'
import { useAppStore, type DadosBootstrap } from '@/store/useAppStore'
import type { LogIntegracao, UsuarioDemo } from '@/types'

async function listarUsuariosDemo(): Promise<UsuarioDemo[]> {
  try {
    return (await apiJson<{ usuarios: UsuarioDemo[] }>('/dev/users')).usuarios
  } catch (erro) {
    // Fora do modo demo o recurso não existe (404): a identidade real virá do SSO (ainda não definido).
    if (erro instanceof ApiError && erro.status === 404) return []
    throw erro
  }
}

export async function carregarDadosIniciais(): Promise<void> {
  const store = useAppStore.getState()
  const usuarios = await listarUsuariosDemo()
  store.definirUsuariosDemo(usuarios)
  const escolhido = usuarios.find((u) => u.id === store.demoUserId) ?? usuarios.find((u) => u.perfil === 'gestor') ?? usuarios[0]
  definirUsuarioDemo(escolhido?.id ?? null)
  const dados = await apiJson<DadosBootstrap>('/bootstrap', { timeoutMs: 20_000 })
  if (escolhido) store.setDemoUserId(escolhido.id)
  useAppStore.getState().aplicarBootstrap(dados)
}

export async function trocarUsuarioDemo(id: string): Promise<void> {
  useAppStore.getState().setDemoUserId(id)
  await carregarDadosIniciais()
}

/** Recarrega o log de integração do servidor (inclui registros de falhas de chamadas anteriores). */
export async function carregarLogs(): Promise<void> {
  const { logsIntegracao } = await apiJson<{ logsIntegracao: LogIntegracao[] }>('/logs-integracao')
  useAppStore.getState().substituirLogs(logsIntegracao)
}

/** Executa uma mutação; em caso de erro, atualiza o log (o servidor registra falhas) e repropaga. */
export async function mutar<T>(chamada: () => Promise<T>): Promise<T> {
  try {
    return await chamada()
  } catch (erro) {
    if (erro instanceof ApiError && erro.status !== 0 && erro.status !== 401) void carregarLogs().catch(() => undefined)
    throw erro
  }
}
