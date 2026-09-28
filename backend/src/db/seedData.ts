// Dados de demonstração equivalentes aos seeds do frontend (src/data/*), com chaves naturais.
// As chaves (ex.: 'col-gru-05') existem só para relacionar registros durante o seed;
// os ids reais são gerados pelo banco.
import { ETAPAS_ORDEM, nomeAprovador } from '../domain/fluxo.ts'
import { avaliarMovimentacao, montarAlteracao, type CargoCtx, type ColaboradorCtx } from '../domain/rules.ts'
import type {
  CampoDivergente,
  ChecagemRegra,
  Decisao,
  DetalheAlteracao,
  EtapaMovimentacao,
  PerfilDemo,
  Potencial,
  StatusColaborador,
  StatusDivergencia,
  StatusMovimentacao,
  StatusSincronizacao,
  TipoDocumento,
  TipoEvento,
  TipoMaoDeObra,
  TipoMovimentacao,
} from '../types.ts'

export interface SPlanta { key: string; codigo: string; nome: string; cidade: string; estado: string }
export interface SArea { key: string; nome: string }
export interface SCargo { key: string; nome: string; nivel: string; areaKey: string; salarioMin: number; salarioMax: number; plantas: string[] }
export interface SCentroCusto { key: string; codigo: string; nome: string; plantaKey: string }
export interface SHorario { key: string; nome: string; turno: string; carga: number }
export interface SFolha { key: string; nome: string; tipo: string; periodicidade: string }
export interface SColaborador {
  key: string
  matricula: string
  nome: string
  email: string
  telefone: string
  dataAdmissao: string
  status: StatusColaborador
  cargoKey: string
  areaKey: string
  plantaKey: string
  centroCustoKey: string
  horarioKey: string
  folhaKey: string
  gestorKey: string | null
  isGestor: boolean
  salario: number
  apdataId: string
  employeeCentralId: string
  statusSincronizacao: StatusSincronizacao
  tipoMaoDeObra: TipoMaoDeObra
}
export interface SUsuario { subject: string; nome: string; email: string; perfil: PerfilDemo; plantaKey: string | null; colaboradorKey: string | null }
export interface SFonte { colaboradorKey: string; fonte: 'apdata' | 'employee_central'; gestor: string; cargo: string; centroCusto: string; area: string }
export interface SDecisao { etapa: Exclude<EtapaMovimentacao, 'concluida'>; perfil: PerfilDemo; nome: string; decisao: Decisao; comentario?: string; data: string }
export interface SDocumento { nome: string; tipo: TipoDocumento; tamanhoBytes: number; autorKey: string; criadoEm: string }
export interface SEvento { tipo: TipoEvento; data: string; autor: string; descricao: string; comentario?: string }
export interface SMovimentacao {
  colaboradorKey: string
  plantaKey: string
  tipo: TipoMovimentacao
  solicitanteNome: string
  dataAbertura: string
  vigencia: string
  etapaAtual: EtapaMovimentacao
  status: StatusMovimentacao
  alteracao: DetalheAlteracao
  justificativa: string
  checagens: ChecagemRegra[]
  decisoes: SDecisao[]
  documentos: SDocumento[]
  eventos: SEvento[]
  potencial?: Potencial
  apdataGeradoEm?: string
  employeeCentralGeradoEm?: string
}
export interface SDivergencia {
  colaboradorKey: string
  campo: CampoDivergente
  valorApdata: string
  valorEmployeeCentral: string
  status: StatusDivergencia
  responsavelKey: string | null
  detectadaEm: string
  resolvidaEm?: string
  justificativaResolucao?: string
}

// ---------- Catálogo ----------

const plantas: SPlanta[] = [
  { key: 'planta-gru', codigo: 'GRU', nome: 'Planta Guarulhos', cidade: 'Guarulhos', estado: 'SP' },
  { key: 'planta-joi', codigo: 'JOI', nome: 'Planta Joinville', cidade: 'Joinville', estado: 'SC' },
  { key: 'planta-bet', codigo: 'BET', nome: 'Planta Betim', cidade: 'Betim', estado: 'MG' },
]

const areas: SArea[] = [
  { key: 'area-producao', nome: 'Produção' },
  { key: 'area-manutencao', nome: 'Manutenção' },
  { key: 'area-qualidade', nome: 'Qualidade' },
  { key: 'area-logistica', nome: 'Logística' },
  { key: 'area-engenharia', nome: 'Engenharia' },
  { key: 'area-rh', nome: 'Recursos Humanos' },
  { key: 'area-financeiro', nome: 'Financeiro' },
  { key: 'area-ti', nome: 'Tecnologia da Informação' },
]

const todas = plantas.map((p) => p.key)
const gruBet = ['planta-gru', 'planta-bet']
const soGru = ['planta-gru']

function cg(key: string, nome: string, nivel: string, areaKey: string, min: number, max: number, plantasPermitidas: string[]): SCargo {
  return { key, nome, nivel, areaKey, salarioMin: min, salarioMax: max, plantas: plantasPermitidas }
}

