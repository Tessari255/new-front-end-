import type pg from 'pg'
import { loadConfig } from '../config.ts'
import { createPool, withTransaction, type Queryable } from './pool.ts'
import { construirDadosDemo } from './seedData.ts'
import type { DetalheAlteracao } from '../types.ts'

/** Insere se não existir (pela chave única) e devolve o id; nunca sobrescreve dados existentes. */
async function garantir(q: Queryable, tabela: string, colunaUnica: string, valores: Record<string, unknown>): Promise<string> {
  const colunas = Object.keys(valores)
  const params = Object.values(valores)
  const placeholders = colunas.map((_, i) => `$${i + 1}`).join(', ')
  const posUnica = colunas.indexOf(colunaUnica) + 1
  const { rows } = await q.query(
    `with ins as (
       insert into ${tabela} (${colunas.join(', ')}) values (${placeholders})
       on conflict (${colunaUnica}) do nothing returning id
     )
     select id from ins union all select id from ${tabela} where ${colunaUnica} = $${posUnica} limit 1`,
    params,
  )
  return rows[0].id as string
}

async function vazia(q: Queryable, tabela: string): Promise<boolean> {
  const { rows } = await q.query(`select not exists (select 1 from ${tabela}) as vazia`)
  return rows[0].vazia as boolean
}

export interface ResumoSeed {
  colaboradores: number
  movimentacoes: number
  divergencias: number
}

