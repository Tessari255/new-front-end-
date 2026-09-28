import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Save, Send, ChevronLeft, ChevronRight, AlertTriangle, Info } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label, Textarea, FieldError, FieldHint } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Stepper } from '@/components/ui/Stepper'
import { FileDropzone, type ArquivoSelecionado } from '@/components/ui/FileDropzone'
import { useToast } from '@/components/ui/Toast'
import { ComparacaoCampos } from '@/components/movimentacao/ComparacaoCampos'
import { ChecagensList } from '@/components/movimentacao/ChecagensList'
import type { DetalheAlteracao, Potencial, TipoMaoDeObra, TipoMovimentacao } from '@/types'
import { compararAlteracao } from '@/lib/movimentacao'
import { rotuloPotencial, rotuloTipoMovimentacao } from '@/lib/rotulos'
import { formatCurrency } from '@/lib/format'
import { evidenciaObrigatoria, gestorValido, cargoCompativelComPlanta, centroCustoValidoParaPlanta, percentualAlteracaoSalarial, faixaSalarialStatus, NOTA_REGRAS_DEMO, gerarChecagens } from '@/data/rules'
import { primeiroDiaDoMesSeguinte, vigenciaNoMesTravado } from '@/lib/folha'
import { criarMovimentacao, atualizarRascunho, enviarParaAprovacao as enviarRascunhoParaAprovacao } from '@/services/movimentacoesService'

const TIPOS: { valor: TipoMovimentacao; titulo: string; descricao: string }[] = [
  { valor: 'mudanca_gestor', titulo: 'Mudança de gestor', descricao: 'Altera a quem o colaborador se reporta.' },
  { valor: 'alteracao_cargo', titulo: 'Alteração de cargo', descricao: 'Atualiza o cargo sem necessariamente alterar salário.' },
  { valor: 'alteracao_salarial', titulo: 'Alteração salarial', descricao: 'Ajusta o salário mantendo o cargo atual.' },
  { valor: 'promocao', titulo: 'Promoção', descricao: 'Combina novo cargo e novo salário.' },
  { valor: 'enquadramento', titulo: 'Enquadramento', descricao: 'Altera folha de pagamento e jornada/horário.' },
  { valor: 'transferencia_cc', titulo: 'Transferência de CC', descricao: 'Move o colaborador para outro centro de custo.' },
  { valor: 'merito', titulo: 'Mérito', descricao: 'Ajusta o salário por reconhecimento de desempenho.' },
  { valor: 'transferencia_localidade', titulo: 'Transferência de localidade', descricao: 'Move o colaborador para outra planta, com novo CC e gestor.' },
  { valor: 'alteracao_mao_de_obra', titulo: 'Alteração de mão de obra', descricao: 'Reclassifica entre mão de obra direta e indireta.' },
  { valor: 'alteracao_area_atuacao', titulo: 'Alteração de área de atuação', descricao: 'Move o colaborador para outra área.' },
]

const POTENCIAIS: Potencial[] = ['baixo', 'estavel', 'alto']

const PASSOS = [
  { label: 'Colaborador e tipo', description: 'Quem e o que muda' },
  { label: 'Alteração', description: 'Valores propostos' },
  { label: 'Justificativa', description: 'Motivo e evidências' },
  { label: 'Revisão', description: 'Conferir e enviar' },
]

interface DraftForm {
  colaboradorId: string
  tipo: TipoMovimentacao | ''
  vigencia: string
  justificativa: string
  arquivos: ArquivoSelecionado[]
  gestorPropostoId: string
  cargoPropostoId: string
  salarioProposto: string
  folhaPropostaId: string
  horarioPropostoId: string
  centroCustoPropostoId: string
  plantaPropostaId: string
  tipoMaoDeObraProposto: TipoMaoDeObra | ''
  areaPropostaId: string
  potencial: Potencial | ''
}