const cargos: SCargo[] = [
  cg('cargo-op1', 'Operador de Produção I', 'Operacional', 'area-producao', 2200, 2600, todas),
  cg('cargo-op2', 'Operador de Produção II', 'Operacional', 'area-producao', 2600, 3100, todas),
  cg('cargo-lider-prod', 'Líder de Produção', 'Técnico', 'area-producao', 3400, 4200, todas),
  cg('cargo-sup-prod', 'Supervisor de Produção', 'Coordenação', 'area-producao', 5200, 6500, todas),
  cg('cargo-ger-planta', 'Gerente de Planta', 'Gerência', 'area-producao', 14000, 18500, todas),
  cg('cargo-tec-manut', 'Técnico de Manutenção', 'Técnico', 'area-manutencao', 3200, 3900, todas),
  cg('cargo-tec-manut-sr', 'Técnico de Manutenção Sênior', 'Técnico', 'area-manutencao', 3900, 4700, todas),
  cg('cargo-sup-manut', 'Supervisor de Manutenção', 'Coordenação', 'area-manutencao', 5300, 6600, todas),
  cg('cargo-analista-qual-jr', 'Analista de Qualidade Jr.', 'Técnico', 'area-qualidade', 2800, 3300, todas),
  cg('cargo-analista-qual-pl', 'Analista de Qualidade Pleno', 'Técnico', 'area-qualidade', 3600, 4400, todas),
  cg('cargo-analista-qual-sr', 'Analista de Qualidade Sênior', 'Técnico', 'area-qualidade', 4600, 5600, todas),
  cg('cargo-coord-qual', 'Coordenador de Qualidade', 'Coordenação', 'area-qualidade', 6800, 8200, todas),
  cg('cargo-aux-log', 'Auxiliar de Logística', 'Operacional', 'area-logistica', 2100, 2500, todas),
  cg('cargo-analista-log', 'Analista de Logística', 'Técnico', 'area-logistica', 3300, 4000, todas),
  cg('cargo-sup-log', 'Supervisor de Logística', 'Coordenação', 'area-logistica', 5400, 6600, todas),
  // Regra fictícia: Engenharia só habilitada em Guarulhos e Betim.
  cg('cargo-eng-jr', 'Engenheiro de Processos Jr.', 'Técnico', 'area-engenharia', 5800, 6800, gruBet),
  cg('cargo-eng-pl', 'Engenheiro de Processos Pleno', 'Técnico', 'area-engenharia', 7200, 8600, gruBet),
  cg('cargo-coord-eng', 'Coordenador de Engenharia', 'Coordenação', 'area-engenharia', 12000, 14500, gruBet),
  cg('cargo-analista-rh-jr', 'Analista de RH Jr.', 'Técnico', 'area-rh', 3200, 3800, todas),
  cg('cargo-analista-rh-pl', 'Analista de RH Pleno', 'Técnico', 'area-rh', 4000, 4800, todas),
  cg('cargo-bp-rh', 'Business Partner de RH', 'Coordenação', 'area-rh', 7500, 9200, todas),
  cg('cargo-ger-rh', 'Gerente de RH', 'Gerência', 'area-rh', 13500, 16800, soGru),
  cg('cargo-analista-fin-pl', 'Analista Financeiro Pleno', 'Técnico', 'area-financeiro', 4300, 5200, todas),
  cg('cargo-controller', 'Controller de Planta', 'Coordenação', 'area-financeiro', 9800, 11800, todas),
  cg('cargo-analista-ti-pl', 'Analista de TI Pleno', 'Técnico', 'area-ti', 5200, 6300, soGru),
  cg('cargo-coord-ti', 'Coordenador de TI', 'Coordenação', 'area-ti', 8800, 10500, soGru),
  cg('cargo-diretor-industrial', 'Diretor Industrial', 'Diretoria', 'area-producao', 24000, 32000, soGru),
  cg('cargo-cio', 'CIO', 'CIO', 'area-ti', 35000, 45000, soGru),
]

const centrosCusto: SCentroCusto[] = plantas.flatMap((p) => [
  { key: `cc-${p.codigo}-prod`, codigo: `${p.codigo}-1010`, nome: 'CC Produção', plantaKey: p.key },
  { key: `cc-${p.codigo}-manut`, codigo: `${p.codigo}-1020`, nome: 'CC Manutenção', plantaKey: p.key },
  { key: `cc-${p.codigo}-qual`, codigo: `${p.codigo}-1030`, nome: 'CC Qualidade', plantaKey: p.key },
  { key: `cc-${p.codigo}-log`, codigo: `${p.codigo}-1040`, nome: 'CC Logística', plantaKey: p.key },
  { key: `cc-${p.codigo}-adm`, codigo: `${p.codigo}-1050`, nome: 'CC Administrativo', plantaKey: p.key },
])

const horarios: SHorario[] = [
  { key: 'horario-adm', nome: 'Administrativo', turno: 'Administrativo', carga: 44 },
  { key: 'horario-t1', nome: '1º Turno', turno: '1º Turno', carga: 44 },
  { key: 'horario-t2', nome: '2º Turno', turno: '2º Turno', carga: 44 },
  { key: 'horario-t3', nome: '3º Turno', turno: '3º Turno', carga: 36 },
]

const folhas: SFolha[] = [
  { key: 'folha-mensalista', nome: 'Mensalista', tipo: 'Mensalista', periodicidade: 'Mensal' },
  { key: 'folha-horista', nome: 'Horista', tipo: 'Horista', periodicidade: 'Quinzenal' },
]

// ---------- Colaboradores ----------

const NOME_POOL = [
  'Ana Beatriz Souza', 'Bruno Carvalho Lima', 'Camila Ferreira Duarte', 'Diego Martins Pereira', 'Eduarda Ribeiro Alves',
  'Felipe Augusto Rocha', 'Gabriela Nunes Barbosa', 'Henrique Costa Teixeira', 'Isabela Cristina Gomes', 'João Pedro Almeida',
  'Karina Santos Moreira', 'Leonardo Dias Cardoso', 'Mariana Oliveira Castro', 'Nicolas Batista Fogaça', 'Otávio Henrique Farias',
  'Patrícia Mendes Vieira', 'Rafael Andrade Siqueira', 'Sabrina Lopes Monteiro', 'Thiago Correia Machado', 'Vanessa Pires Guimarães',
  'William Torres Cavalcante', 'Yasmin Rodrigues Freitas', 'Alexandre Nogueira Reis', 'Beatriz Campos Xavier', 'Caio Fernandes Brito',
  'Daniela Azevedo Pinto', 'Emerson Vaz Coutinho', 'Fernanda Cunha Bezerra', 'Gustavo Henrique Prado', 'Helena Marques Tavares',
  'Igor Salgado Peixoto', 'Juliana Aparecida Melo', 'Kleber Antunes Ramos', 'Larissa Soares Pacheco', 'Marcelo Vidal Fonseca',
  'Natália Borges Amaral', 'Otávio Ferraz Leite', 'Paula Regina Sales', 'Rodrigo Esteves Franco', 'Simone Rezende Costa',
  'Tarcísio Bandeira Nunes', 'Valentina Rosa Medeiros', 'Wagner Lacerda Portela', 'Ximena Duarte Galvão', 'Yuri Camargo Sampaio',
  'Zilda Aparecida Correia', 'André Luiz Bittencourt', 'Bianca Ferreira Aguiar', 'Cláudio Renato Assis', 'Débora Cristina Lemos',
]

