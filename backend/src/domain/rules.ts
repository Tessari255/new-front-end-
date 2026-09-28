// Regras de negócio de demonstração, avaliadas sempre no servidor.
// Portadas de src/data/rules.ts do frontend; não substituem políticas oficiais de RH.
import type {
  ChecagemRegra,
  DetalheAlteracao,
  PropostaAlteracao,
  TipoMovimentacao,
} from '../types.ts'

export const TIPOS_COM_EVIDENCIA_OBRIGATORIA: TipoMovimentacao[] = ['alteracao_salarial', 'promocao', 'enquadramento']

export function evidenciaObrigatoria(tipo: TipoMovimentacao): boolean {
  return TIPOS_COM_EVIDENCIA_OBRIGATORIA.includes(tipo)
}

export const MIN_JUSTIFICATIVA = 10
export const MIN_COMENTARIO_DECISAO = 5
export const MIN_JUSTIFICATIVA_RESOLUCAO = 10

export interface ColaboradorCtx {
  id: string
  nome: string
  status: 'ativo' | 'afastado' | 'inativo'
  plantaId: string
  cargoId: string
  centroCustoId: string
  folhaId: string
  horarioId: string
  gestorId: string | null
  salario: number
}

export interface CargoCtx {
  id: string
  salarioMin: number
  salarioMax: number
  plantasPermitidas: string[]
}

/** Dados de catálogo/colaboradores já carregados do banco necessários para avaliar uma movimentação. */
export interface ContextoAvaliacao {
  colaborador: ColaboradorCtx
  gestorProposto: { id: string; status: string; isGestor: boolean } | null
  cargoProposto: CargoCtx | null
  cargoAtual: CargoCtx | null
  centroCustoProposto: { id: string; plantaId: string } | null
  folhaPropostaExiste: boolean
  horarioPropostoExiste: boolean
  temEvidencia: boolean
}

