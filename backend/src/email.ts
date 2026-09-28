import nodemailer from 'nodemailer'
import type { SmtpConfig } from './config.ts'

export interface Email {
  para: string
  assunto: string
  texto: string
}

export type EnviarEmail = (email: Email) => Promise<void>

/** Envio real via SMTP autenticado com TLS obrigatório (465 = TLS implícito; demais portas = STARTTLS). */
export function criarEnvioSmtp(smtp: SmtpConfig): EnviarEmail {
  const transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    requireTLS: smtp.port !== 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    tls: { minVersion: 'TLSv1.2' },
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  return async ({ para, assunto, texto }) => {
    await transporte.sendMail({ from: smtp.from, to: para, subject: assunto, text: texto })
  }
}
