// Arquivos DEMONSTRATIVOS de saída (Apdata e Employee Central) — formato NÃO homologado.
// O layout oficial da transação Apdata 19092 e o canal/formato do Employee Central não foram fornecidos.
import { createHash } from 'node:crypto'
import type pg from 'pg'
import { withTransaction, type Queryable } from '../db/pool.ts'
import { exigirPerfil, temAcessoAPlanta, type UsuarioAutenticado } from '../auth.ts'
import { conflito, naoEncontrado, regraDeNegocio } from '../errors.ts'
import { vigenciaNoMesTravado } from '../domain/folha.ts'
import type { DetalheAlteracao, TipoMovimentacao } from '../types.ts'

export type TipoExportacao = 'apdata' | 'employee_central'

const TZ = 'America/Sao_Paulo'
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const dataHoraBr = (d: Date) =>
  `${d.toLocaleDateString('pt-BR', { timeZone: TZ })} às ${d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}`

export const ROTULO_TIPO: Record<TipoMovimentacao, string> = {
  mudanca_gestor: 'Mudança de gestor',
  alteracao_cargo: 'Alteração de cargo',
  alteracao_salarial: 'Alteração salarial',
  promocao: 'Promoção',
  enquadramento: 'Enquadramento',
  transferencia_cc: 'Transferência de centro de custo',
  merito: 'Mérito',
  transferencia_localidade: 'Transferência de localidade',
  alteracao_mao_de_obra: 'Alteração de mão de obra',
  alteracao_area_atuacao: 'Alteração de área de atuação',
}

const ROTULO_MAO_DE_OBRA: Record<'direta' | 'indireta', string> = { direta: 'Mão de obra direta', indireta: 'Mão de obra indireta' }

interface CampoComparado {
  label: string
  antes: string
  depois: string
}

async function nome(q: Queryable, tabela: 'colaboradores' | 'cargos' | 'centros_custo' | 'folhas' | 'horarios' | 'plantas' | 'areas', id: string | null) {
  if (!id || !/^\d{1,18}$/.test(id)) return null
  const { rows } = await q.query(`select nome from ${tabela} where id = $1`, [id])
  return (rows[0]?.nome as string | undefined) ?? null
}

async function compararAlteracao(q: Queryable, a: DetalheAlteracao): Promise<CampoComparado[]> {
  switch (a.tipo) {
    case 'mudanca_gestor':
      return [
        {
          label: 'Gestor',
          antes: (await nome(q, 'colaboradores', a.gestorAtualId)) ?? 'Sem gestor definido',
          depois: (await nome(q, 'colaboradores', a.gestorPropostoId)) ?? '—',
        },
      ]
    case 'alteracao_cargo':
      return [
        {
          label: 'Cargo',
          antes: (await nome(q, 'cargos', a.cargoAtualId)) ?? '—',
          depois: (await nome(q, 'cargos', a.cargoPropostoId)) ?? '—',
        },
      ]
    case 'alteracao_salarial':
      return [{ label: 'Salário', antes: moeda(a.salarioAtual), depois: moeda(a.salarioProposto) }]
    case 'promocao':
      return [
        {
          label: 'Cargo',
          antes: (await nome(q, 'cargos', a.cargoAtualId)) ?? '—',
          depois: (await nome(q, 'cargos', a.cargoPropostoId)) ?? '—',
        },
        { label: 'Salário', antes: moeda(a.salarioAtual), depois: moeda(a.salarioProposto) },
      ]
    case 'enquadramento':
      return [
        {
          label: 'Folha',
          antes: (await nome(q, 'folhas', a.folhaAtualId)) ?? '—',
          depois: (await nome(q, 'folhas', a.folhaPropostaId)) ?? '—',
        },
        {
          label: 'Horário',
          antes: (await nome(q, 'horarios', a.horarioAtualId)) ?? '—',
          depois: (await nome(q, 'horarios', a.horarioPropostoId)) ?? '—',
        },
      ]
    case 'transferencia_cc': {
      const campos: CampoComparado[] = [
        {
          label: 'Centro de custo',
          antes: (await nome(q, 'centros_custo', a.centroCustoAtualId)) ?? '—',
          depois: (await nome(q, 'centros_custo', a.centroCustoPropostoId)) ?? '—',
        },
      ]
      if (a.plantaAtualId !== a.plantaPropostaId) {
        campos.push({
          label: 'Planta',
          antes: (await nome(q, 'plantas', a.plantaAtualId)) ?? '—',
          depois: (await nome(q, 'plantas', a.plantaPropostaId)) ?? '—',
        })
      }
      return campos
    }
    case 'merito':
      return [{ label: 'Salário', antes: moeda(a.salarioAtual), depois: moeda(a.salarioProposto) }]
    case 'transferencia_localidade': {
      const campos: CampoComparado[] = [
        {
          label: 'Localidade',
          antes: (await nome(q, 'plantas', a.plantaAtualId)) ?? '—',
          depois: (await nome(q, 'plantas', a.plantaPropostaId)) ?? '—',
        },
        {
          label: 'Centro de custo',
          antes: (await nome(q, 'centros_custo', a.centroCustoAtualId)) ?? '—',
          depois: (await nome(q, 'centros_custo', a.centroCustoPropostoId)) ?? '—',
        },
      ]
      if (a.gestorPropostoId && a.gestorPropostoId !== a.gestorAtualId) {
        campos.push({
          label: 'Gestor',
          antes: (await nome(q, 'colaboradores', a.gestorAtualId)) ?? 'Sem gestor definido',
          depois: (await nome(q, 'colaboradores', a.gestorPropostoId)) ?? '—',
        })
      }
      return campos
    }
    case 'alteracao_mao_de_obra':
      return [
        {
          label: 'Tipo de mão de obra',
          antes: a.tipoMaoDeObraAtual ? ROTULO_MAO_DE_OBRA[a.tipoMaoDeObraAtual] : 'Não definido',
          depois: ROTULO_MAO_DE_OBRA[a.tipoMaoDeObraProposto],
        },
      ]
    case 'alteracao_area_atuacao':
      return [
        {
          label: 'Área de atuação',
          antes: (await nome(q, 'areas', a.areaAtualId)) ?? '—',
          depois: (await nome(q, 'areas', a.areaPropostaId)) ?? '—',
        },
      ]
  }
}