export async function semearDemo(pool: pg.Pool): Promise<ResumoSeed> {
  const d = construirDadosDemo()
  return withTransaction(pool, async (q) => {
    const plantaId = new Map<string, string>()
    const areaId = new Map<string, string>()
    const cargoId = new Map<string, string>()
    const ccId = new Map<string, string>()
    const horarioId = new Map<string, string>()
    const folhaId = new Map<string, string>()
    const colabId = new Map<string, string>()

    for (const p of d.plantas) {
      plantaId.set(p.key, await garantir(q, 'plantas', 'codigo', { codigo: p.codigo, nome: p.nome, cidade: p.cidade, estado: p.estado }))
    }
    for (const a of d.areas) areaId.set(a.key, await garantir(q, 'areas', 'nome', { nome: a.nome }))
    for (const c of d.cargos) {
      const id = await garantir(q, 'cargos', 'nome', {
        nome: c.nome, nivel: c.nivel, area_id: areaId.get(c.areaKey), salario_min: c.salarioMin, salario_max: c.salarioMax,
      })
      cargoId.set(c.key, id)
      for (const pk of c.plantas) {
        await q.query(`insert into cargo_plantas (cargo_id, planta_id) values ($1, $2) on conflict do nothing`, [id, plantaId.get(pk)])
      }
    }
    for (const c of d.centrosCusto) {
      ccId.set(c.key, await garantir(q, 'centros_custo', 'codigo', { codigo: c.codigo, nome: c.nome, planta_id: plantaId.get(c.plantaKey) }))
    }
    for (const h of d.horarios) {
      horarioId.set(h.key, await garantir(q, 'horarios', 'nome', { nome: h.nome, turno: h.turno, carga_horaria_semanal: h.carga }))
    }
    for (const f of d.folhas) {
      folhaId.set(f.key, await garantir(q, 'folhas', 'nome', { nome: f.nome, tipo: f.tipo, periodicidade: f.periodicidade }))
    }
    for (const c of d.colaboradores) {
      colabId.set(
        c.key,
        await garantir(q, 'colaboradores', 'matricula', {
          matricula: c.matricula, nome: c.nome, email: c.email, telefone: c.telefone, data_admissao: c.dataAdmissao, status: c.status,
          cargo_id: cargoId.get(c.cargoKey), area_id: areaId.get(c.areaKey), planta_id: plantaId.get(c.plantaKey),
          centro_custo_id: ccId.get(c.centroCustoKey), horario_id: horarioId.get(c.horarioKey), folha_id: folhaId.get(c.folhaKey),
          gestor_id: c.gestorKey ? colabId.get(c.gestorKey) : null, is_gestor: c.isGestor, salario: c.salario,
          apdata_id: c.apdataId, employee_central_id: c.employeeCentralId, status_sincronizacao: c.statusSincronizacao,
          tipo_mao_de_obra: c.tipoMaoDeObra ?? null,
        }),
      )
    }
    for (const u of d.usuarios) {
      await garantir(q, 'usuarios', 'subject', {
        subject: u.subject, nome: u.nome, email: u.email, perfil: u.perfil,
        planta_id: u.plantaKey ? plantaId.get(u.plantaKey) : null,
        colaborador_id: u.colaboradorKey ? colabId.get(u.colaboradorKey) : null,
      })
    }
    for (const f of d.fontes) {
      await q.query(
        `insert into colaborador_fontes (colaborador_id, fonte, gestor, cargo, centro_custo, area, capturado_em)
         values ($1, $2, $3, $4, $5, $6, $7) on conflict (colaborador_id, fonte) do nothing`,
        [colabId.get(f.colaboradorKey), f.fonte, f.gestor, f.cargo, f.centroCusto, f.area, d.conferenciaExecutadaEm],
      )
    }

    const traduzir = (a: DetalheAlteracao): DetalheAlteracao => {
      switch (a.tipo) {
        case 'mudanca_gestor':
          return { ...a, gestorAtualId: a.gestorAtualId ? colabId.get(a.gestorAtualId)! : null, gestorPropostoId: colabId.get(a.gestorPropostoId)! }
        case 'alteracao_cargo':
          return { ...a, cargoAtualId: cargoId.get(a.cargoAtualId)!, cargoPropostoId: cargoId.get(a.cargoPropostoId)! }
        case 'alteracao_salarial':
          return a
        case 'promocao':
          return { ...a, cargoAtualId: cargoId.get(a.cargoAtualId)!, cargoPropostoId: cargoId.get(a.cargoPropostoId)! }
        case 'enquadramento':
          return {
            ...a,
            folhaAtualId: folhaId.get(a.folhaAtualId)!, folhaPropostaId: folhaId.get(a.folhaPropostaId)!,
            horarioAtualId: horarioId.get(a.horarioAtualId)!, horarioPropostoId: horarioId.get(a.horarioPropostoId)!,
          }
        case 'transferencia_cc':
          return {
            ...a,
            centroCustoAtualId: ccId.get(a.centroCustoAtualId)!, centroCustoPropostoId: ccId.get(a.centroCustoPropostoId)!,
            plantaAtualId: plantaId.get(a.plantaAtualId)!, plantaPropostaId: plantaId.get(a.plantaPropostaId)!,
          }
        case 'merito':
          return a
        case 'transferencia_localidade':
          return {
            ...a,
            plantaAtualId: plantaId.get(a.plantaAtualId)!, plantaPropostaId: plantaId.get(a.plantaPropostaId)!,
            centroCustoAtualId: ccId.get(a.centroCustoAtualId)!, centroCustoPropostoId: ccId.get(a.centroCustoPropostoId)!,
            gestorAtualId: a.gestorAtualId ? colabId.get(a.gestorAtualId)! : null,
            gestorPropostoId: a.gestorPropostoId ? colabId.get(a.gestorPropostoId)! : null,
          }
        case 'alteracao_mao_de_obra':
          return a
        case 'alteracao_area_atuacao':
          return { ...a, areaAtualId: areaId.get(a.areaAtualId)!, areaPropostaId: areaId.get(a.areaPropostaId)! }
      }
    }

    // Dados transacionais só entram em bancos ainda vazios (nunca sobrescrevem trabalho real).
    if (await vazia(q, 'movimentacoes')) {
      for (const m of d.movimentacoes) {
        const abertura = m.eventos[0]!.data
        const { rows } = await q.query(
          `insert into movimentacoes (colaborador_id, planta_id, solicitante_nome, tipo, data_abertura, vigencia, etapa_atual, status,
                                      alteracao, justificativa, checagens, potencial, apdata_gerado_em, employee_central_gerado_em, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15) returning id`,
          [
            colabId.get(m.colaboradorKey), plantaId.get(m.plantaKey), m.solicitanteNome, m.tipo, m.dataAbertura, m.vigencia, m.etapaAtual,
            m.status, JSON.stringify(traduzir(m.alteracao)), m.justificativa, JSON.stringify(m.checagens), m.potencial ?? null,
            m.apdataGeradoEm ?? null, m.employeeCentralGeradoEm ?? null, abertura,
          ],
        )
        const movId = rows[0].id as string
        for (const dec of m.decisoes) {
          await q.query(
            `insert into movimentacao_decisoes (movimentacao_id, etapa, decisao, comentario, aprovador_perfil, aprovador_nome, data)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [movId, dec.etapa, dec.decisao, dec.comentario ?? null, dec.perfil, dec.nome, dec.data],
          )
        }
        for (const ev of m.eventos) {
          await q.query(
            `insert into movimentacao_eventos (movimentacao_id, tipo, data, autor, descricao, comentario) values ($1, $2, $3, $4, $5, $6)`,
            [movId, ev.tipo, ev.data, ev.autor, ev.descricao, ev.comentario ?? null],
          )
        }
        for (const doc of m.documentos) {
          const autor = d.colaboradores.find((c) => c.key === doc.autorKey)!
          await q.query(
            `insert into movimentacao_documentos (movimentacao_id, nome, tipo, mime, tamanho_bytes, autor_colaborador_id, autor_nome, criado_em)
             values ($1, $2, $3, 'application/pdf', $4, $5, $6, $7)`,
            [movId, doc.nome, doc.tipo, doc.tamanhoBytes, colabId.get(doc.autorKey), autor.nome, doc.criadoEm],
          )
        }
      }
    }

    if (await vazia(q, 'divergencias')) {
      for (const v of d.divergencias) {
        const colab = d.colaboradores.find((c) => c.key === v.colaboradorKey)!
        await q.query(
          `insert into divergencias (colaborador_id, planta_id, campo, valor_apdata, valor_employee_central, responsavel_id, status,
                                     detectada_em, resolvida_em, justificativa_resolucao)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            colabId.get(v.colaboradorKey), plantaId.get(colab.plantaKey), v.campo, v.valorApdata, v.valorEmployeeCentral,
            v.responsavelKey ? colabId.get(v.responsavelKey) : null, v.status, v.detectadaEm, v.resolvidaEm ?? null, v.justificativaResolucao ?? null,
          ],
        )
      }
    }

    if (await vazia(q, 'conciliacoes')) {
      await q.query(
        `insert into conciliacoes (origem, status, iniciada_em, finalizada_em, registros_comparados)
         values ('agendada', 'concluida', $1::timestamptz - interval '1 minute', $1, $2)`,
        [d.conferenciaExecutadaEm, d.colaboradores.length * 4],
      )
    }

    // Linha singleton: truncar 'usuarios' (CASCADE) também apaga esta linha por causa da FK
    // em travado_por_id — precisa ser recriada a cada reset, sempre com a folha liberada.
    await q.query(`insert into folha_fechamento (id, mes_travado) values (1, null) on conflict (id) do nothing`)

    return { colaboradores: d.colaboradores.length, movimentacoes: d.movimentacoes.length, divergencias: d.divergencias.length }
  })
}

