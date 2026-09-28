import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { restaurarDemonstracao } from '@/services/demoService'

export function RestaurarDemonstracaoButton({ variant = 'secondary' }: { variant?: 'secondary' | 'ghost' }) {
  const [aberto, setAberto] = React.useState(false)
  const [carregando, setCarregando] = React.useState(false)
  const { notificar, notificarErro } = useToast()

  async function confirmar() {
    setCarregando(true)
    try {
      await restaurarDemonstracao()
      notificar({ tipo: 'sucesso', titulo: 'Demonstração restaurada', descricao: 'Todos os dados fictícios foram reiniciados.' })
      setAberto(false)
    } catch (erro) {
      notificarErro(erro, 'Não foi possível restaurar a demonstração')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" className="w-full">
          <RotateCcw className="size-4" aria-hidden="true" />
          Restaurar demonstração
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restaurar demonstração?</DialogTitle>
          <DialogDescription>
            Isso substitui todos os dados fictícios (colaboradores, movimentações, aprovações e divergências) pelo estado
            inicial da demonstração no banco de dados. As alterações feitas serão perdidas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setAberto(false)} disabled={carregando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={confirmar} loading={carregando}>
            Restaurar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