interface DadosExportacao {
  protocolo: string
  tipo: TipoMovimentacao
  vigencia: string
  justificativa: string
  plantaNome: string
  colaborador: { matricula: string; nome: string; apdataId: string; employeeCentralId: string }
  campos: CampoComparado[]
  geradoEm: Date
}

export function montarConteudoApdata(d: DadosExportacao): string {
  const resumo = {
    campo: d.campos.map((c) => c.label).join(' + '),
    antes: d.campos.map((c) => c.antes).join(' | '),
    depois: d.campos.map((c) => c.depois).join(' | '),
  }
  return [
    'AMBIENTE;DEMONSTRACAO — Nexo People',
    'FORMATO;DEMONSTRATIVO — nao homologado (layout oficial da transacao Apdata 19092 nao fornecido)',
    'GERADO_EM;' + dataHoraBr(d.geradoEm),
    '',
    'Protocolo;Matricula;Colaborador;ApdataId;Planta;TipoMovimentacao;CampoAlterado;ValorAnterior;ValorNovo;Vigencia;Justificativa',
    [
      d.protocolo,
      d.colaborador.matricula,
      d.colaborador.nome,
      d.colaborador.apdataId,
      d.plantaNome,
      ROTULO_TIPO[d.tipo],
      resumo.campo,
      resumo.antes,
      resumo.depois,
      dataBr(d.vigencia),
      d.justificativa.replace(/[;\r\n]+/g, ','),
    ].join(';'),
  ].join('\n')
}

export function montarConteudoEmployeeCentral(d: DadosExportacao): string {
  return JSON.stringify(
    {
      ambiente: 'DEMONSTRACAO',
      formato: 'DEMONSTRATIVO_NAO_HOMOLOGADO',
      observacao: 'Arquivo demonstrativo — não representa integração ativa com o Employee Central.',
      geradoEm: d.geradoEm.toISOString(),
      protocolo: d.protocolo,
      colaborador: {
        employeeCentralId: d.colaborador.employeeCentralId,
        matricula: d.colaborador.matricula,
        nome: d.colaborador.nome,
        planta: d.plantaNome,
      },
      movimentacao: {
        tipo: ROTULO_TIPO[d.tipo],
        campoAlterado: d.campos.map((c) => c.label).join(' + '),
        valorAnterior: d.campos.map((c) => c.antes).join(' | '),
        valorNovo: d.campos.map((c) => c.depois).join(' | '),
        vigencia: d.vigencia,
        justificativa: d.justificativa,
      },
    },
    null,
    2,
  )
}