const pad = (n: number, size = 3) => String(n).padStart(size, '0')

function email(nome: string) {
  const slug = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
  return `${slug}@nexopeople.demo.br`
}

interface SlotDef {
  cargoKey: string
  areaKey: string
  horarioKey: string
  folhaKey: string
  isGestor: boolean
  reportsToSlot: number | null
  salarioFator: number
  /** Mão de obra direta = execução de produção/manutenção em linha; indireta = os demais (regra fictícia de seed). */
  maoDeObra: TipoMaoDeObra
}

const s = (
  cargoKey: string, areaKey: string, horarioKey: string, folhaKey: string, isGestor: boolean, reportsToSlot: number | null, salarioFator: number,
  maoDeObra: TipoMaoDeObra = 'indireta',
): SlotDef => ({ cargoKey, areaKey, horarioKey, folhaKey, isGestor, reportsToSlot, salarioFator, maoDeObra })

const TEMPLATE_PLANTA: SlotDef[] = [
  s('cargo-ger-planta', 'area-producao', 'horario-adm', 'folha-mensalista', true, null, 0.55),
  s('cargo-sup-prod', 'area-producao', 'horario-adm', 'folha-mensalista', true, 0, 0.5),
  s('cargo-lider-prod', 'area-producao', 'horario-t1', 'folha-mensalista', true, 1, 0.45, 'direta'),
  s('cargo-op2', 'area-producao', 'horario-t1', 'folha-horista', false, 2, 0.6, 'direta'),
  s('cargo-op1', 'area-producao', 'horario-t1', 'folha-horista', false, 2, 0.3, 'direta'),
  s('cargo-op1', 'area-producao', 'horario-t2', 'folha-horista', false, 1, 0.5, 'direta'),
  s('cargo-sup-manut', 'area-manutencao', 'horario-adm', 'folha-mensalista', true, 0, 0.5),
  s('cargo-tec-manut', 'area-manutencao', 'horario-t2', 'folha-mensalista', false, 6, 0.4, 'direta'),
  s('cargo-tec-manut-sr', 'area-manutencao', 'horario-t3', 'folha-mensalista', false, 6, 0.55, 'direta'),
  s('cargo-coord-qual', 'area-qualidade', 'horario-adm', 'folha-mensalista', true, 0, 0.5),
  s('cargo-analista-qual-pl', 'area-qualidade', 'horario-adm', 'folha-mensalista', false, 9, 0.45),
  s('cargo-analista-log', 'area-logistica', 'horario-adm', 'folha-mensalista', false, 0, 0.4),
]

const TEMPLATE_CORPORATIVO: SlotDef[] = [
  s('cargo-diretor-industrial', 'area-producao', 'horario-adm', 'folha-mensalista', true, null, 0.6),
  s('cargo-ger-rh', 'area-rh', 'horario-adm', 'folha-mensalista', true, 0, 0.5),
  s('cargo-bp-rh', 'area-rh', 'horario-adm', 'folha-mensalista', true, 1, 0.45),
  s('cargo-analista-rh-pl', 'area-rh', 'horario-adm', 'folha-mensalista', false, 2, 0.4),
  s('cargo-coord-ti', 'area-ti', 'horario-adm', 'folha-mensalista', true, 0, 0.5),
  s('cargo-analista-ti-pl', 'area-ti', 'horario-adm', 'folha-mensalista', false, 4, 0.45),
  s('cargo-controller', 'area-financeiro', 'horario-adm', 'folha-mensalista', true, 0, 0.5),
  s('cargo-analista-fin-pl', 'area-financeiro', 'horario-adm', 'folha-mensalista', false, 6, 0.4),
  s('cargo-cio', 'area-ti', 'horario-adm', 'folha-mensalista', true, null, 0.7),
]

function ccPorArea(plantaKey: string, areaKey: string): string {
  const mapa: Record<string, string> = { 'area-producao': 'prod', 'area-manutencao': 'manut', 'area-qualidade': 'qual', 'area-logistica': 'log' }
  const codigo = plantas.find((p) => p.key === plantaKey)!.codigo
  return `cc-${codigo}-${mapa[areaKey] ?? 'adm'}`
}

function salarioDoSlot(slot: SlotDef): number {
  const cargo = cargos.find((c) => c.key === slot.cargoKey)!
  return Math.round(cargo.salarioMin + (cargo.salarioMax - cargo.salarioMin) * slot.salarioFator)
}

function statusSync(indiceGlobal: number): StatusSincronizacao {
  const resto = indiceGlobal % 9
  if (resto === 0) return 'divergente'
  if (resto === 5) return 'pendente'
  return 'sincronizado'
}

function dataAdmissaoEstavel(i: number): string {
  return `${2015 + (i % 10)}-${pad(1 + (i % 12), 2)}-${pad(1 + ((i * 7) % 27), 2)}`
}

