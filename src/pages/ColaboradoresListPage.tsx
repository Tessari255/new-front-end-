import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpDown, Search, Settings2, Users, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'
import { useUrlParam } from '@/lib/useUrlParam'
import { filtrarPorPlanta } from '@/lib/selectors'
import { rotuloIpe, rotuloStatusColaborador, tomStatusColaborador } from '@/lib/rotulos'
import { atualizarParametrosCargo } from '@/services/cargosService'

const ITENS_POR_PAGINA = 10
const IPE_OPCOES = [1, 2, 3, 4, 5] as const

export default function ColaboradoresListPage() {
  const colaboradoresTodos = useAppStore((s) => s.colaboradores)
  const plantaSelecionadaId = useAppStore((s) => s.plantaSelecionadaId)
  const cargos = useAppStore((s) => s.cargos)
  const areas = useAppStore((s) => s.areas)
  const plantas = useAppStore((s) => s.plantas)
  const centrosCusto = useAppStore((s) => s.centrosCusto)
  const currentUser = useAppStore((s) => s.currentUser)
  const navigate = useNavigate()
  const { notificar, notificarErro } = useToast()

  const [busca, setBusca] = useUrlParam('busca')
  const [areaId, setAreaId] = useUrlParam('area')
  const [status, setStatus] = useUrlParam('status')
  const [paginaStr, setPaginaStr] = useUrlParam('pagina', '1')
  const [ordenacao, setOrdenacao] = React.useState<'nome' | 'matricula'>('nome')
  const [configuracaoAberta, setConfiguracaoAberta] = React.useState(false)
  const [plantaConfiguracaoId, setPlantaConfiguracaoId] = React.useState('')
  const [cargoConfiguracaoId, setCargoConfiguracaoId] = React.useState('')
  const [salvandoConfiguracao, setSalvandoConfiguracao] = React.useState(false)

  const pagina = Math.max(1, parseInt(paginaStr, 10) || 1)

  const filtrados = React.useMemo(() => {
    let lista = filtrarPorPlanta(colaboradoresTodos, plantaSelecionadaId)
    if (areaId) lista = lista.filter((c) => c.areaId === areaId)
    if (status) lista = lista.filter((c) => c.status === status)
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter((c) => c.nome.toLowerCase().includes(termo) || c.matricula.toLowerCase().includes(termo))
    }
    return [...lista].sort((a, b) => a[ordenacao].localeCompare(b[ordenacao], 'pt-BR'))
  }, [colaboradoresTodos, plantaSelecionadaId, areaId, status, busca, ordenacao])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA))
  const paginaEfetiva = Math.min(pagina, totalPaginas)
  const paginados = filtrados.slice((paginaEfetiva - 1) * ITENS_POR_PAGINA, paginaEfetiva * ITENS_POR_PAGINA)

  const filtrosAtivos = Boolean(busca || areaId || status)
  const podeConfigurarCargos = currentUser?.perfil === 'rh_local' || currentUser?.perfil === 'rh_central'
  const plantaConfiguracaoEfetiva =
    plantaConfiguracaoId || (plantaSelecionadaId === 'todas' ? plantas[0]?.id ?? '' : plantaSelecionadaId)
  const cargosDaPlanta = React.useMemo(
    () => cargos.filter((cargo) => cargo.plantasPermitidas.includes(plantaConfiguracaoEfetiva)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [cargos, plantaConfiguracaoEfetiva],
  )
  const cargoConfiguracaoEfetivo = cargosDaPlanta.find((cargo) => cargo.id === cargoConfiguracaoId) ?? cargosDaPlanta[0]
  const configuracaoAtual = cargoConfiguracaoEfetivo?.configuracoesPorPlanta.find((configuracao) => configuracao.plantaId === plantaConfiguracaoEfetiva)

  function limparFiltros() {
    setBusca('')
    setAreaId('')
    setStatus('')
    setPaginaStr('1')
  }

  function abrirConfiguracao() {
    setPlantaConfiguracaoId(plantaSelecionadaId === 'todas' ? plantas[0]?.id ?? '' : plantaSelecionadaId)
    setCargoConfiguracaoId('')
    setConfiguracaoAberta(true)
  }

  async function salvarConfiguracao(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cargoConfiguracaoEfetivo || !plantaConfiguracaoEfetiva) return

    let salarioBaseNumero: number | null = null
    const valores = new FormData(event.currentTarget)
    const salarioBaseInformado = String(valores.get('salarioBase') ?? '').trim()
    if (salarioBaseInformado) {
      const valor = Number(salarioBaseInformado)
      if (!Number.isFinite(valor) || valor < 0) {
        notificar({ tipo: 'erro', titulo: 'Salário-base inválido', descricao: 'Informe um valor maior ou igual a zero.' })
        return
      }
      salarioBaseNumero = valor
    }
    const ipeInformado = String(valores.get('ipe') ?? 'indefinido')
    const ipeNumero = ipeInformado === 'indefinido' ? null : Number(ipeInformado)
    if (ipeNumero !== null && (!Number.isInteger(ipeNumero) || ipeNumero < 1 || ipeNumero > 5)) {
      notificar({ tipo: 'erro', titulo: 'IPE inválido', descricao: 'Informe um número inteiro entre 1 e 5.' })
      return
    }

    setSalvandoConfiguracao(true)
    try {
      await atualizarParametrosCargo(cargoConfiguracaoEfetivo.id, {
        plantaId: plantaConfiguracaoEfetiva,
        salarioBase: salarioBaseNumero,
        ipe: ipeNumero,
      })
      notificar({ tipo: 'sucesso', titulo: 'Parâmetros do cargo atualizados', descricao: cargoConfiguracaoEfetivo.nome })
      setConfiguracaoAberta(false)
    } catch (erro) {
      notificarErro(erro, 'Não foi possível atualizar os parâmetros do cargo')
    } finally {
      setSalvandoConfiguracao(false)
    }
  }

  return (
    <Dialog open={configuracaoAberta} onOpenChange={setConfiguracaoAberta}>
      <div>
      <PageHeader
        title="Colaboradores"
        description="Diretório com dados organizacionais, vínculos e movimentações de cada colaborador."
        action={
          podeConfigurarCargos ? (
            <Button type="button" onClick={abrirConfiguracao}>
              <Settings2 className="size-4" aria-hidden="true" />
              Configurar cargos
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="busca-colaboradores">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-subtle)]" aria-hidden="true" />
              <Input
                id="busca-colaboradores"
                placeholder="Nome ou matrícula"
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="filtro-area">Área</Label>
            <Select value={areaId || 'todas'} onValueChange={(v) => setAreaId(v === 'todas' ? '' : v)}>
              <SelectTrigger id="filtro-area">
                <SelectValue placeholder="Todas as áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as áreas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-status">Status</Label>
            <Select value={status || 'todos'} onValueChange={(v) => setStatus(v === 'todos' ? '' : v)}>
              <SelectTrigger id="filtro-status">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="afastado">Afastado</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-ordenacao">Ordenar por</Label>
            <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as 'nome' | 'matricula')}>
              <SelectTrigger id="filtro-ordenacao">
                <ArrowUpDown className="size-3.5 text-[var(--color-ink-muted)]" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome (A–Z)</SelectItem>
                <SelectItem value="matricula">Matrícula</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {filtrosAtivos && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-[var(--color-ink-muted)]">{filtrados.length} colaborador(es) encontrado(s)</p>
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <X className="size-3.5" aria-hidden="true" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4">
        {filtrados.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
            <EmptyState
              icon={Users}
              title="Nenhum colaborador encontrado"
              description="Ajuste os filtros ou a busca para encontrar o colaborador desejado."
              action={
                filtrosAtivos ? (
                  <Button variant="secondary" size="sm" onClick={limparFiltros}>
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Planta</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead>Gestor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginados.map((colaborador) => {
                const cargo = cargos.find((c) => c.id === colaborador.cargoId)
                const area = areas.find((a) => a.id === colaborador.areaId)
                const planta = plantas.find((p) => p.id === colaborador.plantaId)
                const cc = centrosCusto.find((c) => c.id === colaborador.centroCustoId)
                const gestor = colaboradoresTodos.find((c) => c.id === colaborador.gestorId)
                return (
                  <TableRow key={colaborador.id} clickable onClick={() => navigate(`/colaboradores/${colaborador.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={colaborador.nome} size="sm" />
                        <Link
                          to={`/colaboradores/${colaborador.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="truncate font-medium text-[var(--color-ink)] hover:text-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:underline"
                        >
                          {colaborador.nome}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[13px] text-[var(--color-ink-muted)]">{colaborador.matricula}</TableCell>
                    <TableCell className="whitespace-nowrap">{cargo?.nome ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{area?.nome ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{planta?.nome ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[13px] text-[var(--color-ink-muted)]">{cc?.codigo ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{gestor?.nome ?? '—'}</TableCell>
                    <TableCell>
                      <Badge tom={tomStatusColaborador(colaborador.status)}>{rotuloStatusColaborador(colaborador.status)}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {filtrados.length > 0 && (
          <Pagination
            pagina={paginaEfetiva}
            totalPaginas={totalPaginas}
            totalItens={filtrados.length}
            itensPorPagina={ITENS_POR_PAGINA}
            onMudarPagina={(p) => setPaginaStr(String(p))}
          />
        )}
      </div>
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parâmetros do cargo</DialogTitle>
          <DialogDescription>Defina o salário-base e o IPE para a combinação de cargo e planta.</DialogDescription>
        </DialogHeader>
        {cargosDaPlanta.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Não há cargos disponíveis nesta planta.</p>
        ) : (
          <form key={`${plantaConfiguracaoEfetiva}:${cargoConfiguracaoEfetivo?.id ?? ''}`} className="space-y-4" onSubmit={salvarConfiguracao}>
            <div>
              <Label htmlFor="configuracao-planta">Planta</Label>
              <Select
                value={plantaConfiguracaoEfetiva}
                onValueChange={(valor) => {
                  setPlantaConfiguracaoId(valor)
                  setCargoConfiguracaoId('')
                }}
              >
                <SelectTrigger id="configuracao-planta">
                  <SelectValue placeholder="Selecione a planta" />
                </SelectTrigger>
                <SelectContent>
                  {plantas.map((planta) => (
                    <SelectItem key={planta.id} value={planta.id}>
                      {planta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="configuracao-cargo">Cargo</Label>
              <Select value={cargoConfiguracaoEfetivo?.id} onValueChange={setCargoConfiguracaoId}>
                <SelectTrigger id="configuracao-cargo">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {cargosDaPlanta.map((cargo) => (
                    <SelectItem key={cargo.id} value={cargo.id}>
                      {cargo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="configuracao-salario-base">Salário-base (R$)</Label>
              <Input
                id="configuracao-salario-base"
                type="number"
                name="salarioBase"
                min={0}
                step="0.01"
                inputMode="decimal"
                defaultValue={configuracaoAtual?.salarioBase ?? ''}
                placeholder="Não definido"
              />
              <FieldHint>Deixe em branco para não definir o salário-base.</FieldHint>
            </div>
            <div>
              <Label htmlFor="configuracao-ipe">IPE — Índice de Importância Estratégica</Label>
              <Select name="ipe" defaultValue={configuracaoAtual?.ipe?.toString() ?? 'indefinido'}>
                <SelectTrigger id="configuracao-ipe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinido">IPE não definido</SelectItem>
                  {IPE_OPCOES.map((valor) => (
                    <SelectItem key={valor} value={String(valor)}>
                      {rotuloIpe(valor)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setConfiguracaoAberta(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={salvandoConfiguracao}>
                Salvar parâmetros
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
