import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { COOKIE_SESSAO, hashDaSessao, lerCookie } from './authSenha.ts'
import type { Config, MicrosoftEntraConfig } from './config.ts'
import { naoAutenticado, proibido } from './errors.ts'
import { PERFIL_DA_ETAPA } from './domain/fluxo.ts'
import type { EtapaMovimentacao, PerfilDemo, Usuario } from './types.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface UsuarioAutenticado extends Usuario {
  /** null = todas as plantas; array (possivelmente vazio) = plantas autorizadas. */
  plantasAutorizadas: string[] | null
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: UsuarioAutenticado
  }
  interface FastifyContextConfig {
    publica?: boolean
  }
}

interface UsuarioRow {
  id: string
  nome: string
  email: string
  perfil: PerfilDemo
  planta_id: string | null
  colaborador_id: string | null
  colaborador_planta_id: string | null
}

const SELECT_USUARIO = `select u.id, u.nome, u.email, u.perfil, u.planta_id, u.colaborador_id, c.planta_id as colaborador_planta_id
  from usuarios u
  left join colaboradores c on c.id = u.colaborador_id`

async function buscarUsuario(pool: pg.Pool, campo: 'id' | 'subject', valor: string): Promise<UsuarioRow | undefined> {
  const onde = campo === 'id' ? 'u.id = $1' : 'u.subject = $1'
  const { rows } = await pool.query<UsuarioRow>(`${SELECT_USUARIO} where ${onde} and u.ativo`, [valor])
  return rows[0]
}

async function buscarUsuarioDaSessao(pool: pg.Pool, sessao: string): Promise<UsuarioRow | undefined> {
  const { rows } = await pool.query<UsuarioRow>(
    `${SELECT_USUARIO} join sessoes s on s.usuario_id = u.id
      where s.token_hash = $1 and s.expira_em > now() and u.ativo and u.email_verificado_em is not null`,
    [hashDaSessao(sessao)],
  )
  return rows[0]
}

export function escopoDePlantas(row: Pick<UsuarioRow, 'perfil' | 'planta_id' | 'colaborador_planta_id'>): string[] | null {
  if (row.perfil === 'gestor') return row.colaborador_planta_id ? [row.colaborador_planta_id] : []
  if (row.perfil === 'rh_local') return row.planta_id ? [row.planta_id] : []
  // RH Central, Auditoria e Share: sem planta = todas; com planta = apenas a planta indicada.
  return row.planta_id ? [row.planta_id] : null
}

function usuarioAutenticado(row: UsuarioRow): UsuarioAutenticado {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    perfil: row.perfil,
    plantaId: row.planta_id,
    colaboradorId: row.colaborador_id,
    plantasAutorizadas: escopoDePlantas(row),
  }
}

function bearer(cabecalho: string | string[] | undefined): string {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho
  const partes = valor?.trim().split(/\s+/)
  if (!partes || partes.length !== 2 || partes[0]!.toLowerCase() !== 'bearer' || !partes[1]) throw naoAutenticado()
  return partes[1]
}

function textoDoClaim(payload: JWTPayload, nome: string): string | undefined {
  const valor = payload[nome]
  return typeof valor === 'string' ? valor : undefined
}

function criarVerificadorMicrosoft(config: MicrosoftEntraConfig) {
  const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`))
  const issuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`

  return async (token: string): Promise<string> => {
    let payload: JWTPayload
    try {
      ;({ payload } = await jwtVerify(token, jwks, { issuer, audience: config.audience, algorithms: ['RS256'] }))
    } catch {
      throw naoAutenticado()
    }

    const tenantId = textoDoClaim(payload, 'tid')?.toLowerCase()
    const objectId = textoDoClaim(payload, 'oid')?.toLowerCase()
    const authorizedParty = textoDoClaim(payload, 'azp')?.toLowerCase()
    const scopes = textoDoClaim(payload, 'scp')?.split(/\s+/) ?? []
    if (
      tenantId !== config.tenantId ||
      !objectId ||
      !UUID.test(objectId) ||
      authorizedParty !== config.spaClientId ||
      !scopes.includes(config.requiredScope) ||
      textoDoClaim(payload, 'ver') !== '2.0' ||
      !Number.isFinite(payload.exp) ||
      !Number.isFinite(payload.nbf)
    ) {
      throw naoAutenticado()
    }
    return `entra:${tenantId}:${objectId}`
  }
}