function gerarColaboradores(): SColaborador[] {
  const out: SColaborador[] = []
  let cursorNome = 0
  let seq = 0
  let indiceGlobal = 0
  const novo = (slot: SlotDef, plantaKey: string, key: string, prefixoMatricula: string, gestorKey: string | null, prefixoTel: number, offsetTel: number): SColaborador => {
    const nome = NOME_POOL[cursorNome++ % NOME_POOL.length]!
    seq += 1
    const codigoPlanta = plantas.find((p) => p.key === plantaKey)!.codigo
    const c: SColaborador = {
      key,
      matricula: `${prefixoMatricula}${pad(seq, 4)}`,
      nome,
      email: email(nome),
      telefone: `(11) 9${String(prefixoTel + indiceGlobal).padStart(4, '0')}-${pad(offsetTel + indiceGlobal, 4)}`,
      dataAdmissao: dataAdmissaoEstavel(indiceGlobal),
      status: 'ativo',
      cargoKey: slot.cargoKey,
      areaKey: slot.areaKey,
      plantaKey,
      centroCustoKey: ccPorArea(plantaKey, slot.areaKey),
      horarioKey: slot.horarioKey,
      folhaKey: slot.folhaKey,
      gestorKey,
      isGestor: slot.isGestor,
      salario: salarioDoSlot(slot),
      apdataId: `AP-${codigoPlanta}-${pad(indiceGlobal + 1, 4)}`,
      employeeCentralId: `EC-${10000 + indiceGlobal}`,
      statusSincronizacao: statusSync(indiceGlobal),
      tipoMaoDeObra: slot.maoDeObra,
    }
    indiceGlobal += 1
    return c
  }

  for (const planta of plantas) {
    const chaves: string[] = []
    TEMPLATE_PLANTA.forEach((slot, idx) => {
      const key = `col-${planta.codigo.toLowerCase()}-${pad(idx + 1, 2)}`
      const gestorKey = slot.reportsToSlot === null ? null : chaves[slot.reportsToSlot]!
      out.push(novo(slot, planta.key, key, planta.codigo, gestorKey, 6000, 1000))
      chaves.push(key)
    })
  }
  const chavesCor: string[] = []
  TEMPLATE_CORPORATIVO.forEach((slot, idx) => {
    const key = `col-cor-${pad(idx + 1, 2)}`
    const gestorKey = slot.reportsToSlot === null ? null : chavesCor[slot.reportsToSlot]!
    out.push(novo(slot, 'planta-gru', key, 'COR', gestorKey, 7000, 2000))
    chavesCor.push(key)
  })

  // A hierarquia de demonstração inclui o diretor dos gerentes de planta e o CIO do diretor.
  for (const c of out) {
    if (c.cargoKey === 'cargo-ger-planta') c.gestorKey = 'col-cor-01'
    if (c.key === 'col-cor-01') c.gestorKey = 'col-cor-09'
  }

  // Caso central da demonstração (README): colaboradora de Qualidade em Joinville.
  const bianca = out.find((c) => c.key === 'col-joi-11')!
  bianca.nome = 'Bianca Ferreira Aguiar'
  bianca.email = email(bianca.nome)
  return out
}

// ---------- Movimentações ----------

const addDays = (iso: string, dias: number): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
const arredondar50 = (v: number) => Math.round(v / 50) * 50
/** Horário local de Brasília: os seeds do frontend usam horários "de parede" sem fuso. */
const brt = (local: string) => `${local}-03:00`

interface Cenario {
  colaboradorKey: string
  tipo: TipoMovimentacao
  status: StatusMovimentacao
  etapaReferencia: EtapaMovimentacao
  dataAbertura: string
  comEvidencia: boolean
  comArquivosGerados?: boolean
  comentario?: string
  pct?: number
  potencial?: Potencial
  /**
   * Sobrescreve o solicitante padrão (gestor do colaborador). Necessário quando a etapa de
   * referência é `gestor`: pela regra "gestor que cria o workflow não precisa aprovar", o
   * próprio gestor não poderia estar com uma decisão pendente/registrada nessa etapa.
   */
  solicitantePersonalizado?: string
}

const RH_LOCAL_GRU = 'RH Local — Planta Guarulhos'
const RH_LOCAL_JOI = 'RH Local — Planta Joinville'
const RH_LOCAL_BET = 'RH Local — Planta Betim'

