import * as React from 'react'
import { CheckCircle2, Download, FileSpreadsheet, FileJson } from 'lucide-react'
import type { Movimentacao } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAppStore } from '@/store/useAppStore'
import { formatDateTime } from '@/lib/format'
import { gerarArquivoApdata, gerarArquivoEmployeeCentral } from '@/services/exportService'

export function GerarArquivosCard({ movimentacao }: { movimentacao: Movimentacao }) {
  const [gerandoApdata, setGerandoApdata] = React.useState(false)
  const [gerandoEc, setGerandoEc] = React.useState(false)
  const { notificar, notificarErro } = useToast()
  const podeGerar = useAppStore((s) => s.currentUser?.perfil === 'rh_central')

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
          <p className="text-[14px] font-semibold text-[var(--color-ink)]">Aprovada — pronta para processamento</p>
          <p className="mt-0.5 text-[13px] text-[var(--color-ink-muted)]">
            Gere os arquivos demonstrativos para conferência e carga nos sistemas de origem. O formato é demonstrativo e{' '}
            <strong>não homologado</strong> (o layout oficial da transação Apdata 19092 e o canal do Employee Central ainda não foram
            fornecidos). Nenhuma conexão externa é realizada.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <Button variant="secondary" size="sm" onClick={baixarApdata} loading={gerandoApdata} disabled={!podeGerar || gerandoEc}>
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          Gerar carga Apdata (.csv)
        </Button>
        <Button variant="secondary" size="sm" onClick={baixarEc} loading={gerandoEc} disabled={!podeGerar || gerandoApdata}>
          <FileJson className="size-4" aria-hidden="true" />
          Baixar arquivo Employee Central (.json)
        </Button>
      </div>
      {!podeGerar && (
        <p className="mt-2 text-[12px] text-[var(--color-ink-muted)]">Somente o perfil RH Central pode gerar os arquivos de saída.</p>
      )}
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
