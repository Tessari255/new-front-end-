import * as React from 'react'
import { UploadCloud, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'

export interface ArquivoSelecionado {
  nome: string
  tamanhoBytes: number
  /** Arquivo real: enviado ao servidor via multipart/form-data. */
  file: File
}

export const LIMITE_ARQUIVO_BYTES = 10 * 1024 * 1024
const EXTENSOES = ['pdf', 'docx', 'png', 'jpg', 'jpeg']
const ACCEPT = '.pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg'

function validar(arquivo: File): string | undefined {
  const ext = arquivo.name.includes('.') ? arquivo.name.split('.').pop()!.toLowerCase() : ''
  if (!EXTENSOES.includes(ext)) return `"${arquivo.name}": formato não permitido. Envie PDF, DOCX, PNG ou JPG.`
  if (arquivo.size === 0) return `"${arquivo.name}": o arquivo está vazio.`
  if (arquivo.size > LIMITE_ARQUIVO_BYTES) return `"${arquivo.name}": acima do limite de 10 MB (${formatBytes(arquivo.size)}).`
  return undefined
}

export function FileDropzone({
  arquivos,
  onAdicionar,
  onRemover,
  invalid,
  descricao = 'PDF, DOCX, PNG ou JPG — até 10 MB cada.',
}: {
  arquivos: ArquivoSelecionado[]
  onAdicionar: (arquivos: ArquivoSelecionado[]) => void
  onRemover: (index: number) => void
  invalid?: boolean
  descricao?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = React.useState(false)
  const [erros, setErros] = React.useState<string[]>([])

  function processarArquivos(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const aceitos: ArquivoSelecionado[] = []
    const rejeitados: string[] = []
    for (const f of Array.from(fileList)) {
      const motivo = validar(f)
      if (motivo) rejeitados.push(motivo)
      else aceitos.push({ nome: f.name, tamanhoBytes: f.size, file: f })
    }
    setErros(rejeitados)
    if (aceitos.length > 0) onAdicionar(aceitos)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-describedby="dropzone-descricao"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          processarArquivos(e.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
          arrastando ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]' : 'border-[var(--color-border-strong)] bg-slate-50/60 hover:bg-slate-50',
          (invalid || erros.length > 0) && 'border-[var(--color-danger)]',
        )}
      >
        <UploadCloud className="size-6 text-[var(--color-ink-subtle)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--color-ink)]">Arraste arquivos ou clique para selecionar</p>
        <p id="dropzone-descricao" className="text-xs text-[var(--color-ink-muted)]">
          {descricao}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Selecionar arquivos de evidência"
          onChange={(e) => {
            processarArquivos(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {erros.length > 0 && (
        <ul role="alert" className="mt-2 space-y-1 text-xs text-[var(--color-danger)]">
          {erros.map((erro) => (
            <li key={erro}>{erro}</li>
          ))}
        </ul>
      )}

      {arquivos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {arquivos.map((arquivo, idx) => (
            <li
              key={`${arquivo.nome}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--color-ink)]">{arquivo.nome}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">{formatBytes(arquivo.tamanhoBytes)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemover(idx)}
                className="shrink-0 rounded p-1 text-[var(--color-ink-subtle)] transition-colors hover:bg-black/5 hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                aria-label={`Remover ${arquivo.nome}`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
