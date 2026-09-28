// Login por e-mail e senha (sessão em cookie HttpOnly definido pela API; nada é guardado no navegador).
import { apiJson } from '@/lib/apiClient'

export const emailSenhaAuthEnabled = import.meta.env.VITE_AUTH_EMAIL_SENHA === 'true'

type Mensagem = { mensagem: string }
const post = <T,>(caminho: string, json: object) => apiJson<T>(caminho, { method: 'POST', json })

export const verificarSessao = () => apiJson('/auth/sessao')
export const entrar = (email: string, senha: string) => post('/auth/login', { email, senha })
export const solicitarCadastro = (email: string) => post<Mensagem>('/auth/cadastro', { email })
export const confirmarCadastro = (token: string, senha: string) => post<Mensagem>('/auth/confirmar', { token, senha })
export const solicitarRecuperacao = (email: string) => post<Mensagem>('/auth/recuperar-senha', { email })
export const redefinirSenha = (token: string, senha: string) => post<Mensagem>('/auth/redefinir-senha', { token, senha })

export async function sair(): Promise<void> {
  await post('/auth/logout', {})
  window.location.assign('/')
}
