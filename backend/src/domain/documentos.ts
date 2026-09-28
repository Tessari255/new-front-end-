import { createHash } from 'node:crypto'
import { regraDeNegocio } from '../errors.ts'
import type { TipoDocumento } from '../types.ts'

export const LIMITE_BYTES = 10 * 1024 * 1024
export const TIPOS_DOCUMENTO: TipoDocumento[] = ['evidencia', 'documento_aprovado', 'offer_letter', 'c_req', 'e_req']

interface FormatoPermitido {
  mimes: string[]
  assinatura: (b: Buffer) => boolean
}

const FORMATOS: Record<string, FormatoPermitido> = {
  pdf: { mimes: ['application/pdf'], assinatura: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  docx: {
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    assinatura: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  },
  png: {
    mimes: ['image/png'],
    assinatura: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  jpg: { mimes: ['image/jpeg'], assinatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  jpeg: { mimes: ['image/jpeg'], assinatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
}

export function sanitizarNomeArquivo(bruto: string): string {
  const base = bruto.split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const limpo = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').replace(/\s+/g, ' ').trim()
  if (!limpo) return 'arquivo'
  if (limpo.length <= 200) return limpo
  const ponto = limpo.lastIndexOf('.')
  const ext = ponto > 0 ? limpo.slice(ponto) : ''
  return limpo.slice(0, 200 - ext.length) + ext
}

function invalido(msg: string): never {
  throw regraDeNegocio('DOCUMENTO_INVALIDO', msg, { file: msg })
}

export function validarTipoDocumento(tipo: string | undefined): TipoDocumento {
  const t = (tipo ?? 'evidencia') as TipoDocumento
  if (!TIPOS_DOCUMENTO.includes(t)) {
    throw regraDeNegocio('DOCUMENTO_INVALIDO', 'Tipo de documento inválido.', { tipo: 'Tipo de documento inválido.' })
  }
  return t
}

/** Valida extensão, MIME declarado, conteúdo vazio, tamanho e assinatura real do arquivo. */
export function validarArquivo(entrada: { nome: string; mimeDeclarado: string; conteudo: Buffer; truncado: boolean }) {
  const nome = sanitizarNomeArquivo(entrada.nome)
  if (entrada.truncado || entrada.conteudo.length > LIMITE_BYTES) invalido('Arquivo acima do limite de 10 MB.')
  if (entrada.conteudo.length === 0) invalido('O arquivo está vazio.')
  const ext = nome.includes('.') ? nome.split('.').pop()!.toLowerCase() : ''
  const formato = FORMATOS[ext]
  if (!formato) invalido('Formato não permitido. Envie PDF, DOCX, PNG ou JPG.')
  const mime = entrada.mimeDeclarado.split(';')[0]!.trim().toLowerCase()
  if (!formato.mimes.includes(mime)) invalido('O tipo do arquivo não corresponde à extensão informada.')
  if (!formato.assinatura(entrada.conteudo)) invalido('O conteúdo do arquivo não corresponde ao formato informado.')
  return { nome, mime: formato.mimes[0]!, sha256: createHash('sha256').update(entrada.conteudo).digest('hex') }
}

/** Content-Disposition seguro (fallback ASCII + filename* RFC 5987). */
export function contentDispositionAnexo(nome: string): string {
  const ascii = nome.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`
}
