-- Up Migration
alter table cargos drop constraint cargos_nivel_check;
alter table cargos add constraint cargos_nivel_check check (nivel in ('Operacional', 'Técnico', 'Coordenação', 'Gerência', 'Diretoria', 'CIO'));

alter table movimentacoes add column aprovador_gestor_id bigint references colaboradores (id);
alter table movimentacoes add column rodada_aprovacao integer not null default 0;
create index movimentacoes_aprovador_gestor_idx on movimentacoes (aprovador_gestor_id, status, etapa_atual);
update movimentacoes m set aprovador_gestor_id = c.gestor_id
  from colaboradores c where c.id = m.colaborador_id and m.status = 'em_andamento' and m.etapa_atual = 'gestor';

alter table movimentacao_decisoes add column rodada_aprovacao integer not null default 0;

-- Down Migration
alter table movimentacao_decisoes drop column rodada_aprovacao;
drop index movimentacoes_aprovador_gestor_idx;
alter table movimentacoes drop column rodada_aprovacao;
alter table movimentacoes drop column aprovador_gestor_id;
alter table cargos drop constraint cargos_nivel_check;
alter table cargos add constraint cargos_nivel_check check (nivel in ('Operacional', 'Técnico', 'Coordenação', 'Gerência', 'Diretoria'));
