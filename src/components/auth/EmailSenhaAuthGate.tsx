import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { ApiError, mensagemDeErro } from '@/lib/apiClient'
import {
  confirmarCadastro,
  entrar,
  redefinirSenha,
  solicitarCadastro,
  solicitarRecuperacao,
  verificarSessao,
} from '@/services/authService'

type Tela = 'carregando' | 'pronto' | 'login' | 'cadastro' | 'recuperar' | 'confirmar' | 'redefinir'

/** Lê o token do fragmento (#token=…, nunca enviado a servidores) e o remove da barra de endereço e do histórico. */
function lerLinkDeEmail(): { tela: Tela; token: string } | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
  const tela = window.location.pathname === '/confirmar-email' ? 'confirmar' : window.location.pathname === '/redefinir-senha' ? 'redefinir' : null
  if (!token || !tela) return null
  window.history.replaceState(null, '', '/')
  return { tela, token }
}

const TITULOS: Record<Exclude<Tela, 'carregando' | 'pronto'>, string> = {
  login: 'Entre no Nexo People',
  cadastro: 'Ativar acesso',
  recuperar: 'Recuperar senha',
  confirmar: 'Confirme seu cadastro e crie sua senha',
  redefinir: 'Crie uma nova senha',
}

export function EmailSenhaAuthGate({ children }: { children: ReactNode }) {
  const [link] = useState(lerLinkDeEmail)
  const [tela, setTela] = useState<Tela>(link?.tela ?? 'carregando')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (tela !== 'carregando') return
    verificarSessao()
      .then(() => setTela('pronto'))
      .catch((e: unknown) => {
        if (!(e instanceof ApiError && e.status === 401)) setErro(mensagemDeErro(e))
        setTela('login')
      })
  }, [tela])

  if (tela === 'pronto') return <>{children}</>
  if (tela === 'carregando') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)]">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" role="status" aria-label="Carregando" />
      </div>
    )
  }

  const ir = (proxima: Tela) => {
    setErro(null)
    setAviso(null)
    setSenha('')
    setSenha2('')
    setTela(proxima)
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setAviso(null)
    if ((tela === 'confirmar' || tela === 'redefinir') && senha !== senha2) {
      setErro('As senhas não coincidem.')
      return
    }
    setEnviando(true)
    try {
      const emailLimpo = email.trim()
      if (tela === 'login') {
        await entrar(emailLimpo, senha)
        setSenha('')
        setTela('pronto')
      } else if (tela === 'cadastro') {
        setAviso((await solicitarCadastro(emailLimpo)).mensagem)
      } else if (tela === 'recuperar') {
        setAviso((await solicitarRecuperacao(emailLimpo)).mensagem)
      } else if (link) {
        const { mensagem } = await (tela === 'confirmar' ? confirmarCadastro : redefinirSenha)(link.token, senha)
        ir('login')
        setAviso(mensagem)
      }
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  const pedeEmail = tela === 'login' || tela === 'cadastro' || tela === 'recuperar'
  const pedeSenha = tela !== 'cadastro' && tela !== 'recuperar'
  const novaSenha = tela === 'confirmar' || tela === 'redefinir'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] px-4">
      <form onSubmit={(e) => void enviar(e)} className="w-full max-w-md space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-card)]">
        <h1 className="text-lg font-semibold text-[var(--color-ink)]">{TITULOS[tela]}</h1>
        {tela === 'cadastro' && (
          <p className="text-sm text-[var(--color-ink-muted)]">Informe o e-mail cadastrado pelo RH. Enviaremos um link para confirmar o endereço e criar sua senha.</p>
        )}
        {pedeEmail && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">E-mail</Label>
            <Input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        {pedeSenha && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-senha">{novaSenha ? 'Nova senha (mínimo 12 caracteres)' : 'Senha'}</Label>
            <Input
              id="auth-senha"
              type="password"
              autoComplete={novaSenha ? 'new-password' : 'current-password'}
              required
              minLength={novaSenha ? 12 : 1}
              maxLength={128}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
        )}
        {novaSenha && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-senha2">Repita a nova senha</Label>
            <Input id="auth-senha2" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={senha2} onChange={(e) => setSenha2(e.target.value)} />
          </div>
        )}
        {erro && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {erro}
          </p>
        )}
        {aviso && (
          <p role="status" className="text-sm text-[var(--color-ink-muted)]">
            {aviso}
          </p>
        )}
        <Button className="w-full" type="submit" loading={enviando}>
          {tela === 'login' ? 'Entrar' : tela === 'cadastro' || tela === 'recuperar' ? 'Enviar link' : 'Salvar senha'}
        </Button>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
          {tela !== 'login' && (
            <Button type="button" variant="link" onClick={() => ir('login')}>
              Voltar para o login
            </Button>
          )}
          {tela === 'login' && (
            <>
              <Button type="button" variant="link" onClick={() => ir('cadastro')}>
                Primeiro acesso
              </Button>
              <Button type="button" variant="link" onClick={() => ir('recuperar')}>
                Esqueci minha senha
              </Button>
            </>
          )}
        </div>
      </form>
    </main>
  )
}
