import { Link, useNavigate } from 'react-router-dom'
import { Eye, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { movimentacoesAcionaveisPeloUsuario, usuarioPodeDecidir } from '@/lib/selectors'
import { rotuloEtapaMovimentacao, rotuloTipoMovimentacao } from '@/lib/rotulos'
import { PERFIS_DEMO } from '@/data/perfis'
import { formatDate } from '@/lib/format'
import type { Colaborador, Movimentacao, Planta } from '@/types'

export default function AprovacoesPage() {
  const movimentacoesTodas = useAppStore((s) => s.movimentacoes)
  const colaboradores = useAppStore((s) => s.colaboradores)
  const plantas = useAppStore((s) => s.plantas)
  const plantaSelecionadaId = useAppStore((s) => s.plantaSelecionadaId)
  const perfilAtivo = useAppStore((s) => s.perfilAtivo)
  const currentUser = useAppStore((s) => s.currentUser)

  const movimentacoes = movimentacoesTodas.filter((m) =>
    plantaSelecionadaId === 'todas' || m.plantaId === plantaSelecionadaId || usuarioPodeDecidir(currentUser, m, colaboradores))
  const perfilInfo = PERFIS_DEMO.find((p) => p.id === perfilAtivo)!

  const pendentes =
    perfilAtivo === 'auditoria'
      ? movimentacoes.filter((m) => m.status === 'em_andamento')
      : movimentacoesAcionaveisPeloUsuario(movimentacoes, currentUser, colaboradores)

  const aprovadas = movimentacoes.filter((m) => m.status === 'aprovada')
  const devolvidas = movimentacoes.filter((m) => m.status === 'devolvida')
  const reprovadas = movimentacoes.filter((m) => m.status === 'reprovada')

  return (
    <div>
      <PageHeader
        title="Aprovações"
        description="Central de decisões do fluxo Gestor → RH Local → RH Central, por planta e por etapa."
      />

      <div className="mb-5 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]">
          {perfilAtivo === 'auditoria' ? <Eye className="size-4" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
        </span>
        <div>
          <p className="text-[13.5px] font-medium text-[var(--color-ink)]">
            Usuário de demonstração ativo: {currentUser?.nome} ({perfilInfo.nome})
          </p>
          <p className="text-[13px] text-[var(--color-ink-muted)]">
            {perfilAtivo === 'auditoria'
              ? 'Auditoria visualiza todas as solicitações em andamento, sem ações de aprovação. Troque o usuário no menu do topo para simular Gestor, RH Local ou RH Central.'
              : `${perfilInfo.descricao} Troque o usuário no menu do topo da página para simular outras etapas.`}
          </p>
        </div>
      </div>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="aprovadas">Aprovadas ({aprovadas.length})</TabsTrigger>
          <TabsTrigger value="devolvidas">Devolvidas ({devolvidas.length})</TabsTrigger>
          <TabsTrigger value="reprovadas">Reprovadas ({reprovadas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <ListaAprovacoes
            itens={pendentes}
            colaboradores={colaboradores}
            plantas={plantas}
            colunaExtra="etapa"
            vazio={{
              titulo: 'Nenhuma pendência para este perfil',
              descricao: perfilAtivo === 'auditoria' ? 'Não há solicitações em andamento no momento.' : 'Não há solicitações aguardando decisão neste perfil e planta.',
            }}
          />
        </TabsContent>
        <TabsContent value="aprovadas">
          <ListaAprovacoes itens={aprovadas} colaboradores={colaboradores} plantas={plantas} colunaExtra="conclusao" vazio={{ titulo: 'Nenhuma aprovação concluída', descricao: 'Solicitações aprovadas aparecerão aqui.' }} />
        </TabsContent>
        <TabsContent value="devolvidas">
          <ListaAprovacoes itens={devolvidas} colaboradores={colaboradores} plantas={plantas} colunaExtra="motivo" vazio={{ titulo: 'Nenhuma devolução', descricao: 'Solicitações devolvidas para ajuste aparecerão aqui.' }} />
        </TabsContent>
        <TabsContent value="reprovadas">
          <ListaAprovacoes itens={reprovadas} colaboradores={colaboradores} plantas={plantas} colunaExtra="motivo" vazio={{ titulo: 'Nenhuma reprovação', descricao: 'Solicitações reprovadas aparecerão aqui.' }} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ListaAprovacoes({
  itens,
  colaboradores,
  plantas,
  colunaExtra,
  vazio,
}: {
  itens: Movimentacao[]
  colaboradores: Colaborador[]
  plantas: Planta[]
  colunaExtra: 'etapa' | 'conclusao' | 'motivo'
  vazio: { titulo: string; descricao: string }
}) {
  const navigate = useNavigate()
  if (itens.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
        <EmptyState title={vazio.titulo} description={vazio.descricao} />
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Protocolo</TableHead>
          <TableHead>Colaborador</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Planta</TableHead>
          <TableHead>{colunaExtra === 'etapa' ? 'Etapa' : colunaExtra === 'conclusao' ? 'Concluída em' : 'Motivo'}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itens.map((mov) => {
          const colaborador = colaboradores.find((c) => c.id === mov.colaboradorId)
          const planta = plantas.find((p) => p.id === mov.plantaId)
          const ultimaDecisao = mov.decisoes[mov.decisoes.length - 1]
          return (
            <TableRow key={mov.id} clickable onClick={() => navigate(`/movimentacoes/${mov.id}`)}>
              <TableCell className="whitespace-nowrap font-mono text-[13px] text-[var(--color-ink-muted)]">
                <Link to={`/movimentacoes/${mov.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                  {mov.protocolo}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar nome={colaborador?.nome ?? '—'} size="sm" />
                  <span className="truncate font-medium text-[var(--color-ink)]">{colaborador?.nome}</span>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">{rotuloTipoMovimentacao(mov.tipo)}</TableCell>
              <TableCell className="whitespace-nowrap">{planta?.nome ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap">
                {colunaExtra === 'etapa' && <Badge tom="info">{rotuloEtapaMovimentacao(mov.etapaAtual)}</Badge>}
                {colunaExtra === 'conclusao' && (ultimaDecisao ? formatDate(ultimaDecisao.data) : '—')}
                {colunaExtra === 'motivo' && <span className="text-[13px] text-[var(--color-ink-muted)]">{ultimaDecisao?.comentario ?? '—'}</span>}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
