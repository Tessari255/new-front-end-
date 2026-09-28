-- Up Migration

-- Parâmetros específicos do cargo na unidade organizacional (planta).
-- `0` permanece legível para dados legados; a aplicação o trata como base não definida.
alter table cargo_plantas
  add column salario_base numeric(14,2),
  add column ipe smallint check (ipe between 1 and 5);

alter table cargo_plantas
  add constraint cargo_plantas_salario_base_nao_negativo check (salario_base is null or salario_base >= 0);

-- Down Migration

alter table cargo_plantas
  drop column if exists ipe,
  drop column if exists salario_base;