export interface ArquivoGerado {
  nome: string
  mime: string
  conteudo: Buffer
  sha256: string
  geradoEm: Date
  movimentacaoId: string
  protocolo: string
}

/** Somente movimentações aprovadas geram arquivos; cada geração é auditada (hash, autor, evento). */
export async function gerarExportacao(
  pool: pg.Pool,
  usuario: UsuarioAutenticado,
  movId: string,
  tipo: TipoExportacao,
): Promise<ArquivoGerado> {
  exigirPerfil(usuario, 'rh_central')
  if (!/^\d{1,18}$/.test(movId)) throw naoEncontrado('Movimentação não encontrada.')
  return withTransaction(pool, async (client) => {
    const { rows } = await client.query(
      `select m.id, m.protocolo, m.tipo, m.vigencia, m.justificativa, m.alteracao, m.status, m.planta_id, m.rh_liberada_folha_em,
              p.nome as planta_nome, c.matricula, c.nome as colaborador_nome, c.apdata_id, c.employee_central_id
         from movimentacoes m
         join colaboradores c on c.id = m.colaborador_id
         join plantas p on p.id = m.planta_id
        where m.id = $1 for update of m`,
      [movId],
    )
    const m = rows[0]
    if (!m || !temAcessoAPlanta(usuario, m.planta_id)) throw naoEncontrado('Movimentação não encontrada.')
    if (m.status !== 'aprovada') {
      throw conflito('Somente movimentações aprovadas podem gerar arquivos.', 'MOVIMENTACAO_NAO_APROVADA')
    }
    if (!m.rh_liberada_folha_em) {
      throw conflito('A movimentação ainda não foi liberada pelo RH para entrada na Folha.', 'NAO_LIBERADA_PARA_FOLHA')
    }
    const { rows: folhaRows } = await client.query<{ mes_travado: string | null }>('select mes_travado from folha_fechamento where id = 1')
    if (vigenciaNoMesTravado(m.vigencia, folhaRows[0]?.mes_travado ?? null)) {
      throw regraDeNegocio('FOLHA_FECHADA', 'O mês de vigência desta movimentação está com a folha travada pelo Share.')
    }
    const geradoEm = new Date()
    const dados: DadosExportacao = {
      protocolo: m.protocolo,
      tipo: m.tipo,
      vigencia: m.vigencia ?? '',
      justificativa: m.justificativa,
      plantaNome: m.planta_nome,
      colaborador: { matricula: m.matricula, nome: m.colaborador_nome, apdataId: m.apdata_id, employeeCentralId: m.employee_central_id },
      campos: await compararAlteracao(client, m.alteracao),
      geradoEm,
    }
    const apdata = tipo === 'apdata'
    const texto = apdata ? montarConteudoApdata(dados) : montarConteudoEmployeeCentral(dados)
    const conteudo = Buffer.from(texto, 'utf8')
    const nomeArquivo = apdata ? `apdata-demo-${m.protocolo}.csv` : `employee-central-demo-${m.protocolo}.json`
    const mime = apdata ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8'
    const sha256 = createHash('sha256').update(conteudo).digest('hex')

    await client.query(
      `insert into exports (movimentacao_id, tipo, nome_arquivo, mime, tamanho_bytes, sha256, autor_id, autor_nome, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [m.id, tipo, nomeArquivo, mime, conteudo.length, sha256, usuario.id, usuario.nome, geradoEm],
    )
    await client.query(
      apdata
        ? `update movimentacoes set apdata_gerado_em = $2, updated_at = now() where id = $1`
        : `update movimentacoes set employee_central_gerado_em = $2, updated_at = now() where id = $1`,
      [m.id, geradoEm],
    )
    await client.query(
      `insert into movimentacao_eventos (movimentacao_id, tipo, data, autor, autor_id, descricao)
       values ($1, 'geracao_arquivo', $2, $3, $4, $5)`,
      [
        m.id,
        geradoEm,
        usuario.nome,
        usuario.id,
        apdata
          ? 'Carga demonstrativa para Apdata gerada e baixada.'
          : 'Arquivo demonstrativo para Employee Central gerado e baixado.',
      ],
    )
    return { nome: nomeArquivo, mime, conteudo, sha256, geradoEm, movimentacaoId: m.id, protocolo: m.protocolo }
  })
}
