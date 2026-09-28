// Envia uma mensagem de teste pelo SMTP configurado: npm run email:teste -- destinatario@exemplo.com
import { loadConfig } from '../src/config.ts'
import { criarEnvioSmtp } from '../src/email.ts'

const para = process.argv[2]
if (!para) {
  console.error('Uso: npm run email:teste -- destinatario@exemplo.com')
  process.exit(1)
}
const { emailSenha } = loadConfig()
if (!emailSenha) throw new Error('Defina AUTH_EMAIL_SENHA=true, APP_URL, SMTP_* e EMAIL_FROM no backend/.env.')
await criarEnvioSmtp(emailSenha.smtp)({
  para,
  assunto: 'Teste de envio — Nexo People',
  texto: 'Se você recebeu esta mensagem, o envio de e-mails do Nexo People está configurado.\n',
})
console.log('Mensagem aceita pelo servidor SMTP. Confira a caixa de entrada e a pasta de spam.')