/** Único preHandler de identidade: demo local, sessão de e-mail e senha (cookie) ou access token Microsoft Entra. */
export function criarAuthHook(pool: pg.Pool, config: Pick<Config, 'demoMode' | 'microsoftEntra' | 'emailSenha'>) {
  const verificarMicrosoft = config.microsoftEntra ? criarVerificadorMicrosoft(config.microsoftEntra) : undefined
  return async function authHook(request: FastifyRequest, _reply: FastifyReply) {
    if (request.routeOptions.config.publica) return

    let row: UsuarioRow | undefined
    const sessao = config.emailSenha ? lerCookie(request.headers.cookie, COOKIE_SESSAO) : undefined
    if (config.demoMode) {
      const header = request.headers['x-demo-user-id']
      const valor = Array.isArray(header) ? header[0] : header
      if (!valor || !/^\d{1,18}$/.test(valor)) throw naoAutenticado()
      row = await buscarUsuario(pool, 'id', valor)
    } else if (sessao) {
      row = await buscarUsuarioDaSessao(pool, sessao)
    } else {
      if (!verificarMicrosoft) throw naoAutenticado(config.emailSenha ? undefined : 'Autenticação Microsoft Entra não configurada.')
      const subject = await verificarMicrosoft(bearer(request.headers.authorization))
      row = await buscarUsuario(pool, 'subject', subject)
    }

    if (!row) throw naoAutenticado()
    request.usuario = usuarioAutenticado(row)
  }
}

export function exigirUsuario(request: FastifyRequest): UsuarioAutenticado {
  if (!request.usuario) throw naoAutenticado()
  return request.usuario
}

export function usuarioPublico(u: UsuarioAutenticado): Usuario {
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, plantaId: u.plantaId, colaboradorId: u.colaboradorId }
}

export function temAcessoAPlanta(u: UsuarioAutenticado, plantaId: string): boolean {
  return u.plantasAutorizadas === null || u.plantasAutorizadas.includes(plantaId)
}

export function exigirEscrita(u: UsuarioAutenticado) {
  if (u.perfil === 'auditoria') throw proibido('Auditoria possui acesso somente leitura.')
  // Share só trava/libera o fechamento da folha; não abre, edita nem decide movimentações.
  if (u.perfil === 'share') throw proibido('Share não tem permissão para movimentações — apenas para o fechamento da folha.')
}

export function exigirPerfil(u: UsuarioAutenticado, ...perfis: PerfilDemo[]) {
  if (!perfis.includes(u.perfil)) throw proibido()
}

/**
 * Quem pode decidir a etapa atual:
 * - Gestor: apenas a etapa `gestor`, quando é o gestor direto do colaborador OU (em tipos que
 *   exigem aprovação dupla, como transferência de localidade) o gestor de destino informado;
 * - RH Local: apenas `rh_local`, na sua planta;
 * - RH Central: apenas `rh_central`, nas plantas autorizadas;
 * - Auditoria e Share: nunca.
 */
export function podeDecidirEtapa(
  u: UsuarioAutenticado,
  etapa: EtapaMovimentacao,
  mov: { plantaId: string; colaboradorGestorId: string | null; colaboradorGestorDestinoId?: string | null },
): boolean {
  if (etapa === 'concluida') return false
  if (PERFIL_DA_ETAPA[etapa] !== u.perfil) return false
  if (u.perfil === 'gestor') {
    if (u.colaboradorId === null) return false
    // Gestor de destino decide independentemente do escopo de planta (a movimentação carrega a
    // planta de origem); o gestor de origem segue exigindo acesso à planta normalmente.
    if (mov.colaboradorGestorDestinoId && mov.colaboradorGestorDestinoId === u.colaboradorId) return true
    return mov.colaboradorGestorId === u.colaboradorId && temAcessoAPlanta(u, mov.plantaId)
  }
  return temAcessoAPlanta(u, mov.plantaId)
}
