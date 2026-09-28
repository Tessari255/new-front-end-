-- Up Migration
-- Fase 5 do workflow de promoção/transferência/movimentações: mais de uma alteração no mesmo
-- chamado (abas "ALTERAÇÃO DE CC" e "ALTERAÇÃO AREA DE ATUAÇÃO"). Cada alteração continua sendo
-- uma linha de movimentacoes, com seu próprio ciclo de aprovação/checagens/documentos; o chamado
-- é o agrupamento pela raiz (chamado_pai_id nulo = a própria linha é a raiz do chamado).

alter table movimentacoes
  add column chamado_pai_id bigint references movimentacoes (id);

alter table movimentacoes
  add constraint movimentacoes_chamado_pai_nao_proprio check (chamado_pai_id is null or chamado_pai_id <> id);

-- Busca eficiente de "todas as alterações do mesmo chamado".
create index movimentacoes_chamado_idx on movimentacoes (coalesce(chamado_pai_id, id));

-- Novo status: alteração adicional de um chamado pode ser cancelada sem afetar as demais.
alter table movimentacoes drop constraint movimentacoes_status_check;
alter table movimentacoes add constraint movimentacoes_status_check check (
  status in ('rascunho', 'em_andamento', 'devolvida', 'reprovada', 'aprovada', 'cancelada')
);

alter table movimentacao_eventos drop constraint movimentacao_eventos_tipo_check;
alter table movimentacao_eventos add constraint movimentacao_eventos_tipo_check check (
  tipo in ('abertura', 'edicao', 'anexo', 'validacao', 'aprovacao', 'devolucao', 'reprovacao', 'conclusao', 'geracao_arquivo', 'cancelamento')
);

-- Down Migration

alter table movimentacao_eventos drop constraint movimentacao_eventos_tipo_check;
alter table movimentacao_eventos add constraint movimentacao_eventos_tipo_check check (
  tipo in ('abertura', 'edicao', 'anexo', 'validacao', 'aprovacao', 'devolucao', 'reprovacao', 'conclusao', 'geracao_arquivo')
);

alter table movimentacoes drop constraint movimentacoes_status_check;
alter table movimentacoes add constraint movimentacoes_status_check check (
  status in ('rascunho', 'em_andamento', 'devolvida', 'reprovada', 'aprovada')
);

drop index movimentacoes_chamado_idx;
alter table movimentacoes drop constraint movimentacoes_chamado_pai_nao_proprio;
alter table movimentacoes drop column chamado_pai_id;