const CENARIOS: Cenario[] = [
  { colaboradorKey: 'col-gru-05', tipo: 'promocao', status: 'aprovada', etapaReferencia: 'concluida', dataAbertura: '2026-08-28', comEvidencia: true, comArquivosGerados: true, pct: 14, potencial: 'alto' },
  { colaboradorKey: 'col-gru-08', tipo: 'alteracao_cargo', status: 'aprovada', etapaReferencia: 'concluida', dataAbertura: '2026-08-30', comEvidencia: false, comArquivosGerados: false },
  { colaboradorKey: 'col-gru-11', tipo: 'alteracao_salarial', status: 'em_andamento', etapaReferencia: 'rh_central', dataAbertura: '2026-08-24', comEvidencia: true, pct: 11 },
  { colaboradorKey: 'col-gru-03', tipo: 'mudanca_gestor', status: 'em_andamento', etapaReferencia: 'gestor', dataAbertura: '2026-09-12', comEvidencia: false, solicitantePersonalizado: RH_LOCAL_GRU },
  { colaboradorKey: 'col-gru-12', tipo: 'transferencia_cc', status: 'devolvida', etapaReferencia: 'rh_local', dataAbertura: '2026-08-14', comEvidencia: false, comentario: 'Centro de custo informado não possui orçamento aprovado para o trimestre. Favor confirmar novo CC com o Financeiro antes de reenviar.' },
  { colaboradorKey: 'col-gru-06', tipo: 'enquadramento', status: 'rascunho', etapaReferencia: 'gestor', dataAbertura: '2026-09-16', comEvidencia: false },
  { colaboradorKey: 'col-joi-07', tipo: 'mudanca_gestor', status: 'reprovada', etapaReferencia: 'gestor', dataAbertura: '2026-08-17', comEvidencia: false, comentario: 'Mudança de reporte entre pares não se aplica neste caso; nível hierárquico do cargo exige vínculo com a Gerência de Planta.', solicitantePersonalizado: RH_LOCAL_JOI },
  { colaboradorKey: 'col-joi-05', tipo: 'alteracao_cargo', status: 'em_andamento', etapaReferencia: 'rh_local', dataAbertura: '2026-09-01', comEvidencia: false },
  { colaboradorKey: 'col-joi-08', tipo: 'promocao', status: 'em_andamento', etapaReferencia: 'gestor', dataAbertura: '2026-09-10', comEvidencia: true, pct: 12, potencial: 'alto', solicitantePersonalizado: RH_LOCAL_JOI },
  { colaboradorKey: 'col-joi-06', tipo: 'alteracao_salarial', status: 'aprovada', etapaReferencia: 'concluida', dataAbertura: '2026-09-02', comEvidencia: true, comArquivosGerados: true, pct: 9 },
  { colaboradorKey: 'col-joi-04', tipo: 'enquadramento', status: 'em_andamento', etapaReferencia: 'rh_central', dataAbertura: '2026-08-27', comEvidencia: true },
  { colaboradorKey: 'col-bet-05', tipo: 'mudanca_gestor', status: 'aprovada', etapaReferencia: 'concluida', dataAbertura: '2026-09-05', comEvidencia: false, comArquivosGerados: false },
  { colaboradorKey: 'col-bet-08', tipo: 'alteracao_cargo', status: 'devolvida', etapaReferencia: 'gestor', dataAbertura: '2026-08-19', comEvidencia: false, comentario: 'Faltou detalhar o motivo técnico da mudança de cargo na justificativa. Por favor complementar com a avaliação de competências.', solicitantePersonalizado: RH_LOCAL_BET },
  { colaboradorKey: 'col-bet-11', tipo: 'transferencia_cc', status: 'em_andamento', etapaReferencia: 'rh_local', dataAbertura: '2026-09-04', comEvidencia: false },
  { colaboradorKey: 'col-bet-04', tipo: 'promocao', status: 'reprovada', etapaReferencia: 'rh_local', dataAbertura: '2026-08-12', comEvidencia: true, comentario: 'Orçamento de promoções do trimestre já foi integralmente utilizado pela unidade. Reavaliar no próximo ciclo.', pct: 16, potencial: 'estavel' },
  { colaboradorKey: 'col-bet-06', tipo: 'alteracao_salarial', status: 'rascunho', etapaReferencia: 'gestor', dataAbertura: '2026-09-17', comEvidencia: false, pct: 10 },
  { colaboradorKey: 'col-cor-04', tipo: 'alteracao_cargo', status: 'em_andamento', etapaReferencia: 'gestor', dataAbertura: '2026-09-08', comEvidencia: false, solicitantePersonalizado: RH_LOCAL_GRU },
  { colaboradorKey: 'col-cor-06', tipo: 'mudanca_gestor', status: 'em_andamento', etapaReferencia: 'rh_central', dataAbertura: '2026-08-22', comEvidencia: false },
  { colaboradorKey: 'col-bet-09', tipo: 'transferencia_cc', status: 'em_andamento', etapaReferencia: 'gestor', dataAbertura: '2026-09-15', comEvidencia: false, solicitantePersonalizado: RH_LOCAL_BET },
  { colaboradorKey: 'col-joi-09', tipo: 'merito', status: 'em_andamento', etapaReferencia: 'rh_local', dataAbertura: '2026-09-11', comEvidencia: true, pct: 6, potencial: 'estavel' },
  { colaboradorKey: 'col-bet-07', tipo: 'transferencia_localidade', status: 'em_andamento', etapaReferencia: 'rh_central', dataAbertura: '2026-08-30', comEvidencia: false },
  { colaboradorKey: 'col-gru-04', tipo: 'alteracao_mao_de_obra', status: 'aprovada', etapaReferencia: 'concluida', dataAbertura: '2026-08-20', comEvidencia: false, comArquivosGerados: false },
  { colaboradorKey: 'col-joi-03', tipo: 'alteracao_area_atuacao', status: 'devolvida', etapaReferencia: 'rh_local', dataAbertura: '2026-09-05', comEvidencia: false, comentario: 'Área de atuação proposta não possui centro de custo compatível na planta atual. Reavaliar com o RH Local antes de reenviar.' },
]

function justificativaPadrao(tipo: TipoMovimentacao, nome: string): string {
  switch (tipo) {
    case 'mudanca_gestor':
      return `Reorganização da linha de reporte de ${nome} conforme ajuste de estrutura da unidade, com alinhamento prévio entre as partes envolvidas.`
    case 'alteracao_cargo':
      return `Atualização do cargo de ${nome} para refletir as atribuições atualmente exercidas, validada em conjunto com a liderança da área.`
    case 'alteracao_salarial':
      return `Ajuste salarial de ${nome} em linha com a política de mercado da posição e o orçamento aprovado para a unidade.`
    case 'promocao':
      return `Promoção de ${nome} em reconhecimento à performance e à ampliação de responsabilidades no período avaliado.`
    case 'enquadramento':
      return `Alteração do enquadramento de folha e jornada de ${nome}, adequando o regime de trabalho à nova rotina da função.`
    case 'transferencia_cc':
      return `Transferência de centro de custo de ${nome} em função de realocação orçamentária entre áreas da planta.`
    case 'merito':
      return `Reconhecimento de mérito para ${nome} com base na avaliação de desempenho do período e no orçamento de mérito da unidade.`
    case 'transferencia_localidade':
      return `Transferência de localidade de ${nome} para atender à necessidade operacional da unidade de destino, com aceite prévio do colaborador.`
    case 'alteracao_mao_de_obra':
      return `Reclassificação do tipo de mão de obra de ${nome} para refletir a natureza atual das atividades exercidas.`
    case 'alteracao_area_atuacao':
      return `Alteração da área de atuação de ${nome} conforme redesenho de responsabilidades da unidade.`
  }
}

function tipoDocumentoPara(tipo: TipoMovimentacao): TipoDocumento {
  if (tipo === 'promocao' || tipo === 'alteracao_cargo') return 'carta_promocao'
  if (tipo === 'merito') return 'carta_merito'
  if (tipo === 'transferencia_cc') return 'e_req'
  return 'evidencia'
}

function nomeArquivoEvidencia(tipo: TipoMovimentacao, nome: string): string {
  const base = nome.split(' ')[0]!.toLowerCase()
  const prefixo: Record<TipoMovimentacao, string> = {
    promocao: 'carta-promocao',
    alteracao_cargo: 'carta-promocao',
    transferencia_cc: 'e-req',
    alteracao_salarial: 'memo-salarial',
    enquadramento: 'termo-enquadramento',
    mudanca_gestor: 'evidencia',
    merito: 'carta-merito',
    transferencia_localidade: 'termo-transferencia',
    alteracao_mao_de_obra: 'termo-mao-de-obra',
    alteracao_area_atuacao: 'termo-area-atuacao',
  }
  return `${prefixo[tipo]}-${base}.pdf`
}

