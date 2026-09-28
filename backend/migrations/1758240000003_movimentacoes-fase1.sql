-- Up Migration
-- Fase 1 do workflow de promoção/transferência/movimentações: 4 novos tipos de
-- movimentação (mérito, transferência de localidade, alteração de mão de obra,
-- alteração de área de atuação), campo de mão de obra do colaborador, potencial
-- (opcional, comum a qualquer tipo) e dois novos tipos de documento (cartas PDF).

alter table colaboradores
  add column tipo_mao_de_obra text check (tipo_mao_de_obra in ('direta', 'indireta'));

alter table movimentacoes
  add column potencial text check (potencial in ('baixo', 'estavel', 'alto'));

alter table movimentacoes drop constraint movimentacoes_tipo_check;
alter table movimentacoes add constraint movimentacoes_tipo_check check (
  tipo in (
    'mudanca_gestor', 'alteracao_cargo', 'alteracao_salarial', 'promocao', 'enquadramento', 'transferencia_cc',
    'merito', 'transferencia_localidade', 'alteracao_mao_de_obra', 'alteracao_area_atuacao'
  )
);

alter table movimentacao_documentos drop constraint movimentacao_documentos_tipo_check;
alter table movimentacao_documentos add constraint movimentacao_documentos_tipo_check check (
  tipo in ('evidencia', 'documento_aprovado', 'offer_letter', 'c_req', 'e_req', 'carta_promocao', 'carta_merito')
);

-- Down Migration

alter table movimentacao_documentos drop constraint movimentacao_documentos_tipo_check;
alter table movimentacao_documentos add constraint movimentacao_documentos_tipo_check check (
  tipo in ('evidencia', 'documento_aprovado', 'offer_letter', 'c_req', 'e_req')
);

alter table movimentacoes drop constraint movimentacoes_tipo_check;
alter table movimentacoes add constraint movimentacoes_tipo_check check (
  tipo in ('mudanca_gestor', 'alteracao_cargo', 'alteracao_salarial', 'promocao', 'enquadramento', 'transferencia_cc')
);

alter table movimentacoes drop column potencial;
alter table colaboradores drop column tipo_mao_de_obra;