const TABELAS_DE_NEGOCIO = [
  'logs_integracao', 'exports', 'divergencias', 'movimentacao_documentos', 'movimentacao_eventos', 'movimentacao_decisoes',
  'movimentacoes', 'conciliacoes', 'colaborador_fontes', 'usuarios', 'colaboradores', 'folhas', 'horarios', 'centros_custo',
  'cargo_plantas', 'cargos', 'areas', 'plantas', 'folha_fechamento_eventos', 'folha_fechamento',
]

/** Restaura o estado inicial da demonstração. Chamado somente com DEMO_MODE=true. */
export async function resetarDemo(pool: pg.Pool): Promise<ResumoSeed> {
  await withTransaction(pool, async (q) => {
    await q.query(`truncate table ${TABELAS_DE_NEGOCIO.join(', ')} restart identity cascade`)
  })
  return semearDemo(pool)
}

if (import.meta.main) {
  const config = loadConfig()
  if (!config.demoMode) {
    console.error('db:seed insere dados fictícios e exige DEMO_MODE=true.')
    process.exit(1)
  }
  const pool = createPool(config)
  try {
    const r = await semearDemo(pool)
    console.log(`Seed concluído: ${r.colaboradores} colaboradores, ${r.movimentacoes} movimentações, ${r.divergencias} divergências (idempotente).`)
  } finally {
    await pool.end()
  }
}