function gerarMovimentacoes(colaboradores: SColaborador[]): SMovimentacao[] {
  const porKey = new Map(colaboradores.map((c) => [c.key, c]))
  const idDe = new Map(colaboradores.map((c) => [c.key, c.key])) // ids "de mentira": as próprias chaves
  const cargoPorKey = new Map(cargos.map((c) => [c.key, c]))
  const ccPorKey = new Map(centrosCusto.map((c) => [c.key, c]))
  const proximoCargo = (areaKey: string, cargoKey: string) => {
    const daArea = cargos.filter((c) => c.areaKey === areaKey).sort((a, b) => a.salarioMin - b.salarioMin)
    const idx = daArea.findIndex((c) => c.key === cargoKey)
    return idx === -1 || idx === daArea.length - 1 ? cargoKey : daArea[idx + 1]!.key
  }
  const outroGestor = (c: SColaborador) =>
    (
      colaboradores.find((x) => x.isGestor && x.status === 'ativo' && x.plantaKey === c.plantaKey && x.key !== c.key && x.key !== c.gestorKey) ??
      colaboradores.find((x) => x.isGestor && x.key !== c.key)!
    ).key
  const outroCC = (c: SColaborador) => centrosCusto.find((cc) => cc.plantaKey === c.plantaKey && cc.key !== c.centroCustoKey)!.key
  const outraPlanta = (c: SColaborador) => plantas.find((p) => p.key !== c.plantaKey)!.key
  const ccDaPlanta = (plantaKey: string) => centrosCusto.find((cc) => cc.plantaKey === plantaKey)!.key
  const gestorDaPlanta = (plantaKey: string) => colaboradores.find((x) => x.isGestor && x.status === 'ativo' && x.plantaKey === plantaKey)?.key ?? null
  const outraArea = (c: SColaborador) => areas.find((a) => a.key !== c.areaKey)!.key

  return CENARIOS.map((cenario): SMovimentacao => {
    const c = porKey.get(cenario.colaboradorKey)!
    const proposta = ((): Parameters<typeof montarAlteracao>[0] => {
      switch (cenario.tipo) {
        case 'mudanca_gestor':
          return { tipo: 'mudanca_gestor', gestorPropostoId: outroGestor(c) }
        case 'alteracao_cargo':
          return { tipo: 'alteracao_cargo', cargoPropostoId: proximoCargo(c.areaKey, c.cargoKey) }
        case 'alteracao_salarial':
          return { tipo: 'alteracao_salarial', salarioProposto: arredondar50(c.salario * (1 + (cenario.pct ?? 10) / 100)) }
        case 'promocao':
          return { tipo: 'promocao', cargoPropostoId: proximoCargo(c.areaKey, c.cargoKey), salarioProposto: arredondar50(c.salario * (1 + (cenario.pct ?? 12) / 100)) }
        case 'enquadramento':
          return { tipo: 'enquadramento', folhaPropostaId: 'folha-mensalista', horarioPropostoId: 'horario-adm' }
        case 'transferencia_cc':
          return { tipo: 'transferencia_cc', centroCustoPropostoId: outroCC(c) }
        case 'merito':
          return { tipo: 'merito', salarioProposto: arredondar50(c.salario * (1 + (cenario.pct ?? 5) / 100)) }
        case 'transferencia_localidade': {
          const plantaDestino = outraPlanta(c)
          return { tipo: 'transferencia_localidade', plantaPropostaId: plantaDestino, centroCustoPropostoId: ccDaPlanta(plantaDestino), gestorPropostoId: gestorDaPlanta(plantaDestino) }
        }
        case 'alteracao_mao_de_obra':
          return { tipo: 'alteracao_mao_de_obra', tipoMaoDeObraProposto: c.tipoMaoDeObra === 'direta' ? 'indireta' : 'direta' }
        case 'alteracao_area_atuacao':
          return { tipo: 'alteracao_area_atuacao', areaPropostaId: outraArea(c) }
      }
    })()
    const ctxColab: ColaboradorCtx = {
      id: c.key, nome: c.nome, status: c.status, plantaId: c.plantaKey, cargoId: c.cargoKey, areaId: c.areaKey, centroCustoId: c.centroCustoKey,
      folhaId: c.folhaKey, horarioId: c.horarioKey, gestorId: c.gestorKey, salario: c.salario, tipoMaoDeObra: c.tipoMaoDeObra,
    }
    const alteracao = montarAlteracao(proposta, ctxColab)
    const justificativa = justificativaPadrao(cenario.tipo, c.nome)
    const vigencia = addDays(cenario.dataAbertura, 35)
    const gestor = c.gestorKey ? porKey.get(c.gestorKey) : undefined
    const solicitanteNome = cenario.solicitantePersonalizado ?? gestor?.nome ?? 'RH Local'
    const planta = plantas.find((p) => p.key === c.plantaKey)!

    const toCargoCtx = (key: string | null): CargoCtx | null => {
      const carg = key ? cargoPorKey.get(key) : undefined
      return carg ? { id: carg.key, salarioMin: carg.salarioMin, salarioMax: carg.salarioMax, plantasPermitidas: carg.plantas } : null
    }
    const refs = alteracao
    const gestorProposto =
      refs.tipo === 'mudanca_gestor' ? porKey.get(refs.gestorPropostoId)
      : refs.tipo === 'transferencia_localidade' && refs.gestorPropostoId ? porKey.get(refs.gestorPropostoId)
      : undefined
    const ccProposto =
      refs.tipo === 'transferencia_cc' ? ccPorKey.get(refs.centroCustoPropostoId)
      : refs.tipo === 'transferencia_localidade' ? ccPorKey.get(refs.centroCustoPropostoId)
      : undefined
    const { checagens } = avaliarMovimentacao(cenario.tipo, alteracao, vigencia, justificativa, {
      colaborador: ctxColab,
      gestorProposto: gestorProposto ? { id: gestorProposto.key, status: gestorProposto.status, isGestor: gestorProposto.isGestor } : null,
      cargoProposto: toCargoCtx(refs.tipo === 'alteracao_cargo' || refs.tipo === 'promocao' ? refs.cargoPropostoId : null),
      cargoAtual: toCargoCtx(c.cargoKey),
      centroCustoProposto: ccProposto ? { id: ccProposto.key, plantaId: ccProposto.plantaKey } : null,
      folhaPropostaExiste: refs.tipo === 'enquadramento',
      horarioPropostoExiste: refs.tipo === 'enquadramento',
      plantaPropostaExiste: refs.tipo === 'transferencia_localidade',
      areaPropostaExiste: refs.tipo === 'alteracao_area_atuacao',
      temEvidencia: cenario.comEvidencia,
    })

    const documentos: SDocumento[] = cenario.comEvidencia
      ? [
          {
            nome: nomeArquivoEvidencia(cenario.tipo, c.nome),
            tipo: tipoDocumentoPara(cenario.tipo),
            tamanhoBytes: 180_000 + (((CENARIOS.indexOf(cenario) + 1) * 37_000) % 900_000),
            autorKey: idDe.get(gestor?.key ?? c.key)!,
            criadoEm: brt(`${cenario.dataAbertura}T09:15:00`),
          },
        ]
      : []

    const aprovador = (etapa: Exclude<EtapaMovimentacao, 'concluida'>) =>
      nomeAprovador(etapa, gestor?.nome ?? null, planta.nome)
    const perfilDaEtapa = (i: number): PerfilDemo => (i === 0 ? 'gestor' : i === 1 ? 'rh_local' : 'rh_central')
    const decisoes: SDecisao[] = []
    const idxRef = cenario.etapaReferencia === 'concluida' ? 3 : ETAPAS_ORDEM.indexOf(cenario.etapaReferencia as (typeof ETAPAS_ORDEM)[number])
    let cursor = cenario.dataAbertura
    const aprovar = (i: number) => {
      cursor = addDays(cursor, 2)
      decisoes.push({ etapa: ETAPAS_ORDEM[i]!, perfil: perfilDaEtapa(i), nome: aprovador(ETAPAS_ORDEM[i]!), decisao: 'aprovado', data: brt(`${cursor}T${10 + i}:30:00`) })
    }
    if (cenario.status === 'em_andamento') {
      for (let i = 0; i < idxRef; i++) aprovar(i)
    } else if (cenario.status === 'devolvida' || cenario.status === 'reprovada') {
      for (let i = 0; i < idxRef; i++) aprovar(i)
      cursor = addDays(cursor, 2)
      decisoes.push({
        etapa: ETAPAS_ORDEM[idxRef]!,
        perfil: perfilDaEtapa(idxRef),
        nome: aprovador(ETAPAS_ORDEM[idxRef]!),
        decisao: cenario.status === 'devolvida' ? 'devolvido' : 'reprovado',
        comentario: cenario.comentario,
        data: brt(`${cursor}T${10 + idxRef}:45:00`),
      })
    } else if (cenario.status === 'aprovada') {
      for (let i = 0; i < 3; i++) aprovar(i)
    }

    const etapaAtual: EtapaMovimentacao =
      cenario.status === 'aprovada' ? 'concluida'
      : cenario.status === 'devolvida' || cenario.status === 'rascunho' ? 'gestor'
      : cenario.status === 'reprovada' ? ETAPAS_ORDEM[idxRef]!
      : cenario.etapaReferencia

    let apdataGeradoEm: string | undefined
    let employeeCentralGeradoEm: string | undefined
    if (cenario.comArquivosGerados) {
      const dia = addDays(cursor, 1)
      apdataGeradoEm = brt(`${dia}T14:00:00`)
      employeeCentralGeradoEm = brt(`${dia}T14:05:00`)
    }

    const eventos: SEvento[] = [{ tipo: 'abertura', data: brt(`${cenario.dataAbertura}T08:30:00`), autor: solicitanteNome, descricao: `Solicitação aberta por ${solicitanteNome}.` }]
    if (documentos.length > 0) eventos.push({ tipo: 'anexo', data: brt(`${cenario.dataAbertura}T09:15:00`), autor: solicitanteNome, descricao: 'Evidência anexada à solicitação.' })
    if (cenario.status !== 'rascunho') eventos.push({ tipo: 'validacao', data: brt(`${cenario.dataAbertura}T09:20:00`), autor: 'Sistema', descricao: 'Checagens automáticas de regras executadas.' })
    for (const d of decisoes) {
      const rotulo = d.etapa === 'gestor' ? 'Gestor' : d.etapa === 'rh_local' ? 'RH Local' : 'RH Central'
      const acao = d.decisao === 'aprovado' ? 'aprovou' : d.decisao === 'devolvido' ? 'devolveu' : 'reprovou'
      eventos.push({
        tipo: d.decisao === 'aprovado' ? 'aprovacao' : d.decisao === 'devolvido' ? 'devolucao' : 'reprovacao',
        data: d.data, autor: d.nome, descricao: `${rotulo} ${acao} a solicitação.`, comentario: d.comentario,
      })
    }
    if (cenario.status === 'aprovada') eventos.push({ tipo: 'conclusao', data: decisoes[decisoes.length - 1]!.data, autor: 'Sistema', descricao: 'Solicitação aprovada — pronta para processamento.' })
    if (apdataGeradoEm) eventos.push({ tipo: 'geracao_arquivo', data: apdataGeradoEm, autor: 'RH Central — Sede Corporativa', descricao: 'Carga demonstrativa para Apdata gerada.' })
    if (employeeCentralGeradoEm) eventos.push({ tipo: 'geracao_arquivo', data: employeeCentralGeradoEm, autor: 'RH Central — Sede Corporativa', descricao: 'Arquivo demonstrativo para Employee Central gerado.' })

    return {
      colaboradorKey: c.key, plantaKey: c.plantaKey, tipo: cenario.tipo, solicitanteNome, dataAbertura: cenario.dataAbertura, vigencia,
      etapaAtual, status: cenario.status, alteracao, justificativa, checagens, decisoes, documentos, eventos,
      potencial: cenario.potencial, apdataGeradoEm, employeeCentralGeradoEm,
    }
  })
}

