-- Up Migration
-- Login por e-mail e senha para usuários já provisionados (o cadastro não cria perfis nem permissões).
alter table usuarios
  add column senha_hash text,
  add column email_verificado_em timestamptz,
  add column falhas_login integer not null default 0,
  add column bloqueado_ate timestamptz;
create unique index usuarios_email_lower_key on usuarios (lower(email));

-- Tokens de uso único (confirmação de cadastro e redefinição de senha). Guarda-se só o SHA-256 do token.
-- A senha só é definida ao usar o link: quem controla a caixa postal escolhe a senha.
create table auth_tokens (
  id bigint generated always as identity primary key,
  usuario_id bigint not null references usuarios (id) on delete cascade,
  finalidade text not null check (finalidade in ('confirmacao', 'redefinicao')),
  token_hash bytea not null unique,
  expira_em timestamptz not null,
  usado_em timestamptz,
  created_at timestamptz not null default now()
);
create index auth_tokens_usuario_finalidade_idx on auth_tokens (usuario_id, finalidade, created_at desc);

-- Sessões opacas (cookie HttpOnly); guarda-se só o SHA-256 do identificador.
create table sessoes (
  id bigint generated always as identity primary key,
  usuario_id bigint not null references usuarios (id) on delete cascade,
  token_hash bytea not null unique,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessoes_usuario_id_idx on sessoes (usuario_id);

-- Down Migration
drop table sessoes;
drop table auth_tokens;
drop index usuarios_email_lower_key;
alter table usuarios drop column bloqueado_ate, drop column falhas_login, drop column email_verificado_em, drop column senha_hash;
