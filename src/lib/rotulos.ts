import type { CampoDivergente, CategoriaLogIntegracao, Documento, EtapaMovimentacao, Potencial, StatusColaborador, StatusDivergencia, StatusLogIntegracao, StatusMovimentacao, StatusSincronizacao, TipoMaoDeObra, TipoMovimentacao } from '@/types'

export type Tom = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export function rotuloTipoMovimentacao(tipo: TipoMovimentacao): string {
  switch (tipo) {
    case 'mudanca_gestor':
      return 'Mudança de gestor'
    case 'alteracao_cargo':
      return 'Alteração de cargo'
    case 'alteracao_salarial':
      return 'Alteração salarial'
    case 'promocao':
      return 'Promoção'
    case 'enquadramento':
      return 'Enquadramento'
    case 'transferencia_cc':
      return 'Transferência de centro de custo'
    case 'merito':
      return 'Mérito'
    case 'transferencia_localidade':
      return 'Transferência de localidade'
    case 'alteracao_mao_de_obra':
      return 'Alteração de mão de obra'
    case 'alteracao_area_atuacao':
      return 'Alteração de área de atuação'
  }
}

export function rotuloStatusMovimentacao(status: StatusMovimentacao): string {
  switch (status) {
    case 'rascunho':
      return 'Rascunho'
    case 'em_andamento':
      return 'Em andamento'
    case 'devolvida':
      return 'Devolvida'
    case 'reprovada':
      return 'Reprovada'
    case 'aprovada':
      return 'Aprovada'
  }
}

export function tomStatusMovimentacao(status: StatusMovimentacao): Tom {
  switch (status) {
    case 'rascunho':
      return 'neutral'
    case 'em_andamento':
      return 'info'
    case 'devolvida':
      return 'warning'
    case 'reprovada':
      return 'danger'
    case 'aprovada':
      return 'success'
  }
}

export function rotuloEtapaMovimentacao(etapa: EtapaMovimentacao): string {
  switch (etapa) {
    case 'gestor':
      return 'Gestor'
    case 'rh_local':
      return 'RH Local'
    case 'rh_central':
      return 'RH Central'
    case 'concluida':
      return 'Concluída'
  }
}

export function rotuloStatusColaborador(status: StatusColaborador): string {
  switch (status) {
    case 'ativo':
      return 'Ativo'
    case 'afastado':
      return 'Afastado'
    case 'inativo':
      return 'Inativo'
  }
}

export function tomStatusColaborador(status: StatusColaborador): Tom {
  switch (status) {
    case 'ativo':
      return 'success'
    case 'afastado':
      return 'warning'
    case 'inativo':
      return 'neutral'
  }
}

export function rotuloIpe(ipe: number | null | undefined): string {
  switch (ipe) {
    case 1:
      return '1 — Muito baixa'
    case 2:
      return '2 — Baixa'
    case 3:
      return '3 — Média'
    case 4:
      return '4 — Alta'
    case 5:
      return '5 — Muito alta'
    default:
      return 'IPE não definido'
  }
}

export function rotuloTipoMaoDeObra(tipo: TipoMaoDeObra | null | undefined): string {
  switch (tipo) {
    case 'direta':
      return 'Mão de obra direta'
    case 'indireta':
      return 'Mão de obra indireta'
    default:
      return 'Não definido'
  }
}

export function rotuloPotencial(potencial: Potencial | null | undefined): string {
  switch (potencial) {
    case 'baixo':
      return 'Baixo'
    case 'estavel':
      return 'Estável'
    case 'alto':
      return 'Alto potencial'
    default:
      return 'Não informado'
  }
}

export function rotuloStatusSincronizacao(status: StatusSincronizacao): string {
  switch (status) {
    case 'sincronizado':
      return 'Sincronizado'
    case 'divergente':
      return 'Divergente'
    case 'pendente':
      return 'Pendente'
  }
}

export function tomStatusSincronizacao(status: StatusSincronizacao): Tom {
  switch (status) {
    case 'sincronizado':
      return 'success'
    case 'divergente':
      return 'danger'
    case 'pendente':
      return 'warning'
  }
}

export function rotuloCategoriaLog(categoria: CategoriaLogIntegracao): string {
  switch (categoria) {
    case 'movimentacao':
      return 'Movimentação'
    case 'aprovacao':
      return 'Aprovação'
    case 'conciliacao':
      return 'Conciliação'
    case 'exportacao':
      return 'Exportação'
    case 'sistema':
      return 'Sistema'
  }
}

export function rotuloStatusLog(status: StatusLogIntegracao): string {
  return status === 'sucesso' ? 'Sucesso' : 'Erro'
}

export function tomStatusLog(status: StatusLogIntegracao): Tom {
  return status === 'sucesso' ? 'success' : 'danger'
}

export function rotuloTipoDocumento(tipo: Documento['tipo']): string {
  switch (tipo) {
    case 'evidencia':
      return 'Evidência'
    case 'documento_aprovado':
      return 'Documento aprovado'
    case 'offer_letter':
      return 'Offer letter'
    case 'c_req':
      return 'C-req'
    case 'e_req':
      return 'E-req'
    case 'carta_promocao':
      return 'Carta de promoção'
    case 'carta_merito':
      return 'Carta de mérito'
  }
}

export function rotuloCampoDivergente(campo: CampoDivergente): string {
  switch (campo) {
    case 'gestor':
      return 'Gestor'
    case 'cargo':
      return 'Cargo'
    case 'centro_custo':
      return 'Centro de custo'
    case 'area':
      return 'Área'
  }
}

export function rotuloStatusDivergencia(status: StatusDivergencia): string {
  switch (status) {
    case 'aberta':
      return 'Aberta'
    case 'em_tratamento':
      return 'Em tratamento'
    case 'resolvida':
      return 'Resolvida'
  }
}

export function tomStatusDivergencia(status: StatusDivergencia): Tom {
  switch (status) {
    case 'aberta':
      return 'danger'
    case 'em_tratamento':
      return 'warning'
    case 'resolvida':
      return 'success'
  }
}