// ---------- Fontes (snapshots), divergências e usuários ----------

const CASO_CENTRAL_DIVERGENCIA = 'col-gru-10'

function gerarFontes(colaboradores: SColaborador[], divergencias: SDivergencia[]): SFonte[] {
  const porKey = new Map(colaboradores.map((c) => [c.key, c]))
  const cargoNome = (k: string) => cargos.find((c) => c.key === k)!.nome
  const areaNome = (k: string) => areas.find((a) => a.key === k)!.nome
  const ccRotulo = (k: string) => {
    const cc = centrosCusto.find((c) => c.key === k)!
    return `${cc.codigo} · ${cc.nome}`
  }
  const fontes: SFonte[] = []
  for (const c of colaboradores) {
    const canonico = {
      gestor: c.gestorKey ? porKey.get(c.gestorKey)!.nome : 'Sem gestor',
      cargo: cargoNome(c.cargoKey),
      centroCusto: ccRotulo(c.centroCustoKey),
      area: areaNome(c.areaKey),
    }
    const campo = (nomeCampo: CampoDivergente) => (nomeCampo === 'centro_custo' ? 'centroCusto' : nomeCampo) as keyof typeof canonico
    const apdata = { ...canonico }
    const ec = { ...canonico }
    // Divergências ainda não resolvidas correspondem a snapshots diferentes entre os sistemas.
    for (const d of divergencias.filter((x) => x.colaboradorKey === c.key && x.status !== 'resolvida')) {
      apdata[campo(d.campo)] = d.valorApdata
      ec[campo(d.campo)] = d.valorEmployeeCentral
    }
    fontes.push({ colaboradorKey: c.key, fonte: 'apdata', ...apdata }, { colaboradorKey: c.key, fonte: 'employee_central', ...ec })
  }
  return fontes
}