export function vigenciaValida(vigencia: string | null | undefined): boolean {
  if (!vigencia || !/^\d{4}-\d{2}-\d{2}$/.test(vigencia)) return false
  const d = new Date(`${vigencia}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === vigencia
}

export function montarAlteracao(p: PropostaAlteracao, c: ColaboradorCtx): DetalheAlteracao {
  switch (p.tipo) {
    case 'mudanca_gestor':
      return { tipo: 'mudanca_gestor', gestorAtualId: c.gestorId, gestorPropostoId: p.gestorPropostoId ?? c.gestorId ?? '' }
    case 'alteracao_cargo':
      return { tipo: 'alteracao_cargo', cargoAtualId: c.cargoId, cargoPropostoId: p.cargoPropostoId ?? c.cargoId }
    case 'alteracao_salarial':
      return { tipo: 'alteracao_salarial', salarioAtual: c.salario, salarioProposto: p.salarioProposto ?? c.salario }
    case 'promocao':
      return {
        tipo: 'promocao',
        cargoAtualId: c.cargoId,
        cargoPropostoId: p.cargoPropostoId ?? c.cargoId,
        salarioAtual: c.salario,
        salarioProposto: p.salarioProposto ?? c.salario,
      }
    case 'enquadramento':
      return {
        tipo: 'enquadramento',
        folhaAtualId: c.folhaId,
        folhaPropostaId: p.folhaPropostaId ?? c.folhaId,
        horarioAtualId: c.horarioId,
        horarioPropostoId: p.horarioPropostoId ?? c.horarioId,
      }
    case 'transferencia_cc':
      return {
        tipo: 'transferencia_cc',
        centroCustoAtualId: c.centroCustoId,
        centroCustoPropostoId: p.centroCustoPropostoId ?? c.centroCustoId,
        plantaAtualId: c.plantaId,
        plantaPropostaId: c.plantaId,
      }
  }
}

/** Extrai apenas os valores propostos de uma alteração já armazenada. */
export function propostaDeAlteracao(a: DetalheAlteracao): PropostaAlteracao {
  switch (a.tipo) {
    case 'mudanca_gestor':
      return { tipo: a.tipo, gestorPropostoId: a.gestorPropostoId }
    case 'alteracao_cargo':
      return { tipo: a.tipo, cargoPropostoId: a.cargoPropostoId }
    case 'alteracao_salarial':
      return { tipo: a.tipo, salarioProposto: a.salarioProposto }
    case 'promocao':
      return { tipo: a.tipo, cargoPropostoId: a.cargoPropostoId, salarioProposto: a.salarioProposto }
    case 'enquadramento':
      return { tipo: a.tipo, folhaPropostaId: a.folhaPropostaId, horarioPropostoId: a.horarioPropostoId }
    case 'transferencia_cc':
      return { tipo: a.tipo, centroCustoPropostoId: a.centroCustoPropostoId }
  }
}

/** Ids referenciados na proposta que precisam ser carregados para a avaliação. */
export function idsReferenciados(a: DetalheAlteracao) {
  return {
    gestorId: a.tipo === 'mudanca_gestor' ? a.gestorPropostoId : null,
    cargoId: a.tipo === 'alteracao_cargo' || a.tipo === 'promocao' ? a.cargoPropostoId : null,
    centroCustoId: a.tipo === 'transferencia_cc' ? a.centroCustoPropostoId : null,
    folhaId: a.tipo === 'enquadramento' ? a.folhaPropostaId : null,
    horarioId: a.tipo === 'enquadramento' ? a.horarioPropostoId : null,
  }
}

export interface ResultadoAvaliacao {
  checagens: ChecagemRegra[]
  fieldErrors: Record<string, string>
  /** true quando nada bloqueia o envio para aprovação. */
  podeEnviar: boolean
}

export function avaliarMovimentacao(
  tipo: TipoMovimentacao,
  alteracao: DetalheAlteracao,
  vigencia: string,
  justificativa: string,
  ctx: ContextoAvaliacao,
): ResultadoAvaliacao {
  const { colaborador } = ctx
  const checagens: ChecagemRegra[] = []
  const fieldErrors: Record<string, string> = {}
  const add = (descricao: string, atendida: boolean, severidade: ChecagemRegra['severidade'] = 'bloqueante') => {
    checagens.push({ id: `chk-${checagens.length + 1}`, descricao, atendida, severidade })
  }

  const justificativaOk = justificativa.trim().length >= MIN_JUSTIFICATIVA
  add('Justificativa preenchida', justificativaOk)
  if (!justificativaOk) fieldErrors.justificativa = `Descreva a justificativa com pelo menos ${MIN_JUSTIFICATIVA} caracteres.`

  const vigenciaOk = vigenciaValida(vigencia)
  add('Vigência informada e válida', vigenciaOk)
  if (!vigenciaOk) fieldErrors.vigencia = 'Informe uma data de vigência válida.'

  if (evidenciaObrigatoria(tipo)) {
    add('Evidência obrigatória anexada', ctx.temEvidencia)
    if (!ctx.temEvidencia) fieldErrors.arquivos = 'Este tipo de movimentação exige ao menos uma evidência anexada.'
  }

  switch (alteracao.tipo) {
    case 'mudanca_gestor': {
      const c = ctx.gestorProposto
      let motivo: string | undefined
      if (!c) motivo = 'Selecione o gestor proposto.'
      else if (c.id === colaborador.id) motivo = 'O gestor não pode ser o próprio colaborador.'
      else if (c.id === colaborador.gestorId) motivo = 'Selecione um gestor diferente do atual.'
      else if (c.status !== 'ativo') motivo = 'O gestor selecionado não está ativo.'
      else if (!c.isGestor) motivo = 'Colaborador selecionado não possui perfil de gestor.'
      add('Gestor proposto ativo e distinto do colaborador', !motivo)
      if (motivo) fieldErrors.gestorPropostoId = motivo
      break
    }
    case 'alteracao_cargo':
    case 'promocao': {
      const c = ctx.cargoProposto
      let motivo: string | undefined
      if (!c || c.id === colaborador.cargoId) motivo = 'Selecione o cargo proposto.'
      else if (!c.plantasPermitidas.includes(colaborador.plantaId)) motivo = 'Cargo não habilitado para esta planta (regra de demonstração).'
      add('Cargo compatível com a unidade', !motivo)
      if (motivo) fieldErrors.cargoPropostoId = motivo
      break
    }
    case 'transferencia_cc': {
      const c = ctx.centroCustoProposto
      let motivo: string | undefined
      if (!c || c.id === colaborador.centroCustoId) motivo = 'Selecione o centro de custo proposto.'
      else if (c.plantaId !== colaborador.plantaId) motivo = 'Centro de custo não pertence à planta do colaborador.'
      add('Centro de custo válido para a planta de destino', !motivo)
      if (motivo) fieldErrors.centroCustoPropostoId = motivo
      break
    }
    case 'enquadramento': {
      if (!ctx.folhaPropostaExiste) fieldErrors.folhaPropostaId = 'Selecione a folha proposta.'
      if (!ctx.horarioPropostoExiste) fieldErrors.horarioPropostoId = 'Selecione o horário proposto.'
      if (
        ctx.folhaPropostaExiste &&
        ctx.horarioPropostoExiste &&
        alteracao.folhaPropostaId === colaborador.folhaId &&
        alteracao.horarioPropostoId === colaborador.horarioId
      ) {
        fieldErrors.horarioPropostoId = 'Altere ao menos a folha ou o horário em relação aos valores atuais.'
      }
      break
    }
    default:
      break
  }

  if (alteracao.tipo === 'alteracao_salarial' || alteracao.tipo === 'promocao') {
    const valor = alteracao.salarioProposto
    if (!Number.isFinite(valor) || valor <= 0) fieldErrors.salarioProposto = 'Informe um salário proposto válido.'
    else if (valor === colaborador.salario) fieldErrors.salarioProposto = 'Informe um valor diferente do salário atual.'
    // Faixa salarial é apenas aviso, nunca bloqueio.
    const cargoRef = alteracao.tipo === 'promocao' ? (ctx.cargoProposto ?? ctx.cargoAtual) : ctx.cargoAtual
    const dentro = !cargoRef || (valor >= cargoRef.salarioMin && valor <= cargoRef.salarioMax)
    add('Salário proposto dentro da faixa do cargo', dentro, 'aviso')
  }

  const bloqueante = checagens.some((c) => !c.atendida && c.severidade === 'bloqueante')
  const podeEnviar = !bloqueante && Object.keys(fieldErrors).length === 0
  return { checagens, fieldErrors, podeEnviar }
}