function vigenciaPadrao(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

const FORM_VAZIO: DraftForm = {
  colaboradorId: '',
  tipo: '',
  vigencia: vigenciaPadrao(),
  justificativa: '',
  arquivos: [],
  gestorPropostoId: '',
  cargoPropostoId: '',
  salarioProposto: '',
  folhaPropostaId: '',
  horarioPropostoId: '',
  centroCustoPropostoId: '',
  plantaPropostaId: '',
  tipoMaoDeObraProposto: '',
  areaPropostaId: '',
  potencial: '',
}

function hidratarFormulario(
  colaboradorId: string,
  tipo: TipoMovimentacao,
  alteracao: DetalheAlteracao,
  justificativa: string,
  vigencia: string,
  potencial: Potencial | null,
): DraftForm {
  const base: DraftForm = { ...FORM_VAZIO, colaboradorId, tipo, justificativa, vigencia, potencial: potencial ?? '' }
  switch (alteracao.tipo) {
    case 'mudanca_gestor':
      base.gestorPropostoId = alteracao.gestorPropostoId
      break
    case 'alteracao_cargo':
      base.cargoPropostoId = alteracao.cargoPropostoId
      break
    case 'alteracao_salarial':
      base.salarioProposto = String(alteracao.salarioProposto)
      break
    case 'promocao':
      base.cargoPropostoId = alteracao.cargoPropostoId
      base.salarioProposto = String(alteracao.salarioProposto)
      break
    case 'enquadramento':
      base.folhaPropostaId = alteracao.folhaPropostaId
      base.horarioPropostoId = alteracao.horarioPropostoId
      break
    case 'transferencia_cc':
      base.centroCustoPropostoId = alteracao.centroCustoPropostoId
      break
    case 'merito':
      base.salarioProposto = String(alteracao.salarioProposto)
      break
    case 'transferencia_localidade':
      base.plantaPropostaId = alteracao.plantaPropostaId
      base.centroCustoPropostoId = alteracao.centroCustoPropostoId
      base.gestorPropostoId = alteracao.gestorPropostoId ?? ''
      break
    case 'alteracao_mao_de_obra':
      base.tipoMaoDeObraProposto = alteracao.tipoMaoDeObraProposto
      break
    case 'alteracao_area_atuacao':
      base.areaPropostaId = alteracao.areaPropostaId
      break
  }
  return base
}

export default function NovaMovimentacaoPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { notificar, notificarErro } = useToast()

  const colaboradores = useAppStore((s) => s.colaboradores)
  const cargos = useAppStore((s) => s.cargos)
  const plantas = useAppStore((s) => s.plantas)
  const areas = useAppStore((s) => s.areas)
  const centrosCusto = useAppStore((s) => s.centrosCusto)
  const horarios = useAppStore((s) => s.horarios)
  const folhas = useAppStore((s) => s.folhas)
  const movimentacoes = useAppStore((s) => s.movimentacoes)
  const documentos = useAppStore((s) => s.documentos)
  const fechamentoFolha = useAppStore((s) => s.fechamentoFolha)

  const rascunhoId = searchParams.get('rascunhoId')
  const chamadoPaiId = searchParams.get('chamadoPaiId')
  const [rascunhoCriadoId, setRascunhoCriadoId] = React.useState<string | null>(null)
  const idRascunho = rascunhoId ?? rascunhoCriadoId
  const rascunhoExistente = idRascunho ? movimentacoes.find((m) => m.id === idRascunho) : undefined
  // O título só muda para "Editar rascunho" quando o rascunho veio da URL, não de um envio em andamento.
  const rascunhoDaUrl = rascunhoId ? rascunhoExistente : undefined

  const [passo, setPasso] = React.useState(0)
  const [enviando, setEnviando] = React.useState(false)
  const [tentouAvancar, setTentouAvancar] = React.useState(false)
  const [form, setForm] = React.useState<DraftForm>(() => {
    if (rascunhoExistente) {
      return hidratarFormulario(
        rascunhoExistente.colaboradorId, rascunhoExistente.tipo, rascunhoExistente.alteracao,
        rascunhoExistente.justificativa, rascunhoExistente.vigencia, rascunhoExistente.potencial,
      )
    }
    return {
      ...FORM_VAZIO,
      colaboradorId: searchParams.get('colaboradorId') ?? '',
      tipo: (searchParams.get('tipo') as TipoMovimentacao) ?? '',
    }
  })

  const colaborador = colaboradores.find((c) => c.id === form.colaboradorId)
  const documentosExistentes = rascunhoExistente ? documentos.filter((d) => d.movimentacaoId === rascunhoExistente.id) : []
  const colaboradoresOrdenados = React.useMemo(() => [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [colaboradores])

  function atualizar<K extends keyof DraftForm>(campo: K, valor: DraftForm[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  // ---------- Construção do objeto de alteração a partir do formulário ----------
  function construirAlteracao(): DetalheAlteracao | null {
    if (!colaborador || !form.tipo) return null
    switch (form.tipo) {
      case 'mudanca_gestor':
        return { tipo: 'mudanca_gestor', gestorAtualId: colaborador.gestorId, gestorPropostoId: form.gestorPropostoId || colaborador.gestorId || '' }
      case 'alteracao_cargo':
        return { tipo: 'alteracao_cargo', cargoAtualId: colaborador.cargoId, cargoPropostoId: form.cargoPropostoId || colaborador.cargoId }
      case 'alteracao_salarial':
        return {
          tipo: 'alteracao_salarial',
          salarioAtual: colaborador.salario,
          salarioProposto: form.salarioProposto ? Number(form.salarioProposto) : colaborador.salario,
        }
      case 'promocao':
        return {
          tipo: 'promocao',
          cargoAtualId: colaborador.cargoId,
          cargoPropostoId: form.cargoPropostoId || colaborador.cargoId,
          salarioAtual: colaborador.salario,
          salarioProposto: form.salarioProposto ? Number(form.salarioProposto) : colaborador.salario,
        }
      case 'enquadramento':
        return {
          tipo: 'enquadramento',
          folhaAtualId: colaborador.folhaId,
          folhaPropostaId: form.folhaPropostaId || colaborador.folhaId,
          horarioAtualId: colaborador.horarioId,
          horarioPropostoId: form.horarioPropostoId || colaborador.horarioId,
        }
      case 'transferencia_cc':
        return {
          tipo: 'transferencia_cc',
          centroCustoAtualId: colaborador.centroCustoId,
          centroCustoPropostoId: form.centroCustoPropostoId || colaborador.centroCustoId,
          plantaAtualId: colaborador.plantaId,
          plantaPropostaId: colaborador.plantaId,
        }
      case 'merito':
        return {
          tipo: 'merito',
          salarioAtual: colaborador.salario,
          salarioProposto: form.salarioProposto ? Number(form.salarioProposto) : colaborador.salario,
        }
      case 'transferencia_localidade':
        return {
          tipo: 'transferencia_localidade',
          plantaAtualId: colaborador.plantaId,
          plantaPropostaId: form.plantaPropostaId || colaborador.plantaId,
          centroCustoAtualId: colaborador.centroCustoId,
          centroCustoPropostoId: form.centroCustoPropostoId || colaborador.centroCustoId,
          gestorAtualId: colaborador.gestorId,
          gestorPropostoId: form.gestorPropostoId || null,
        }
      case 'alteracao_mao_de_obra':
        return {
          tipo: 'alteracao_mao_de_obra',
          tipoMaoDeObraAtual: colaborador.tipoMaoDeObra,
          tipoMaoDeObraProposto: form.tipoMaoDeObraProposto || (colaborador.tipoMaoDeObra === 'direta' ? 'indireta' : 'direta'),
        }
      case 'alteracao_area_atuacao':
        return {
          tipo: 'alteracao_area_atuacao',
          areaAtualId: colaborador.areaId,
          areaPropostaId: form.areaPropostaId || colaborador.areaId,
        }
      default:
        return null
    }
  }

  // ---------- Validação por etapa ----------
  function erroPasso1(): Record<string, string> {
    const erros: Record<string, string> = {}
    if (!form.colaboradorId) erros.colaboradorId = 'Selecione um colaborador.'
    if (!form.tipo) erros.tipo = 'Selecione o tipo de movimentação.'
    return erros
  }

  function erroPasso2(): Record<string, string> {
    const erros: Record<string, string> = {}
    if (!colaborador || !form.tipo) return erros
    if (!form.vigencia || Number.isNaN(new Date(form.vigencia).getTime())) erros.vigencia = 'Informe uma data de vigência válida.'
    else if (vigenciaNoMesTravado(form.vigencia, fechamentoFolha.mesTravado)) {
      erros.vigencia = `Mês fechado para lançamentos (fechamento da folha). Use uma vigência a partir de ${primeiroDiaDoMesSeguinte(fechamentoFolha.mesTravado!)}.`
    }

    if (form.tipo === 'mudanca_gestor') {
      const candidato = colaboradores.find((c) => c.id === form.gestorPropostoId)
      if (!form.gestorPropostoId) erros.gestorPropostoId = 'Selecione o gestor proposto.'
      else if (form.gestorPropostoId === colaborador.gestorId) erros.gestorPropostoId = 'Selecione um gestor diferente do atual.'
      else {
        const resultado = gestorValido(candidato, colaborador)
        if (!resultado.valido) erros.gestorPropostoId = resultado.motivo!
      }
    }
    if (form.tipo === 'alteracao_cargo' || form.tipo === 'promocao') {
      if (!form.cargoPropostoId) erros.cargoPropostoId = 'Selecione o cargo proposto.'
      else {
        const cargo = cargos.find((c) => c.id === form.cargoPropostoId)
        if (cargo && !cargoCompativelComPlanta(cargo, colaborador.plantaId)) {
          erros.cargoPropostoId = 'Cargo não habilitado para esta planta (regra de demonstração).'
        }
      }
    }
    if (form.tipo === 'alteracao_salarial' || form.tipo === 'promocao') {
      const valor = Number(form.salarioProposto)
      if (!form.salarioProposto || Number.isNaN(valor) || valor <= 0) erros.salarioProposto = 'Informe um salário proposto válido.'
      else if (valor === colaborador.salario) erros.salarioProposto = 'Informe um valor diferente do salário atual.'
    }
    if (form.tipo === 'enquadramento') {
      if (!form.folhaPropostaId) erros.folhaPropostaId = 'Selecione a folha proposta.'
      if (!form.horarioPropostoId) erros.horarioPropostoId = 'Selecione o horário proposto.'
      if (
        form.folhaPropostaId &&
        form.horarioPropostoId &&
        form.folhaPropostaId === colaborador.folhaId &&
        form.horarioPropostoId === colaborador.horarioId
      ) {
        erros.horarioPropostoId = 'Altere ao menos a folha ou o horário em relação aos valores atuais.'
      }
    }
    if (form.tipo === 'transferencia_cc') {
      if (!form.centroCustoPropostoId) erros.centroCustoPropostoId = 'Selecione o centro de custo proposto.'
      else if (!centroCustoValidoParaPlanta(form.centroCustoPropostoId, colaborador.plantaId)) {
        erros.centroCustoPropostoId = 'Centro de custo não pertence à planta do colaborador.'
      }
    }
    if (form.tipo === 'merito') {
      const valor = Number(form.salarioProposto)
      if (!form.salarioProposto || Number.isNaN(valor) || valor <= 0) erros.salarioProposto = 'Informe um salário proposto válido.'
      else if (valor === colaborador.salario) erros.salarioProposto = 'Informe um valor diferente do salário atual.'
    }
    if (form.tipo === 'transferencia_localidade') {
      if (!form.plantaPropostaId) erros.plantaPropostaId = 'Selecione a localidade proposta.'
      else if (form.plantaPropostaId === colaborador.plantaId) erros.plantaPropostaId = 'Selecione uma localidade diferente da atual.'
      if (!form.centroCustoPropostoId) erros.centroCustoPropostoId = 'Selecione o centro de custo proposto.'
      else if (form.plantaPropostaId && !centroCustoValidoParaPlanta(form.centroCustoPropostoId, form.plantaPropostaId)) {
        erros.centroCustoPropostoId = 'Centro de custo não pertence à localidade proposta.'
      }
      if (form.gestorPropostoId) {
        const resultado = gestorValido(colaboradores.find((c) => c.id === form.gestorPropostoId), colaborador)
        if (!resultado.valido) erros.gestorPropostoId = resultado.motivo!
      }
    }
    if (form.tipo === 'alteracao_mao_de_obra') {
      if (!form.tipoMaoDeObraProposto) erros.tipoMaoDeObraProposto = 'Selecione o tipo de mão de obra proposto.'
      else if (form.tipoMaoDeObraProposto === colaborador.tipoMaoDeObra) erros.tipoMaoDeObraProposto = 'Selecione um tipo diferente do atual.'
    }
    if (form.tipo === 'alteracao_area_atuacao') {
      if (!form.areaPropostaId) erros.areaPropostaId = 'Selecione a área de atuação proposta.'
      else if (form.areaPropostaId === colaborador.areaId) erros.areaPropostaId = 'Selecione uma área diferente da atual.'
    }
    return erros
  }

  function erroPasso3(): Record<string, string> {
    const erros: Record<string, string> = {}
    if (form.justificativa.trim().length < 10) erros.justificativa = 'Descreva a justificativa com pelo menos 10 caracteres.'
    if (form.tipo && evidenciaObrigatoria(form.tipo) && form.arquivos.length === 0 && documentosExistentes.length === 0) {
      erros.arquivos = 'Este tipo de movimentação exige ao menos uma evidência anexada.'
    }
    return erros
  }

  const errosPorPasso = [erroPasso1(), erroPasso2(), erroPasso3(), {}]
  const errosPassoAtual = errosPorPasso[passo]!
  const passoValido = Object.keys(errosPassoAtual).length === 0
  const tudoValidoAteRevisao = errosPorPasso.slice(0, 3).every((e) => Object.keys(e).length === 0)

  function avancar() {
    if (!passoValido) {
      setTentouAvancar(true)
      return
    }
    setTentouAvancar(false)
    setPasso((p) => Math.min(p + 1, PASSOS.length - 1))
  }

  function voltar() {
    setTentouAvancar(false)
    setPasso((p) => Math.max(p - 1, 0))
  }

  const progresso = {
    // Se o envio falhar depois da criação, o rascunho já existe: novas tentativas o reutilizam.
    onRascunho: (m: { id: string }) => setRascunhoCriadoId(m.id),
    onArquivoEnviado: (arquivo: File) => setForm((atual) => ({ ...atual, arquivos: atual.arquivos.filter((a) => a.file !== arquivo) })),
  }

  function dadosParaSalvar(alteracao: DetalheAlteracao) {
    return {
      colaboradorId: form.colaboradorId,
      tipo: form.tipo as TipoMovimentacao,
      vigencia: form.vigencia,
      justificativa: form.justificativa,
      alteracao,
      potencial: form.potencial || null,
      chamadoPaiId,
      arquivos: form.arquivos.map((a) => a.file),
    }
  }

  async function salvarRascunho() {
    if (!colaborador || !form.tipo) {
      setTentouAvancar(true)
      return
    }
    const alteracao = construirAlteracao()
    if (!alteracao) return
    setEnviando(true)
    try {
      if (rascunhoExistente) {
        await atualizarRascunho(rascunhoExistente.id, dadosParaSalvar(alteracao), progresso)
        notificar({ tipo: 'sucesso', titulo: 'Rascunho atualizado', descricao: rascunhoExistente.protocolo })
        navigate(`/movimentacoes/${rascunhoExistente.id}`)
      } else {
        const mov = await criarMovimentacao({ ...dadosParaSalvar(alteracao), comoRascunho: true }, progresso)
        notificar({ tipo: 'sucesso', titulo: 'Rascunho salvo', descricao: mov.protocolo })
        navigate(`/movimentacoes/${mov.id}`)
      }
    } catch (erro) {
      notificarErro(erro, 'Não foi possível salvar o rascunho')
    } finally {
      setEnviando(false)
    }
  }

  async function enviarParaAprovacao() {
    if (!tudoValidoAteRevisao || !colaborador || !form.tipo) {
      setTentouAvancar(true)
      return
    }
    const alteracao = construirAlteracao()
    if (!alteracao) return
    setEnviando(true)
    try {
      let mov
      if (rascunhoExistente) {
        // Salva, envia todos os arquivos e só então envia para aprovação; qualquer falha interrompe o fluxo.
        await atualizarRascunho(rascunhoExistente.id, dadosParaSalvar(alteracao), progresso)
        await enviarRascunhoParaAprovacao(rascunhoExistente.id)
        mov = useAppStore.getState().movimentacoes.find((m) => m.id === rascunhoExistente.id) ?? rascunhoExistente
      } else {
        mov = await criarMovimentacao({ ...dadosParaSalvar(alteracao), comoRascunho: false }, progresso)
      }
      const etapaDescricao = mov.etapaAtual === 'gestor' ? 'aprovação do gestor' : mov.etapaAtual === 'rh_local' ? 'aprovação do RH Local' : 'aprovação do RH Central'
      notificar({ tipo: 'sucesso', titulo: 'Solicitação enviada', descricao: `${mov.protocolo} encaminhada para ${etapaDescricao}.` })
      navigate(`/movimentacoes/${mov.id}`)
    } catch (erro) {
      notificarErro(erro, 'A solicitação não foi enviada')
    } finally {
      setEnviando(false)
    }
  }

  const alteracaoAtual = construirAlteracao()
  const camposComparados = alteracaoAtual && colaborador ? compararAlteracao(alteracaoAtual, colaboradores, colaborador.plantaId) : []
  const checagensPreview =
    colaborador && form.tipo && alteracaoAtual
      ? gerarChecagens(
          form.tipo,
          { colaborador, plantaId: colaborador.plantaId, justificativa: form.justificativa, temEvidencia: form.arquivos.length > 0 || documentosExistentes.length > 0, vigencia: form.vigencia },
          {
            gestorPropostoId:
              alteracaoAtual.tipo === 'mudanca_gestor' ? alteracaoAtual.gestorPropostoId
              : alteracaoAtual.tipo === 'transferencia_localidade' ? (alteracaoAtual.gestorPropostoId ?? undefined)
              : undefined,
            todosColaboradores: colaboradores,
            cargoPropostoId: alteracaoAtual.tipo === 'alteracao_cargo' || alteracaoAtual.tipo === 'promocao' ? alteracaoAtual.cargoPropostoId : undefined,
            centroCustoPropostoId:
              alteracaoAtual.tipo === 'transferencia_cc' || alteracaoAtual.tipo === 'transferencia_localidade' ? alteracaoAtual.centroCustoPropostoId : undefined,
            salarioProposto:
              alteracaoAtual.tipo === 'alteracao_salarial' || alteracaoAtual.tipo === 'promocao' || alteracaoAtual.tipo === 'merito' ? alteracaoAtual.salarioProposto : undefined,
            plantaPropostaId: alteracaoAtual.tipo === 'transferencia_localidade' ? alteracaoAtual.plantaPropostaId : undefined,
            tipoMaoDeObraProposto: alteracaoAtual.tipo === 'alteracao_mao_de_obra' ? alteracaoAtual.tipoMaoDeObraProposto : undefined,
            areaPropostaId: alteracaoAtual.tipo === 'alteracao_area_atuacao' ? alteracaoAtual.areaPropostaId : undefined,
          },
        )
      : []

  const mostrarErro = (campo: string) => (tentouAvancar ? errosPassoAtual[campo] : undefined)

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Movimentações', to: '/movimentacoes' }, { label: rascunhoDaUrl ? rascunhoDaUrl.protocolo : 'Nova movimentação' }]}
        title={rascunhoDaUrl ? `Editar rascunho — ${rascunhoDaUrl.protocolo}` : 'Nova movimentação'}
        description={
          chamadoPaiId
            ? 'Esta alteração será registrada no mesmo chamado, para o mesmo colaborador — mantém o histórico e a aprovação independentes.'
            : 'Siga as etapas para registrar uma solicitação de movimentação e encaminhá-la para aprovação.'
        }
      />

      <Card>
        <CardContent className="pt-6">
          <Stepper steps={PASSOS} atual={passo} />

          <div className="mt-8">
            {passo === 0 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="select-colaborador">Colaborador</Label>
                    <Select value={form.colaboradorId} onValueChange={(v) => atualizar('colaboradorId', v)}>
                      <SelectTrigger id="select-colaborador" invalid={!!mostrarErro('colaboradorId')}>
                        <SelectValue placeholder="Selecione o colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradoresOrdenados.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} — {c.matricula}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{mostrarErro('colaboradorId')}</FieldError>
                    {colaborador && (
                      <FieldHint>
                        {colaborador.status !== 'ativo' && 'Atenção: colaborador não está ativo. '}
                        Cargo atual: {cargos.find((c) => c.id === colaborador.cargoId)?.nome} · Planta:{' '}
                        {plantas.find((p) => p.id === colaborador.plantaId)?.nome}
                      </FieldHint>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Tipo de movimentação</Label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {TIPOS.map((t) => (
                      <button
                        key={t.valor}
                        type="button"
                        onClick={() => atualizar('tipo', t.valor)}
                        className={`rounded-[var(--radius-md)] border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                          form.tipo === t.valor
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                            : 'border-[var(--color-border-strong)] bg-white hover:bg-[var(--color-bg)]'
                        }`}
                        aria-pressed={form.tipo === t.valor}
                      >
                        <p className="text-[13.5px] font-semibold text-[var(--color-ink)]">{t.titulo}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{t.descricao}</p>
                      </button>
                    ))}
                  </div>
                  <FieldError>{mostrarErro('tipo')}</FieldError>
                </div>
              </div>
            )}

            {passo === 1 && colaborador && form.tipo && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="input-vigencia">Data de vigência</Label>
                    <Input id="input-vigencia" type="date" className="max-w-[220px]" value={form.vigencia} onChange={(e) => atualizar('vigencia', e.target.value)} invalid={!!mostrarErro('vigencia')} />
                    <FieldError>{mostrarErro('vigencia')}</FieldError>
                    {fechamentoFolha.mesTravado && (
                      <FieldHint>
                        Folha fechada para {fechamentoFolha.mesTravado.slice(0, 7)} (Share). Vigências nesse mês só poderão ser enviadas após a liberação.
                      </FieldHint>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="select-potencial">Potencial (opcional)</Label>
                    <Select value={form.potencial || 'nao_informado'} onValueChange={(v) => atualizar('potencial', v === 'nao_informado' ? '' : (v as Potencial))}>
                      <SelectTrigger id="select-potencial">
                        <SelectValue placeholder="Não informado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_informado">Não informado</SelectItem>
                        {POTENCIAIS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {rotuloPotencial(p)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.tipo === 'mudanca_gestor' && (
                  <div>
                    <Label htmlFor="select-gestor">Gestor proposto</Label>
                    <Select value={form.gestorPropostoId} onValueChange={(v) => atualizar('gestorPropostoId', v)}>
                      <SelectTrigger id="select-gestor" invalid={!!mostrarErro('gestorPropostoId')}>
                        <SelectValue placeholder="Selecione o novo gestor" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradores
                          .filter((c) => c.isGestor && c.status === 'ativo' && c.plantaId === colaborador.plantaId && c.id !== colaborador.id)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome} — {cargos.find((cg) => cg.id === c.cargoId)?.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{mostrarErro('gestorPropostoId')}</FieldError>
                    <FieldHint>Apenas gestores ativos da mesma planta são exibidos (regra de demonstração).</FieldHint>
                  </div>
                )}

                {(form.tipo === 'alteracao_cargo' || form.tipo === 'promocao') && (
                  <div>
                    <Label htmlFor="select-cargo">Cargo proposto</Label>
                    <Select value={form.cargoPropostoId} onValueChange={(v) => atualizar('cargoPropostoId', v)}>
                      <SelectTrigger id="select-cargo" invalid={!!mostrarErro('cargoPropostoId')}>
                        <SelectValue placeholder="Selecione o novo cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {cargos
                          .filter((c) => c.areaId === colaborador.areaId && c.id !== colaborador.cargoId)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome} ({formatCurrency(c.salarioMin)} – {formatCurrency(c.salarioMax)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{mostrarErro('cargoPropostoId')}</FieldError>
                  </div>
                )}

                {(form.tipo === 'alteracao_salarial' || form.tipo === 'promocao') && (
                  <div>
                    <Label htmlFor="input-salario">Salário proposto (R$)</Label>
                    <Input
                      id="input-salario"
                      type="number"
                      min={0}
                      step={50}
                      className="max-w-[220px]"
                      value={form.salarioProposto}
                      onChange={(e) => atualizar('salarioProposto', e.target.value)}
                      invalid={!!mostrarErro('salarioProposto')}
                    />
                    <FieldError>{mostrarErro('salarioProposto')}</FieldError>
                    {form.salarioProposto && !Number.isNaN(Number(form.salarioProposto)) && (
                      <AvisosSalariais cargoId={form.tipo === 'promocao' ? form.cargoPropostoId || colaborador.cargoId : colaborador.cargoId} salarioAtual={colaborador.salario} salarioProposto={Number(form.salarioProposto)} />
                    )}
                  </div>
                )}

                {form.tipo === 'enquadramento' && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="select-folha">Folha proposta</Label>
                      <Select value={form.folhaPropostaId} onValueChange={(v) => atualizar('folhaPropostaId', v)}>
                        <SelectTrigger id="select-folha" invalid={!!mostrarErro('folhaPropostaId')}>
                          <SelectValue placeholder="Selecione a folha" />
                        </SelectTrigger>
                        <SelectContent>
                          {folhas.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError>{mostrarErro('folhaPropostaId')}</FieldError>
                    </div>
                    <div>
                      <Label htmlFor="select-horario">Horário proposto</Label>
                      <Select value={form.horarioPropostoId} onValueChange={(v) => atualizar('horarioPropostoId', v)}>
                        <SelectTrigger id="select-horario" invalid={!!mostrarErro('horarioPropostoId')}>
                          <SelectValue placeholder="Selecione o horário" />
                        </SelectTrigger>
                        <SelectContent>
                          {horarios.map((h) => (
                            <SelectItem key={h.id} value={h.id}>
                              {h.nome} ({h.turno})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError>{mostrarErro('horarioPropostoId')}</FieldError>
                    </div>
                  </div>
                )}

                {form.tipo === 'transferencia_cc' && (
                  <div>
                    <Label htmlFor="select-cc">Centro de custo proposto</Label>
                    <Select value={form.centroCustoPropostoId} onValueChange={(v) => atualizar('centroCustoPropostoId', v)}>
                      <SelectTrigger id="select-cc" invalid={!!mostrarErro('centroCustoPropostoId')}>
                        <SelectValue placeholder="Selecione o novo centro de custo" />
                      </SelectTrigger>
                      <SelectContent>
                        {centrosCusto
                          .filter((cc) => cc.plantaId === colaborador.plantaId && cc.id !== colaborador.centroCustoId)
                          .map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.codigo} · {cc.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{mostrarErro('centroCustoPropostoId')}</FieldError>
                    <FieldHint>Transferências nesta demonstração ocorrem dentro da mesma planta.</FieldHint>
                  </div>
                )}

                {form.tipo === 'merito' && (
                  <div>
                    <Label htmlFor="input-salario-merito">Salário proposto (R$)</Label>
                    <Input
                      id="input-salario-merito"
                      type="number"
                      min={0}
                      step={50}
                      className="max-w-[220px]"
                      value={form.salarioProposto}
                      onChange={(e) => atualizar('salarioProposto', e.target.value)}
                      invalid={!!mostrarErro('salarioProposto')}
                    />
                    <FieldError>{mostrarErro('salarioProposto')}</FieldError>
                    {form.salarioProposto && !Number.isNaN(Number(form.salarioProposto)) && (
                      <AvisosSalariais cargoId={colaborador.cargoId} salarioAtual={colaborador.salario} salarioProposto={Number(form.salarioProposto)} />
                    )}
                  </div>
                )}

                {form.tipo === 'transferencia_localidade' && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="select-planta-proposta">Localidade proposta</Label>
                      <Select
                        value={form.plantaPropostaId}
                        onValueChange={(v) => setForm((atual) => ({ ...atual, plantaPropostaId: v, centroCustoPropostoId: '', gestorPropostoId: '' }))}
                      >
                        <SelectTrigger id="select-planta-proposta" invalid={!!mostrarErro('plantaPropostaId')}>
                          <SelectValue placeholder="Selecione a nova planta" />
                        </SelectTrigger>
                        <SelectContent>
                          {plantas
                            .filter((p) => p.id !== colaborador.plantaId)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FieldError>{mostrarErro('plantaPropostaId')}</FieldError>
                    </div>
                    <div>
                      <Label htmlFor="select-cc-localidade">Centro de custo proposto</Label>
                      <Select value={form.centroCustoPropostoId} onValueChange={(v) => atualizar('centroCustoPropostoId', v)}>
                        <SelectTrigger id="select-cc-localidade" invalid={!!mostrarErro('centroCustoPropostoId')}>
                          <SelectValue placeholder="Selecione o centro de custo" />
                        </SelectTrigger>
                        <SelectContent>
                          {centrosCusto
                            .filter((cc) => cc.plantaId === form.plantaPropostaId)
                            .map((cc) => (
                              <SelectItem key={cc.id} value={cc.id}>
                                {cc.codigo} · {cc.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FieldError>{mostrarErro('centroCustoPropostoId')}</FieldError>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="select-gestor-destino">Gestor de destino (opcional)</Label>
                      <Select value={form.gestorPropostoId || 'sem_gestor'} onValueChange={(v) => atualizar('gestorPropostoId', v === 'sem_gestor' ? '' : v)}>
                        <SelectTrigger id="select-gestor-destino" invalid={!!mostrarErro('gestorPropostoId')}>
                          <SelectValue placeholder="Selecione o gestor na localidade de destino" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem_gestor">A definir</SelectItem>
                          {colaboradores
                            .filter((c) => c.isGestor && c.status === 'ativo' && c.plantaId === form.plantaPropostaId && c.id !== colaborador.id)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome} — {cargos.find((cg) => cg.id === c.cargoId)?.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FieldError>{mostrarErro('gestorPropostoId')}</FieldError>
                      <FieldHint>Quando informado, exige aprovação também do gestor de destino (regra pendente de definição de negócio para o escopo exato).</FieldHint>
                    </div>
                  </div>
                )}

                {form.tipo === 'alteracao_mao_de_obra' && (
                  <div>
                    <Label htmlFor="select-mao-de-obra">Tipo de mão de obra proposto</Label>
                    <Select value={form.tipoMaoDeObraProposto} onValueChange={(v) => atualizar('tipoMaoDeObraProposto', v as TipoMaoDeObra)}>
                      <SelectTrigger id="select-mao-de-obra" invalid={!!mostrarErro('tipoMaoDeObraProposto')}>
                        <SelectValue placeholder="Selecione o tipo de mão de obra" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="direta">Mão de obra direta</SelectItem>
                        <SelectItem value="indireta">Mão de obra indireta</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError>{mostrarErro('tipoMaoDeObraProposto')}</FieldError>
                  </div>
                )}

                {form.tipo === 'alteracao_area_atuacao' && (
                  <div>
                    <Label htmlFor="select-area-proposta">Área de atuação proposta</Label>
                    <Select value={form.areaPropostaId} onValueChange={(v) => atualizar('areaPropostaId', v)}>
                      <SelectTrigger id="select-area-proposta" invalid={!!mostrarErro('areaPropostaId')}>
                        <SelectValue placeholder="Selecione a nova área" />
                      </SelectTrigger>
                      <SelectContent>
                        {areas
                          .filter((a) => a.id !== colaborador.areaId)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{mostrarErro('areaPropostaId')}</FieldError>
                  </div>
                )}

                {camposComparados.length > 0 && (
                  <div>
                    <Label>Comparação</Label>
                    <ComparacaoCampos campos={camposComparados} />
                  </div>
                )}
              </div>
            )}

            {passo === 2 && form.tipo && (
              <div className="space-y-5">
                <div>
                  <Label htmlFor="textarea-justificativa">Justificativa</Label>
                  <Textarea
                    id="textarea-justificativa"
                    rows={5}
                    placeholder="Descreva o motivo da movimentação…"
                    value={form.justificativa}
                    onChange={(e) => atualizar('justificativa', e.target.value)}
                    invalid={!!mostrarErro('justificativa')}
                  />
                  <FieldError>{mostrarErro('justificativa')}</FieldError>
                </div>
                {documentosExistentes.length > 0 && (
                  <div>
                    <Label>Evidências já anexadas</Label>
                    <ul className="space-y-1.5 text-sm text-[var(--color-ink-muted)]">
                      {documentosExistentes.map((doc) => (
                        <li key={doc.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2">
                          {doc.nome}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <Label>
                    {documentosExistentes.length > 0 ? 'Adicionar novas evidências' : 'Evidências'}{' '}
                    {evidenciaObrigatoria(form.tipo) ? '(obrigatório para este tipo)' : '(opcional)'}
                  </Label>
                  <FileDropzone
                    arquivos={form.arquivos}
                    invalid={!!mostrarErro('arquivos')}
                    onAdicionar={(novos) => atualizar('arquivos', [...form.arquivos, ...novos])}
                    onRemover={(idx) => atualizar('arquivos', form.arquivos.filter((_, i) => i !== idx))}
                  />
                  <FieldError>{mostrarErro('arquivos')}</FieldError>
                </div>
              </div>
            )}

            {passo === 3 && colaborador && form.tipo && (
              <div className="space-y-5">
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-slate-50/60 p-4">
                  <p className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                    {rotuloTipoMovimentacao(form.tipo)} — {colaborador.nome}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">Vigência em {form.vigencia}</p>
                </div>

                <ComparacaoCampos campos={camposComparados} />

                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-[var(--color-ink)]">Justificativa</p>
                  <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-ink-muted)]">{form.justificativa}</p>
                </div>

                {(form.arquivos.length > 0 || documentosExistentes.length > 0) && (
                  <div>
                    <p className="mb-1.5 text-[13px] font-medium text-[var(--color-ink)]">Evidências anexadas</p>
                    <ul className="space-y-1 text-sm text-[var(--color-ink-muted)]">
                      {documentosExistentes.map((d) => (
                        <li key={d.id}>• {d.nome}</li>
                      ))}
                      {form.arquivos.map((a, i) => (
                        <li key={i}>• {a.nome}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-[var(--color-ink)]">Checagens de regras</p>
                  <ChecagensList checagens={checagensPreview} />
                  <p className="mt-2 text-xs text-[var(--color-ink-subtle)]">{NOTA_REGRAS_DEMO}</p>
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4">
                  <p className="text-[13px] font-medium text-[var(--color-ink)]">Fluxo de aprovação</p>
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    Superior cadastrado → RH Local → RH Central. Se o gestor solicitou, decide o superior dele; se o RH solicitou, decide o superior do colaborador.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-[var(--color-border)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {passo > 0 && (
              <Button variant="ghost" onClick={voltar} disabled={enviando}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                Voltar
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <Button variant="secondary" onClick={salvarRascunho} loading={enviando} disabled={!form.colaboradorId || !form.tipo}>
              <Save className="size-4" aria-hidden="true" />
              Salvar rascunho
            </Button>
            {passo < PASSOS.length - 1 ? (
              <Button onClick={avancar}>
                Continuar
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={enviarParaAprovacao} loading={enviando}>
                <Send className="size-4" aria-hidden="true" />
                Enviar para aprovação
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

function AvisosSalariais({ cargoId, salarioAtual, salarioProposto }: { cargoId: string; salarioAtual: number; salarioProposto: number }) {
  const percentual = percentualAlteracaoSalarial(salarioAtual, salarioProposto)
  const { dentroDaFaixa, cargo } = faixaSalarialStatus(cargoId, salarioProposto)
  return (
    <div className="mt-3 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-slate-50/60 p-3.5 text-[13px]">
      <p className="font-medium text-[var(--color-ink)]">
        Variação: <span className={percentual >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{percentual >= 0 ? '+' : ''}{percentual.toFixed(1)}%</span>
      </p>
      {cargo && !dentroDaFaixa && (
        <p className="flex items-start gap-1.5 text-[var(--color-warning)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Fora da faixa salarial do cargo ({formatCurrency(cargo.salarioMin)} – {formatCurrency(cargo.salarioMax)}). Aviso demonstrativo — não bloqueia o envio.
        </p>
      )}
      <p className="flex items-start gap-1.5 text-[var(--color-ink-muted)]">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Aviso demonstrativo: eventual parcelamento segue a política interna vigente; valores de dissídio/convenção coletiva não estão refletidos nesta simulação.
      </p>
    </div>
  )
}