function gerarDivergencias(colaboradores: SColaborador[]): SDivergencia[] {
  const diretor = colaboradores.find((c) => c.cargoKey === 'cargo-diretor-industrial')?.nome ?? 'Diretor Industrial'
  const cio = colaboradores.find((c) => c.cargoKey === 'cargo-cio')?.nome ?? 'CIO'
  const responsavel = 'col-cor-04'
  return [
    { colaboradorKey: 'col-gru-01', campo: 'gestor', valorApdata: 'Diretoria Industrial (legado)', valorEmployeeCentral: `Diretor Industrial — ${diretor}`, status: 'resolvida', responsavelKey: responsavel, detectadaEm: brt('2026-09-10T07:40:00'), resolvidaEm: brt('2026-09-12T16:20:00'), justificativaResolucao: 'Apdata atualizado manualmente após confirmação do RH Central; vínculo de gestor corrigido para refletir o organograma vigente.' },
    { colaboradorKey: CASO_CENTRAL_DIVERGENCIA, campo: 'cargo', valorApdata: 'Analista de Qualidade Sênior', valorEmployeeCentral: 'Coordenador de Qualidade', status: 'aberta', responsavelKey: null, detectadaEm: brt('2026-09-18T07:45:00') },
    { colaboradorKey: 'col-joi-07', campo: 'area', valorApdata: 'Produção', valorEmployeeCentral: 'Manutenção', status: 'aberta', responsavelKey: null, detectadaEm: brt('2026-09-18T07:45:00') },
    { colaboradorKey: 'col-bet-04', campo: 'centro_custo', valorApdata: 'BET-1010 · CC Produção', valorEmployeeCentral: 'BET-1020 · CC Manutenção', status: 'resolvida', responsavelKey: responsavel, detectadaEm: brt('2026-09-05T07:40:00'), resolvidaEm: brt('2026-09-08T11:10:00'), justificativaResolucao: 'Confirmado com a liderança de planta: colaborador atua em Manutenção desde julho. Employee Central estava correto; Apdata corrigido.' },
    { colaboradorKey: 'col-cor-01', campo: 'gestor', valorApdata: 'Conselho Corporativo (legado)', valorEmployeeCentral: `CIO — ${cio}`, status: 'em_tratamento', responsavelKey: responsavel, detectadaEm: brt('2026-09-16T07:40:00') },
  ]
}

function gerarUsuarios(colaboradores: SColaborador[]): SUsuario[] {
  const gestores: SUsuario[] = colaboradores.filter((c) => c.isGestor).map((c) =>
    ({ subject: `demo.gestor.${c.key}`, nome: c.nome, email: c.email, perfil: 'gestor', plantaKey: c.plantaKey, colaboradorKey: c.key }))
  const rhLocal: SUsuario[] = plantas.map((p) => ({
    subject: `demo.rh-local.${p.codigo.toLowerCase()}`,
    nome: `RH Local — ${p.nome}`,
    email: `rh.local.${p.codigo.toLowerCase()}@nexopeople.demo.br`,
    perfil: 'rh_local',
    plantaKey: p.key,
    colaboradorKey: null,
  }))
  return [
    ...gestores,
    ...rhLocal,
    { subject: 'demo.rh-central', nome: 'RH Central — Sede Corporativa', email: 'rh.central@nexopeople.demo.br', perfil: 'rh_central', plantaKey: null, colaboradorKey: null },
    { subject: 'demo.auditoria', nome: 'Auditoria', email: 'auditoria@nexopeople.demo.br', perfil: 'auditoria', plantaKey: null, colaboradorKey: null },
    { subject: 'demo.share', nome: 'Share — Fechamento da Folha', email: 'share@nexopeople.demo.br', perfil: 'share', plantaKey: null, colaboradorKey: null },
  ]
}

export interface DadosDemo {
  plantas: SPlanta[]
  areas: SArea[]
  cargos: SCargo[]
  centrosCusto: SCentroCusto[]
  horarios: SHorario[]
  folhas: SFolha[]
  colaboradores: SColaborador[]
  usuarios: SUsuario[]
  fontes: SFonte[]
  movimentacoes: SMovimentacao[]
  divergencias: SDivergencia[]
  /** Última conferência simulada do seed: 4 campos × colaboradores, em 18/09 às 07:45 (BRT). */
  conferenciaExecutadaEm: string
}

export function construirDadosDemo(): DadosDemo {
  const colaboradores = gerarColaboradores()
  const divergencias = gerarDivergencias(colaboradores)
  return {
    plantas,
    areas,
    cargos,
    centrosCusto,
    horarios,
    folhas,
    colaboradores,
    usuarios: gerarUsuarios(colaboradores),
    fontes: gerarFontes(colaboradores, divergencias),
    movimentacoes: gerarMovimentacoes(colaboradores),
    divergencias,
    conferenciaExecutadaEm: brt('2026-09-18T07:45:00'),
  }
}
