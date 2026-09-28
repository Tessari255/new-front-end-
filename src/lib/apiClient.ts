// Cliente HTTP central da aplicação: base URL, identidade demo, timeout, JSON, multipart,
// download e conversão do formato de erro da API.
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001/api/v1').replace(/\/+$/, '')
// Login por e-mail e senha: a sessão é um cookie HttpOnly da API, enviado só quando esse modo está ativo.
const CREDENCIAIS: RequestCredentials = import.meta.env.VITE_AUTH_EMAIL_SENHA === 'true' ? 'include' : 'same-origin'

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors: Record<string, string>
  correlationId?: string

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}, correlationId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.correlationId = correlationId
  }
}

let demoUserId: string | null = null
type AccessTokenProvider = () => Promise<string | null>
let accessTokenProvider: AccessTokenProvider | null = null

export function definirUsuarioDemo(id: string | null) {
  demoUserId = id
}

/** Registra a única fonte de Bearer token; o token em si nunca é persistido aqui. */
export function definirProvedorDeTokenDeAcesso(provider: AccessTokenProvider | null) {
  accessTokenProvider = provider
  if (provider) demoUserId = null
}

interface Opcoes {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  json?: unknown
  formData?: FormData
  timeoutMs?: number
}

async function requisitar(caminho: string, opcoes: Opcoes = {}): Promise<Response> {
  const accessToken = accessTokenProvider ? await accessTokenProvider() : null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opcoes.timeoutMs ?? 15_000)
  const headers: Record<string, string> = { 'X-Correlation-Id': crypto.randomUUID() }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  else if (!accessTokenProvider && demoUserId) headers['X-Demo-User-Id'] = demoUserId
  let body: BodyInit | undefined
  if (opcoes.formData) body = opcoes.formData
  else if (opcoes.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opcoes.json)
  }
  let resposta: Response
  try {
    resposta = await fetch(`${API_URL}${caminho}`, { method: opcoes.method ?? 'GET', headers, body, signal: controller.signal, credentials: CREDENCIAIS })
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') {
      throw new ApiError(0, 'TEMPO_ESGOTADO', 'A API demorou demais para responder. Tente novamente.')
    }
    throw new ApiError(0, 'API_INDISPONIVEL', 'Não foi possível conectar à API. Verifique se o backend está em execução.')
  } finally {
    clearTimeout(timeout)
  }
  if (!resposta.ok) throw await converterErro(resposta)
  return resposta
}

async function converterErro(resposta: Response): Promise<ApiError> {
  try {
    const corpo = (await resposta.json()) as { error?: { code?: string; message?: string; fieldErrors?: Record<string, string>; correlationId?: string } }
    const e = corpo.error
    if (e) return new ApiError(resposta.status, e.code ?? 'ERRO', e.message ?? 'Erro ao processar a requisição.', e.fieldErrors ?? {}, e.correlationId)
  } catch {
    // corpo não-JSON: cai no genérico abaixo
  }
  return new ApiError(resposta.status, 'ERRO_HTTP', `A API respondeu com erro ${resposta.status}.`)
}

export async function apiJson<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const resposta = await requisitar(caminho, opcoes)
  return (await resposta.json()) as T
}

export interface ArquivoBaixado {
  blob: Blob
  nome: string
  geradoEm?: string
}

function nomeDoContentDisposition(valor: string | null, padrao: string): string {
  if (!valor) return padrao
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(valor)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      // segue para o filename simples
    }
  }
  const simples = /filename="([^"]+)"/i.exec(valor)
  return simples?.[1] ?? padrao
}

export async function apiDownload(caminho: string, opcoes: Opcoes = {}): Promise<ArquivoBaixado> {
  const resposta = await requisitar(caminho, { timeoutMs: 60_000, ...opcoes })
  return {
    blob: await resposta.blob(),
    nome: nomeDoContentDisposition(resposta.headers.get('Content-Disposition'), 'arquivo'),
    geradoEm: resposta.headers.get('X-Gerado-Em') ?? undefined,
  }
}

/** Dispara o download de um Blob recebido do servidor. */
export function salvarArquivo({ blob, nome }: ArquivoBaixado) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Mensagem segura para exibir na interface (inclui erros de campo devolvidos pela API). */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ApiError) {
    const campos = Object.values(erro.fieldErrors).filter((m) => m && m !== erro.message)
    return campos.length > 0 ? `${erro.message} ${campos.join(' ')}` : erro.message
  }
  return erro instanceof Error ? erro.message : 'Ocorreu um erro inesperado.'
}
