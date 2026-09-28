import type { AccountInfo, IPublicClientApplication } from '@azure/msal-browser'

interface MicrosoftAuthConfig {
  tenantId: string
  clientId: string
  apiScope: string
}

function envValue(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

const tenantId = envValue(import.meta.env.VITE_MICROSOFT_TENANT_ID)
const clientId = envValue(import.meta.env.VITE_MICROSOFT_CLIENT_ID)
const apiScope = envValue(import.meta.env.VITE_MICROSOFT_API_SCOPE)

const microsoftConfig: MicrosoftAuthConfig | null = tenantId && clientId && apiScope ? { tenantId, clientId, apiScope } : null
const hasPartialMicrosoftConfig = Boolean(tenantId || clientId || apiScope) && !microsoftConfig

export const microsoftAuthEnabled = microsoftConfig !== null
export const microsoftAuthConfigurationError = hasPartialMicrosoftConfig
  ? 'A configuração do SSO Microsoft está incompleta. Defina VITE_MICROSOFT_TENANT_ID, VITE_MICROSOFT_CLIENT_ID e VITE_MICROSOFT_API_SCOPE.'
  : null

let clientPromise: Promise<IPublicClientApplication> | undefined
let initializationPromise: Promise<AccountInfo | null> | undefined
let msalBrowserPromise: Promise<typeof import('@azure/msal-browser')> | undefined

function requireMicrosoftConfig(): MicrosoftAuthConfig {
  if (!microsoftConfig) throw new Error('O SSO Microsoft não está configurado.')
  return microsoftConfig
}

function microsoftBrowser() {
  msalBrowserPromise ??= import('@azure/msal-browser')
  return msalBrowserPromise
}

async function microsoftClient(): Promise<IPublicClientApplication> {
  if (!clientPromise) {
    const config = requireMicrosoftConfig()
    const msal = await microsoftBrowser()
    clientPromise ??= msal.createStandardPublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}`,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: { cacheLocation: msal.BrowserCacheLocation.SessionStorage },
    })
  }
  try {
    return await clientPromise
  } catch (error) {
    clientPromise = undefined
    throw error
  }
}

function activeAccount(client: IPublicClientApplication, preferred?: AccountInfo | null): AccountInfo | null {
  const account = preferred ?? client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null
  client.setActiveAccount(account)
  return account
}

/** Inicializa MSAL e consome a resposta do redirect exatamente uma vez por carga da página. */
export async function initializeMicrosoftAuth(): Promise<AccountInfo | null> {
  if (!microsoftAuthEnabled) return null
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const client = await microsoftClient()
      const result = await client.handleRedirectPromise()
      return activeAccount(client, result?.account)
    })()
  }
  try {
    return await initializationPromise
  } catch (error) {
    initializationPromise = undefined
    throw error
  }
}

const loginRequest = () => ({ scopes: [requireMicrosoftConfig().apiScope] })

/** Redireciona para o Microsoft Entra; MSAL usa Authorization Code + PKCE para SPAs. */
export async function signInWithMicrosoft(): Promise<void> {
  const client = await microsoftClient()
  await initializeMicrosoftAuth()
  await client.loginRedirect(loginRequest())
}

/** Obtém um access token para a API sem expô-lo ao Zustand ou ao localStorage. */
export async function getMicrosoftAccessToken(): Promise<string | null> {
  const account = await initializeMicrosoftAuth()
  if (!account) return null

  const client = await microsoftClient()
  try {
    return (await client.acquireTokenSilent({ ...loginRequest(), account })).accessToken
  } catch (error) {
    const { InteractionRequiredAuthError } = await microsoftBrowser()
    if (error instanceof InteractionRequiredAuthError) {
      await client.acquireTokenRedirect({ ...loginRequest(), account })
      return null
    }
    throw error
  }
}

/** Encerra a sessão local do MSAL e redireciona pelo logout do Entra. */
export async function signOutFromMicrosoft(): Promise<void> {
  const client = await microsoftClient()
  const account = await initializeMicrosoftAuth()
  await client.logoutRedirect({ account: account ?? undefined })
}
