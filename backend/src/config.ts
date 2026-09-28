try {
  process.loadEnvFile('.env')
} catch {
  // .env é opcional; variáveis podem vir do ambiente.
}

export interface Config {
  databaseUrl: string
  port: number
  corsOrigins: string[]
  demoMode: boolean
  microsoftEntra?: MicrosoftEntraConfig
  emailSenha?: EmailSenhaConfig
  /** Saltos de proxy confiáveis para obter o IP real (X-Forwarded-For); 0 = nenhum. */
  trustProxy: number
  nodeEnv: string
  poolMax: number
  statementTimeoutMs: number
  logLevel: string
}

export interface MicrosoftEntraConfig {
  /** Tenant único do Microsoft Entra que pode emitir tokens para a API. */
  tenantId: string
  /** Claim `aud` do access token destinado a esta API. */
  audience: string
  /** Client ID da SPA autorizada a chamar a API (`azp`). */
  spaClientId: string
  /** Escopo delegado obrigatório no claim `scp`. */
  requiredScope: string
}

export interface EmailSenhaConfig {
  /** Origem do frontend usada nos links enviados por e-mail. */
  appUrl: string
  /** Cookie de sessão com atributo Secure (sempre em produção). */
  cookieSeguro: boolean
  smtp: SmtpConfig
}

export interface SmtpConfig {
  host: string
  port: number
  user?: string
  password?: string
  /** Remetente, ex.: "Nexo People <nao-responder@empresa.com.br>" (domínio com SPF/DKIM/DMARC). */
  from: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function texto(env: NodeJS.ProcessEnv, nome: string): string | undefined {
  const valor = env[nome]?.trim()
  return valor || undefined
}

function carregarMicrosoftEntra(env: NodeJS.ProcessEnv): MicrosoftEntraConfig | undefined {
  const tenantId = texto(env, 'MICROSOFT_ENTRA_TENANT_ID')
  const audience = texto(env, 'MICROSOFT_ENTRA_AUDIENCE')
  const spaClientId = texto(env, 'MICROSOFT_ENTRA_SPA_CLIENT_ID')
  const requiredScope = texto(env, 'MICROSOFT_ENTRA_REQUIRED_SCOPE')
  const valores = [tenantId, audience, spaClientId, requiredScope]
  if (valores.every((valor) => !valor)) return undefined
  if (valores.some((valor) => !valor)) throw new Error('Configure todas as variáveis MICROSOFT_ENTRA_* ou nenhuma delas.')
  if (!UUID.test(tenantId!)) throw new Error('MICROSOFT_ENTRA_TENANT_ID deve ser um UUID do tenant.')
  if (!UUID.test(spaClientId!)) throw new Error('MICROSOFT_ENTRA_SPA_CLIENT_ID deve ser o Application (client) ID da SPA.')
  if (/\s/.test(audience!) || audience!.length > 300) throw new Error('MICROSOFT_ENTRA_AUDIENCE inválida.')
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(requiredScope!)) throw new Error('MICROSOFT_ENTRA_REQUIRED_SCOPE inválido.')
  return { tenantId: tenantId!.toLowerCase(), audience: audience!, spaClientId: spaClientId!.toLowerCase(), requiredScope: requiredScope! }
}

function carregarEmailSenha(env: NodeJS.ProcessEnv, nodeEnv: string): EmailSenhaConfig | undefined {
  if (env.AUTH_EMAIL_SENHA !== 'true') return undefined
  const appUrl = texto(env, 'APP_URL')
  const host = texto(env, 'SMTP_HOST')
  const from = texto(env, 'EMAIL_FROM')
  const user = texto(env, 'SMTP_USER')
  const password = env.SMTP_PASSWORD || undefined
  const port = Number(texto(env, 'SMTP_PORT') ?? 587)
  if (!appUrl || !host || !from) throw new Error('AUTH_EMAIL_SENHA=true exige APP_URL, SMTP_HOST e EMAIL_FROM.')
  if (Boolean(user) !== Boolean(password)) throw new Error('Defina SMTP_USER e SMTP_PASSWORD juntos.')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT inválida.')
  const origem = carregarCorsOrigins(appUrl)[0]!
  const producao = nodeEnv === 'production'
  if (producao && !origem.startsWith('https:')) throw new Error('APP_URL deve usar HTTPS em produção.')
  return { appUrl: origem, cookieSeguro: producao, smtp: { host, port, user, password, from } }
}

function carregarCorsOrigins(valor: string): string[] {
  const origins = valor
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean)
  if (origins.length === 0 || origins.includes('*')) throw new Error('CORS_ORIGIN deve conter origens explícitas; "*" não é permitido.')
  return origins.map((origem) => {
    let url: URL
    try {
      url = new URL(origem)
    } catch {
      throw new Error(`CORS_ORIGIN inválida: ${origem}`)
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`CORS_ORIGIN deve ser uma origem HTTP(S) sem caminho: ${origem}`)
    }
    return url.origin
  })
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = env.NODE_ENV ?? 'development'
  const demoMode = env.DEMO_MODE === 'true'
  const microsoftEntra = carregarMicrosoftEntra(env)
  const emailSenha = carregarEmailSenha(env, nodeEnv)
  if (demoMode && !['development', 'test'].includes(nodeEnv)) throw new Error('DEMO_MODE=true só é permitido em development ou test.')
  if (demoMode && emailSenha) throw new Error('AUTH_EMAIL_SENHA=true exige DEMO_MODE=false.')
  if (!demoMode && nodeEnv === 'production' && !microsoftEntra && !emailSenha) {
    throw new Error('Em produção, configure MICROSOFT_ENTRA_* e/ou AUTH_EMAIL_SENHA=true.')
  }
  const trustProxy = Number(env.TRUST_PROXY ?? 0)
  if (!Number.isInteger(trustProxy) || trustProxy < 0) throw new Error('TRUST_PROXY deve ser o número de proxies confiáveis (0 = nenhum).')
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL não definida.')
  return {
    databaseUrl,
    port: Number(env.PORT ?? 3001),
    corsOrigins: carregarCorsOrigins(env.CORS_ORIGIN ?? 'http://localhost:4300'),
    demoMode,
    microsoftEntra,
    emailSenha,
    trustProxy,
    nodeEnv,
    poolMax: Number(env.DB_POOL_MAX ?? 10),
    statementTimeoutMs: Number(env.DB_STATEMENT_TIMEOUT_MS ?? 15000),
    logLevel: env.LOG_LEVEL ?? 'info',
  }
}
