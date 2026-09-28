-- Up Migration
-- Fase 2 do workflow de promoção/transferência/movimentações: fechamento mensal da folha
-- (trava única, controlada pelo perfil Share) e separação entre aprovação de fluxo,
-- liberação do RH para entrada na Folha e liberação da trava do Share.

alter table usuarios drop constraint usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check check (
  perfil in ('gestor', 'rh_local', 'rh_central', 'auditoria', 'share')
);

-- Trava única (linha singleton): mes_travado nulo = folha aberta.
create table folha_fechamento (
  id smallint primary key default 1 check (id = 1),
  mes_travado date check (mes_travado is null or extract(day from mes_travado) = 1),
  travado_em timestamptz,
  travado_por_id bigint references usuarios (id),
  updated_at timestamptz not null default now(),
  check ((mes_travado is null) = (travado_em is null))
);
insert into folha_fechamento (id, mes_travado) values (1, null);

-- Histórico append-only de trava/liberação (auditoria da ação do Share).
create table folha_fechamento_eventos (
  id bigint generated always as identity primary key,
  acao text not null check (acao in ('travar', 'liberar')),
  mes date not null,
  usuario_id bigint references usuarios (id),
  usuario_nome text not null,
  data timestamptz not null default now()
);
create index folha_fechamento_eventos_data_idx on folha_fechamento_eventos (data desc, id desc);
create trigger folha_fechamento_eventos_append_only before update or delete on folha_fechamento_eventos
  for each row execute function bloquear_alteracao();

-- Liberação do RH para entrada na Folha: gate distinto da aprovação de fluxo (rh_central),
-- só habilitado depois que o fluxo já está 'aprovada'.
alter table movimentacoes
  add column rh_liberada_folha_em timestamptz,
  add column rh_liberada_folha_por_id bigint references usuarios (id);

-- Down Migration

alter table movimentacoes
  drop column rh_liberada_folha_por_id,
  drop column rh_liberada_folha_em;

drop trigger folha_fechamento_eventos_append_only on folha_fechamento_eventos;
drop table folha_fechamento_eventos;
drop table folha_fechamento;

alter table usuarios drop constraint usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check check (
  perfil in ('gestor', 'rh_local', 'rh_central', 'auditoria')
);
