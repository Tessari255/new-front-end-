import * as React from 'react'
import { CheckCircle2, ClipboardCheck, Download, FileSpreadsheet, FileJson, Lock } from 'lucide-react'
import type { Movimentacao } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAppStore } from '@/store/useAppStore'
import { formatDateTime } from '@/lib/format'
import { vigenciaNoMesTravado } from '@/lib/folha'
import { gerarArquivoApdata, gerarArquivoEmployeeCentral } from '@/services/exportService'
import { liberarMovimentacaoParaFolha } from '@/services/folhaService'

export function GerarArquivosCard({ movimentacao }: { movimentacao: Movimentacao }) {
  const [gerandoApdata, setGerandoApdata] = React.useState(false)
  const [gerandoEc, setGerandoEc] = React.useState(false)
  const [liberando, setLiberando] = React.useState(false)
  const { notificar, notificarErro } = useToast()
  const podeGerar = useAppStore((s) => s.currentUser?.perfil === 'rh_central')
  const mesTravado = useAppStore((s) => s.fechamentoFolha.mesTravado)

  const liberadaParaFolha = Boolean(movimentacao.rhLiberadaFolhaEm)
  const folhaTravadaParaVigencia = vigenciaNoMesTravado(movimentacao.vigencia, mesTravado)

  async function liberarParaFolha() {
    setLiberando(true)
    try {
      await liberarMovimentacaoParaFolha(movimentacao.id)
      notificar({ tipo: 'sucesso', titulo: 'Liberada para a Folha', descricao: movimentacao.protocolo })
    } catch (erro) {
      notificarErro(erro, 'Não foi possível liberar para a Folha')
    } finally {
      setLiberando(false)
    }
  }

  async function baixarApdata() {
    setGerandoApdata(true)
    try {
      await gerarArquivoApdata(movimentacao.id)
      notificar({ tipo: 'sucesso', titulo: 'Carga demonstrativa gerada', descricao: 'Arquivo Apdata baixado e registrado no histórico.' })
    } catch (erro) {
      notificarErro(erro, 'Não foi possível gerar a carga Apdata')
    } finally {
      setGerandoApdata(false)
    }
  }

  async function baixarEc() {
    setGerandoEc(true)
    try {
      await gerarArquivoEmployeeCentral(movimentacao.id)
      notificar({ tipo: 'sucesso', titulo: 'Arquivo demonstrativo gerado', descricao: 'Arquivo Employee Central baixado e registrado no histórico.' })
    } catch (erro) {
      notificarErro(erro, 'Não foi possível gerar o arquivo Employee Central')
    } finally {
      setGerandoEc(false)
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
        <div>
          <p className="text-[14px] font-semibold text-[var(--color-ink)]">Fluxo aprovado</p>
          <p className="mt-0.5 text-[13px] text-[var(--color-ink-muted)]">
            O processamento exige, além da aprovação do fluxo: liberação do RH para entrada na Folha e o mês da vigência não estar
            travado pelo Share.
          </p>
        </div>
      </div>

      {!liberadaParaFolha ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-3.5">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-ink)]">
            <ClipboardCheck className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
            Aguardando liberação do RH para entrada na Folha
          </p>
          <Button className="mt-2.5" size="sm" onClick={liberarParaFolha} loading={liberando} disabled={!podeGerar}>
            Liberar para a Folha
          </Button>
          {!podeGerar && <p className="mt-2 text-[12px] text-[var(--color-ink-muted)]">Somente o perfil RH Central pode liberar para a Folha.</p>}
        </div>
      ) : (
        <>
          {folhaTravadaParaVigencia && (
            <p className="mt-4 flex items-start gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-3 text-[13px] text-[var(--color-warning)]">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              O mês da vigência ({movimentacao.vigencia.slice(0, 7)}) está com a folha travada pelo Share — aguarde a liberação para gerar os arquivos.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Button variant="secondary" size="sm" onClick={baixarApdata} loading={gerandoApdata} disabled={!podeGerar || gerandoEc || folhaTravadaParaVigencia}>
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              Gerar carga Apdata (.csv)
            </Button>
            <Button variant="secondary" size="sm" onClick={baixarEc} loading={gerandoEc} disabled={!podeGerar || gerandoApdata || folhaTravadaParaVigencia}>
              <FileJson className="size-4" aria-hidden="true" />
              Baixar arquivo Employee Central (.json)
            </Button>
          </div>
          {!podeGerar && (
            <p className="mt-2 text-[12px] text-[var(--color-ink-muted)]">Somente o perfil RH Central pode gerar os arquivos de saída.</p>
          )}
        </>
      )}

      <p className="mt-3 text-[12px] text-[var(--color-ink-muted)]">
        O formato é demonstrativo e <strong>não homologado</strong> (o layout oficial da transação Apdata 19092 e o canal do Employee
        Central ainda não foram fornecidos). Nenhuma conexão externa é realizada.
      </p>

      <div className="mt-3 space-y-1 text-[12px] text-[var(--color-ink-muted)]">
        {movimentacao.arquivosGerados.apdataGeradoEm && (
          <p className="flex items-center gap-1.5">
            <Download className="size-3.5" aria-hidden="true" />
            Carga Apdata gerada em {formatDateTime(movimentacao.arquivosGerados.apdataGeradoEm)}
          </p>
        )}
        {movimentacao.arquivosGerados.employeeCentralGeradoEm && (
          <p className="flex items-center gap-1.5">
            <Download className="size-3.5" aria-hidden="true" />
            Arquivo Employee Central gerado em {formatDateTime(movimentacao.arquivosGerados.employeeCentralGeradoEm)}
          </p>
        )}
      </div>
    </div>
  )
}
