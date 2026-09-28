-- Up Migration

create table plantas (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  nome text not null,
  cidade text not null,
  estado text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table areas (
  id bigint generated always as identity primary key,
  nome text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cargos (
  id bigint generated always as identity primary key,
  nome text not null unique,
  nivel text not null check (nivel in ('Operacional', 'Técnico', 'Coordenação', 'Gerência', 'Diretoria')),
  area_id bigint not null references areas (id),
  salario_min numeric(14,2) not null check (salario_min > 0),
  salario_max numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salario_max >= salario_min)
);
create index cargos_area_id_idx on cargos (area_id);

create table cargo_plantas (
  cargo_id bigint not null references cargos (id),
  planta_id bigint not null references plantas (id),
  primary key (cargo_id, planta_id)
);
create index cargo_plantas_planta_id_idx on cargo_plantas (planta_id);

create table centros_custo (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  nome text not null,
  planta_id bigint not null references plantas (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index centros_custo_planta_id_idx on centros_custo (planta_id);

create table horarios (
  id bigint generated always as identity primary key,
  nome text not null unique,
  turno text not null check (turno in ('1º Turno', '2º Turno', '3º Turno', 'Administrativo')),
  carga_horaria_semanal integer not null check (carga_horaria_semanal > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table folhas (
  id bigint generated always as identity primary key,
  nome text not null unique,
  tipo text not null check (tipo in ('Mensalista', 'Horista')),
  periodicidade text not null check (periodicidade in ('Mensal', 'Quinzenal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table colaboradores (
  id bigint generated always as identity primary key,
  matricula text not null unique,
  nome text not null,
  email text not null,
  telefone text not null,
  data_admissao date not null,
  status text not null check (status in ('ativo', 'afastado', 'inativo')),
  cargo_id bigint not null references cargos (id),
  area_id bigint not null references areas (id),
  planta_id bigint not null references plantas (id),
  centro_custo_id bigint not null references centros_custo (id),
  horario_id bigint not null references horarios (id),
  folha_id bigint not null references folhas (id),
  gestor_id bigint references colaboradores (id),
  is_gestor boolean not null default false,
  salario numeric(14,2) not null check (salario >= 0),
  apdata_id text not null unique,
  employee_central_id text not null unique,
  status_sincronizacao text not null check (status_sincronizacao in ('sincronizado', 'divergente', 'pendente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gestor_id is null or gestor_id <> id)
);
create index colaboradores_planta_status_nome_idx on colaboradores (planta_id, status, nome, id);
create index colaboradores_gestor_id_idx on colaboradores (gestor_id);
create index colaboradores_cargo_id_idx on colaboradores (cargo_id);
create index colaboradores_area_id_idx on colaboradores (area_id);
create index colaboradores_centro_custo_id_idx on colaboradores (centro_custo_id);
create index colaboradores_horario_id_idx on colaboradores (horario_id);
create index colaboradores_folha_id_idx on colaboradores (folha_id);

create table usuarios (
  id bigint generated always as identity primary key,
  subject text not null unique,
  nome text not null,
  email text not null,
  perfil text not null check (perfil in ('gestor', 'rh_local', 'rh_central', 'auditoria')),
  planta_id bigint references plantas (id),
  colaborador_id bigint references colaboradores (id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index usuarios_planta_id_idx on usuarios (planta_id);
create index usuarios_colaborador_id_idx on usuarios (colaborador_id);

-- Snapshots normalizados de cada sistema de origem (dados de demonstração).
create table colaborador_fontes (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references colaboradores (id),
  fonte text not null check (fonte in ('apdata', 'employee_central')),
  gestor text not null,
  cargo text not null,
  centro_custo text not null,
  area text not null,
  payload_bruto jsonb,
  capturado_em timestamptz not null default now(),
  unique (colaborador_id, fonte)
);

create table conciliacoes (
  id bigint generated always as identity primary key,
  origem text not null check (origem in ('manual', 'agendada')),
  status text not null check (status in ('em_execucao', 'concluida', 'erro')),
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  registros_comparados integer not null default 0,
  divergencias_criadas integer not null default 0,
  divergencias_atualizadas integer not null default 0,
  erro text,
  executado_por bigint references usuarios (id),
  check ((status = 'em_execucao') = (finalizada_em is null))
);
create index conciliacoes_status_finalizada_idx on conciliacoes (status, finalizada_em desc);
create index conciliacoes_executado_por_idx on conciliacoes (executado_por);

create table movimentacoes (
  id bigint generated always as identity primary key,
  protocolo text not null unique,
  colaborador_id bigint not null references colaboradores (id),
  planta_id bigint not null references plantas (id),
  solicitante_id bigint references usuarios (id),
  solicitante_nome text not null,
  tipo text not null check (tipo in ('mudanca_gestor', 'alteracao_cargo', 'alteracao_salarial', 'promocao', 'enquadramento', 'transferencia_cc')),
  data_abertura date not null default current_date,
  vigencia date,
  etapa_atual text not null check (etapa_atual in ('gestor', 'rh_local', 'rh_central', 'concluida')),
  status text not null check (status in ('rascunho', 'em_andamento', 'devolvida', 'reprovada', 'aprovada')),
  alteracao jsonb not null,
  justificativa text not null,
  checagens jsonb not null default '[]'::jsonb,
  apdata_gerado_em timestamptz,
  employee_central_gerado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'aprovada') = (etapa_atual = 'concluida'))
);
create index movimentacoes_planta_status_etapa_idx on movimentacoes (planta_id, status, etapa_atual, data_abertura desc, id desc);
create index movimentacoes_colaborador_idx on movimentacoes (colaborador_id, data_abertura desc, id desc);
create index movimentacoes_solicitante_id_idx on movimentacoes (solicitante_id);

-- Protocolo atômico e único derivado do id gerado pelo banco (sem max+1 na aplicação).
create function movimentacoes_set_protocolo() returns trigger language plpgsql as $$
begin
  if new.protocolo is null or new.protocolo = '' then
    new.protocolo := 'MOV-' || to_char(new.data_abertura, 'YYYY') || '-' || lpad(new.id::text, 4, '0');
  end if;
  return new;
end;
$$;
create trigger movimentacoes_set_protocolo before insert on movimentacoes
  for each row execute function movimentacoes_set_protocolo();

create table movimentacao_decisoes (
  id bigint generated always as identity primary key,
  movimentacao_id bigint not null references movimentacoes (id),
  etapa text not null check (etapa in ('gestor', 'rh_local', 'rh_central')),
  decisao text not null check (decisao in ('aprovado', 'devolvido', 'reprovado')),
  comentario text,
  aprovador_perfil text not null check (aprovador_perfil in ('gestor', 'rh_local', 'rh_central', 'auditoria')),
  aprovador_nome text not null,
  aprovador_id bigint references usuarios (id),
  data timestamptz not null default now()
);
create index movimentacao_decisoes_mov_idx on movimentacao_decisoes (movimentacao_id, data, id);
create index movimentacao_decisoes_aprovador_idx on movimentacao_decisoes (aprovador_id);

create table movimentacao_eventos (
  id bigint generated always as identity primary key,
  movimentacao_id bigint not null references movimentacoes (id),
  tipo text not null check (tipo in ('abertura', 'edicao', 'anexo', 'validacao', 'aprovacao', 'devolucao', 'reprovacao', 'conclusao', 'geracao_arquivo')),
  data timestamptz not null default now(),
  autor text not null,
  autor_id bigint references usuarios (id),
  descricao text not null,
  comentario text
);
create index movimentacao_eventos_mov_idx on movimentacao_eventos (movimentacao_id, data desc, id desc);
create index movimentacao_eventos_autor_idx on movimentacao_eventos (autor_id);

create table movimentacao_documentos (
  id bigint generated always as identity primary key,
  movimentacao_id bigint not null references movimentacoes (id),
  nome text not null,
  tipo text not null check (tipo in ('evidencia', 'documento_aprovado', 'offer_letter', 'c_req', 'e_req')),
  mime text not null,
  tamanho_bytes integer not null check (tamanho_bytes >= 0),
  sha256 text,
  conteudo bytea,
  autor_usuario_id bigint references usuarios (id),
  autor_colaborador_id bigint references colaboradores (id),
  autor_nome text not null,
  criado_em timestamptz not null default now(),
  check ((conteudo is null) = (sha256 is null))
);
create index movimentacao_documentos_mov_idx on movimentacao_documentos (movimentacao_id, criado_em, id);
create index movimentacao_documentos_autor_usuario_idx on movimentacao_documentos (autor_usuario_id);
create index movimentacao_documentos_autor_colab_idx on movimentacao_documentos (autor_colaborador_id);

create table divergencias (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references colaboradores (id),
  planta_id bigint not null references plantas (id),
  campo text not null check (campo in ('gestor', 'cargo', 'centro_custo', 'area')),
  valor_apdata text not null,
  valor_employee_central text not null,
  responsavel_id bigint references colaboradores (id),
  status text not null check (status in ('aberta', 'em_tratamento', 'resolvida')),
  detectada_em timestamptz not null default now(),
  resolvida_em timestamptz,
  justificativa_resolucao text,
  conciliacao_id bigint references conciliacoes (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'resolvida') = (resolvida_em is not null))
);
create index divergencias_planta_status_detectada_idx on divergencias (planta_id, status, detectada_em desc, id desc);
create index divergencias_colaborador_idx on divergencias (colaborador_id);
create index divergencias_responsavel_idx on divergencias (responsavel_id);
create index divergencias_conciliacao_idx on divergencias (conciliacao_id);
-- Nunca duplica a mesma divergência ainda não resolvida.
create unique index divergencias_aberta_unica_idx on divergencias (colaborador_id, campo) where status <> 'resolvida';

create table exports (
  id bigint generated always as identity primary key,
  movimentacao_id bigint not null references movimentacoes (id),
  tipo text not null check (tipo in ('apdata', 'employee_central')),
  nome_arquivo text not null,
  mime text not null,
  tamanho_bytes integer not null,
  sha256 text not null,
  autor_id bigint references usuarios (id),
  autor_nome text not null,
  created_at timestamptz not null default now()
);
create index exports_mov_idx on exports (movimentacao_id, created_at desc);
create index exports_autor_idx on exports (autor_id);

create table logs_integracao (
  id bigint generated always as identity primary key,
  data timestamptz not null default now(),
  acao text not null,
  categoria text not null check (categoria in ('movimentacao', 'aprovacao', 'conciliacao', 'exportacao', 'sistema')),
  status text not null check (status in ('sucesso', 'erro')),
  duracao_ms integer not null default 0 check (duracao_ms >= 0),
  detalhe text not null default '',
  erro text,
  correlation_id text,
  usuario_id bigint references usuarios (id)
);
create index logs_integracao_data_idx on logs_integracao (data desc, categoria, status, id);
create index logs_integracao_usuario_idx on logs_integracao (usuario_id);

-- Eventos, decisões e logs são append-only (a limpeza de logs exige o flag transacional abaixo).
create function bloquear_alteracao() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'logs_integracao' and tg_op = 'DELETE'
     and current_setting('nexo.permitir_limpeza_logs', true) = 'on' then
    return old;
  end if;
  raise exception 'Tabela % é append-only (% não permitido).', tg_table_name, tg_op using errcode = '55000';
end;
$$;
create trigger movimentacao_decisoes_append_only before update or delete on movimentacao_decisoes
  for each row execute function bloquear_alteracao();
create trigger movimentacao_eventos_append_only before update or delete on movimentacao_eventos
  for each row execute function bloquear_alteracao();
create trigger logs_integracao_append_only before update or delete on logs_integracao
  for each row execute function bloquear_alteracao();

-- Down Migration

drop table if exists logs_integracao;
drop table if exists exports;
drop table if exists divergencias;
drop table if exists movimentacao_documentos;
drop table if exists movimentacao_eventos;
drop table if exists movimentacao_decisoes;
drop table if exists movimentacoes;
drop function if exists movimentacoes_set_protocolo();
drop table if exists conciliacoes;
drop table if exists colaborador_fontes;
drop table if exists usuarios;
drop table if exists colaboradores;
drop table if exists folhas;
drop table if exists horarios;
drop table if exists centros_custo;
drop table if exists cargo_plantas;
drop table if exists cargos;
drop table if exists areas;
drop table if exists plantas;
drop function if exists bloquear_alteracao();
