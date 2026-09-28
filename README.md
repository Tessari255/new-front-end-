# Nexo People

Plataforma de operações de RH: centraliza a base de colaboradores e automatiza solicitações de
movimentação, aprovações por unidade, documentação e conferência entre sistemas de RH
(Apdata × Employee Central).

> **Ambiente de demonstração com backend real.** O frontend (React/Vite) conversa com uma API
> Fastify + **PostgreSQL 16**, que é a fonte de verdade de dados, regras, permissões, transições,
> uploads, conciliação e arquivos de saída. Os dados são fictícios. **Não há integração real com
> Apdata nem com Employee Central**. A autenticação corporativa usa Microsoft Entra SSO quando
> configurada, ou login por e-mail e senha com confirmação por e-mail; o modo demo é exclusivamente local.

## Como iniciar

Pré-requisitos: Node.js ≥ 22.18 (testado no 24), npm e Docker (Compose v2).

```bash
# 1) Banco (PostgreSQL 16 em container)
docker compose up -d db

# 2) Backend
cd backend
cp .env.example .env        # ajuste DATABASE_URL se mudar a porta do banco
npm install
npm run db:migrate
npm run db:seed
npm run dev                 # http://localhost:3001  (GET /health, GET /ready)

# 3) Frontend (em outro terminal, na raiz)
cd ..
npm install
npm run dev                 # http://localhost:4300
```

Atalhos na raiz: `npm run db:up`, `api:install`, `api:migrate`, `api:seed`, `api:dev`, `api:test`,
`api:lint`, `api:build`.

**Porta do banco ocupada?** O Compose publica o PostgreSQL em `127.0.0.1:${DB_PORT:-5432}`. Se a 5432
já estiver em uso (por exemplo, um PostgreSQL instalado no Windows), crie um `.env` na raiz com
`DB_PORT=5433` e use `postgres://nexo:nexo@localhost:5433/nexo_people` no `backend/.env`.

### Variáveis (`backend/.env.example`, `.env.example`)

| Variável | Padrão | Uso |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://nexo:nexo@localhost:5432/nexo_people` | Conexão (pool único por processo) |
| `PORT` | `3001` | Porta da API |
| `CORS_ORIGIN` | `http://localhost:4300` | Origens permitidas (lista separada por vírgula; nunca `*`) |
| `DEMO_MODE` | `true` | Habilita usuários demo, `/dev/*` e o seed. Aceito apenas em `development`/`test`, sempre em loopback |
| `MICROSOFT_ENTRA_TENANT_ID`, `MICROSOFT_ENTRA_AUDIENCE`, `MICROSOFT_ENTRA_SPA_CLIENT_ID`, `MICROSOFT_ENTRA_REQUIRED_SCOPE` | — | Configuração da API Entra; todas obrigatórias em produção com `DEMO_MODE=false` |
| `VITE_API_URL` | `http://localhost:3001/api/v1` | Base da API no frontend |
| `VITE_MICROSOFT_TENANT_ID`, `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_API_SCOPE` | — | Configuração pública da SPA para o login Microsoft; não são segredos |
| `AUTH_EMAIL_SENHA`, `APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | — / `587` | Login por e-mail e senha com envio real por SMTP (ver abaixo). `SMTP_PASSWORD` é segredo |
| `TRUST_PROXY` | `0` | Nº de proxies reversos confiáveis, para o limite de tentativas usar o IP real |
| `VITE_AUTH_EMAIL_SENHA` | — | `true` mostra a tela de login por e-mail e senha em vez do botão Microsoft |
| `DB_POOL_MAX`, `DB_STATEMENT_TIMEOUT_MS`, `LOG_LEVEL` | `10`, `15000`, `info` | Opcionais |

Nenhum segredo real é versionado; as credenciais `nexo/nexo` valem apenas para o banco local do Compose.

### Microsoft Entra SSO

Use duas App Registrations **single-tenant**: uma SPA e uma API. A API expõe somente
`api://<API_CLIENT_ID>/access_as_user` (access-token v2); a SPA usa redirect URI do tipo SPA, com
PKCE e sem client secret/implicit flow. Preencha `VITE_MICROSOFT_API_SCOPE` com esse escopo completo
e faça `MICROSOFT_ENTRA_AUDIENCE` coincidir exatamente com o `aud` emitido para a API.

O backend aceita somente access tokens assinados pelo JWKS do tenant configurado, com `iss`, `aud`,
`tid`, `azp` (a SPA), `scp=access_as_user`, `exp`, `nbf` e `oid` válidos. Ele não aceita ID tokens,
não cria usuários automaticamente e não usa e-mail, grupo ou perfil do token para autorizar. Cadastre
o vínculo estável antes do primeiro login, mantendo as permissões locais no banco:

```sql
update usuarios
set subject = 'entra:<TENANT_ID>:<OBJECT_ID_DO_USUARIO>'
where email = '<email-do-usuario>'; -- use somente para localizar o cadastro durante o provisionamento
```

Ative “Assignment required” no Enterprise Application e atribua somente usuários/grupos autorizados.
O frontend guarda o cache MSAL em `sessionStorage`; não há token em Zustand, `localStorage` ou variáveis secretas `VITE_*`.

### Login por e-mail e senha

Ative com `AUTH_EMAIL_SENHA=true` (backend, `DEMO_MODE=false`) e `VITE_AUTH_EMAIL_SENHA=true` (frontend).

- **Quem pode se cadastrar:** somente e-mails já presentes em `usuarios` (ativos). O perfil e a planta continuam
  sendo definidos pelo RH no banco; o cadastro nunca cria usuários nem concede permissões. Vale qualquer domínio
  (Gmail, Outlook, corporativo), desde que o endereço esteja cadastrado.
- **Primeiro acesso:** o usuário informa o e-mail e recebe um link (24 h, uso único). A senha (12–128 caracteres) é
  criada na página do link, então só quem controla a caixa postal define a senha. Sem confirmar, não há login.
- **Recuperação:** link por e-mail com validade de 30 min e uso único. Ao usá-lo, a senha muda e **todas as sessões são
  encerradas**. Emitir um link novo invalida os anteriores. No máximo 1 e-mail por minuto por usuário.
- **Sem descoberta de contas:** cadastro, recuperação e login devolvem a mesma resposta e levam o mesmo tempo para
  e-mails cadastrados ou não (o envio ocorre fora do caminho da resposta).
- **Tentativas:** 5 senhas erradas bloqueiam a conta por 15 min; cada IP tem até 20 requisições por rota de
  autenticação a cada 15 min (em memória, por processo; com várias instâncias, limite também na borda).
- **Armazenamento:** senhas com scrypt (N=2^16, r=8, p=2, sal aleatório); tokens de e-mail e de sessão são aleatórios
  (256 bits) e só o SHA-256 vai ao banco. Os tokens vão no fragmento do link (`#token=`), que não é enviado a servidores
  nem a `Referer`, e a página os remove da barra de endereço.
- **Sessão:** cookie `HttpOnly`, `SameSite=Strict`, `Path=/api/v1`, `Secure` em produção, com validade de 8 h. Escritas com
  `Origin` fora de `CORS_ORIGIN` são recusadas. O frontend e a API devem estar no mesmo *site* (ex.: `nexo.empresa.com.br`
  e `api.nexo.empresa.com.br`), senão o navegador não envia o cookie.

**Envio de e-mail (produção).** Use o SMTP de um provedor transacional (Amazon SES, SendGrid, Mailgun, Brevo, Postmark)
ou o SMTP autenticado do Microsoft 365/Google Workspace da empresa. TLS é obrigatório (587 com STARTTLS ou 465).
Depois de configurar, valide a entrega com `npm run email:teste -- seu-email@gmail.com` e também com um endereço corporativo.

Para chegar à caixa de entrada do Gmail e de domínios corporativos, configure no DNS do domínio de `EMAIL_FROM`:

1. **SPF** autorizando o provedor (ex.: `v=spf1 include:<provedor> -all`; um único registro SPF por domínio).
2. **DKIM** com as chaves CNAME/TXT fornecidas pelo provedor (alinhado ao domínio do `From`).
3. **DMARC**, começando com `v=DMARC1; p=none; rua=mailto:<caixa-de-relatórios>` e depois `quarantine`/`reject`.
4. Remetente em domínio próprio e verificado no provedor. Não use `@gmail.com`/`@outlook.com` como `EMAIL_FROM` via SMTP
   de terceiros, porque o DMARC desses domínios reprova a mensagem.
5. Se o domínio corporativo tiver gateway antisspam (Mimecast, Proofpoint, Defender), peça ao TI a liberação do remetente.

### Comandos

```bash
# backend/
npm run dev | build | start | typecheck | lint
npm test                    # 82 testes node:test contra PostgreSQL real (banco nexo_people_test)
npm run db:migrate          # aplica migrações SQL versionadas (db:migrate:down reverte a última)
npm run db:seed             # idempotente; exige DEMO_MODE=true; nunca sobrescreve dados existentes
npm run reconcile           # mesma conciliação do endpoint; para agendador externo (cron etc.)
npm run email:teste -- destino@exemplo.com   # envia um e-mail de teste pelo SMTP configurado

# raiz
npm run build | lint | preview
```

Os testes criam/usam o banco separado `<db>_test` (nome derivado de `DATABASE_URL` ou
`TEST_DATABASE_URL`) e **recusam rodar** em bancos cujo nome não termine em `_test`.

## Arquitetura

```
frontend (React 19, Vite, Zustand em memória)  ──HTTP/JSON+multipart──▶  backend/ (Fastify, TypeScript)
   src/services/*  → cliente fetch central (src/lib/apiClient.ts)            │ pool `pg` único, SQL parametrizado
   store: cache em memória, hidratado por GET /bootstrap                     ▼
   localStorage: apenas plantaSelecionadaId e demoUserId                PostgreSQL 16 (migrações em backend/migrations)
```

- **Servidor é a autoridade.** Valores atuais, planta, solicitante, autor e perfil nunca vêm do browser.
  As regras (incl. checagens e faixa salarial), transições, RBAC, concorrência, validação de arquivos,
  conciliação e geração de arquivos rodam no backend. As validações do frontend são só UX.
- **Sem transição otimista.** Cada mutação devolve o recurso canônico (movimentação + documentos +
  eventos + logs) e o frontend apenas o mescla no store.
- **Sem dados de negócio no navegador.** A antiga chave `nexo-people-demo-v1` é apagada no boot;
  `partialize` persiste somente preferências de UI.
- **Ids** são `bigint identity` no banco e strings na API. O catálogo vem no `/bootstrap` e é indexado em
  `src/data/catalog.ts` para os helpers síncronos de rótulo/comparação.

### Estrutura

```
backend/src/{app,server,auth,errors,schemas,reconcile}.ts   configuração, RBAC, erros, JSON Schemas
backend/src/domain/      regras (rules), fluxo de etapas, validação de documentos
backend/src/services/    casos de uso: movimentacoes, conciliacao, exportacoes, logs
backend/src/routes/      bootstrap, movimentacoes, documentos, conciliacao, exportacoes, ops
backend/src/db/          pool, queries de leitura, seed (+ dados demo)
backend/migrations/      SQL versionado (node-pg-migrate)
backend/test/            testes de integração (PostgreSQL real)
src/lib/apiClient.ts     cliente HTTP central   src/services/*  chamadas à API   src/store/  cache em memória
```

## Usuários de demonstração e permissões

No modo demo, o seletor do topo escolhe entre **usuários seedados** (`X-Demo-User-Id`, aceito somente
em `DEMO_MODE=true`). Com Microsoft Entra configurado, a tela de login obtém um access token e a API
o vincula a `usuarios.subject = entra:<tid>:<oid>`. Em ambos os casos o servidor carrega perfil,
planta e colaborador no banco — o cliente e o token nunca escolhem um perfil.

| Perfil | Usuários seed | Escopo de leitura | Pode decidir |
| --- | --- | --- | --- |
| Gestor | 5 gestores (ex.: Yasmin Rodrigues Freitas, Joinville) | planta do próprio colaborador | etapa `gestor`, apenas de seus liderados diretos (e, em transferência de localidade com gestor de destino informado, também como gestor de destino) |
| RH Local | 1 por planta | sua planta | etapa `rh_local` da sua planta |
| RH Central | Sede Corporativa | todas as plantas | etapa `rh_central`; libera movimentação aprovada para a Folha |
| Auditoria | 1 | todas | nunca (somente leitura) |
| Share | 1 | todas | nunca decide etapa — trava/libera o fechamento mensal da folha |

Criar/editar/anexar/cancelar: Gestor, RH Local e RH Central dentro do escopo. Executar/atribuir/resolver
conciliação: RH Local (sua planta) e RH Central. Gerar arquivos de saída e liberar para a Folha: RH
Central. Travar/liberar o fechamento mensal: Share. Limpar o log: RH Central.
Recurso fora do escopo responde `404`; sem permissão, `403`.

## API (`/api/v1`)

| Método e rota | Descrição |
| --- | --- |
| `GET /bootstrap` | Estado inicial filtrado pelo escopo (sem bytes de documentos) + `currentUser` |
| `POST /movimentacoes` · `PATCH /movimentacoes/:id/rascunho` | Cria/edita rascunho (só colaborador e tipo são obrigatórios) |
| `POST /movimentacoes/:id/enviar` | Reavalia todas as regras; bloqueia (`422`) se houver checagem bloqueante |
| `POST /movimentacoes/:id/decisoes` | `{decisao, comentario}`; transação com `SELECT … FOR UPDATE`; `409` em conflito. Em transferência de localidade com gestor de destino, exige aprovação de ambos na etapa `gestor` |
| `POST /movimentacoes/:id/cancelar` | Cancela uma alteração (rascunho/em andamento/devolvida/reprovada); não afeta as demais do mesmo chamado |
| `POST /movimentacoes/:id/documentos` · `GET /documentos/:id/download` | Upload multipart (PDF, DOCX, PNG, JPG ≤ 10 MB) e download autorizado |
| `GET /folha` · `POST /folha/travar` · `POST /folha/liberar` | Fechamento mensal (perfil Share); `POST /movimentacoes/:id/liberar-folha` libera uma movimentação aprovada para a Folha (RH Central) |
| `POST /conciliacoes` · `PATCH /divergencias/:id/responsavel` · `POST /divergencias/:id/resolucao` | Conciliação |
| `POST /movimentacoes/:id/exportacoes/{apdata,employee-central}` | Download do arquivo demonstrativo — exige as três liberações: fluxo aprovado, RH liberou para a Folha e mês de vigência não travado |
| `GET/DELETE /logs-integracao` | Log de integração (limpeza só RH Central com escopo global, auditada) |
| `POST /auth/cadastro` · `POST /auth/confirmar` · `POST /auth/login` · `POST /auth/logout` | Login por e-mail e senha (só com `AUTH_EMAIL_SENHA=true`) |
| `POST /auth/recuperar-senha` · `POST /auth/redefinir-senha` · `GET /auth/sessao` | Recuperação de senha e sessão atual |
| `GET /health` · `GET /ready` | Sem banco / verificando o banco |
| `POST /dev/reset`, `POST /dev/integration-failure`, `GET /dev/users` | **Somente `DEMO_MODE=true`** (senão `404`) |

Erros seguem `{ "error": { "code", "message", "fieldErrors", "correlationId" } }` com `400/401/403/404/409/422/500`,
sem stack ou SQL. O `X-Correlation-Id` é propagado nos logs estruturados do Fastify.

## Comportamentos importantes

- **10 tipos de movimentação:** mudança de gestor, alteração de cargo, alteração salarial, promoção,
  enquadramento, transferência de centro de custo, mérito, transferência de localidade (cruza plantas;
  CC + gestor de destino), alteração de mão de obra (direta/indireta) e alteração de área de atuação.
- **Regras de envio** (recalculadas no servidor): justificativa ≥ 10 caracteres; vigência válida e fora
  do mês de fechamento da folha; gestor proposto ativo, gestor, diferente do atual e do próprio
  colaborador; cargo permitido na planta; salário positivo e diferente do atual; enquadramento muda
  folha ou horário; centro de custo compatível com a planta (atual ou proposta, conforme o tipo);
  evidência obrigatória para salário, promoção, enquadramento e mérito. **Faixa salarial é só aviso.**
- **Aprovação:** Gestor → RH Local → RH Central; quem cria o workflow para seu próprio liderado não
  aprova a própria solicitação (a etapa inicial já sai em RH Local). Devolução (comentário ≥ 5) volta
  para o gestor; reprovação encerra. A aprovação final marca `aprovada/concluida` e **não altera o
  cadastro canônico**. Transferência de localidade com gestor de destino informado exige aprovação de
  **ambos** (origem e destino) antes de avançar — mecanismo genérico e configurável
  (`EXIGE_APROVACAO_GESTOR_DESTINO`), hoje só aplicado a esse tipo.
- **Fechamento mensal da folha (Share):** trava única por mês (`folha_fechamento`, histórico
  append-only). Enquanto travado, o envio de qualquer movimentação com vigência nesse mês é bloqueado
  no servidor (`422 FOLHA_FECHADA`) com a data válida do mês seguinte sugerida. Três liberações
  distintas e cumulativas para gerar arquivos de saída: (1) fluxo aprovado, (2) RH Central libera a
  movimentação para a Folha, (3) mês de vigência não travado pelo Share.
- **Chamados com múltiplas alterações:** uma movimentação pode ser aberta como nova alteração de um
  chamado existente (`chamadoPaiId`, normalizado para a raiz, mesmo colaborador obrigatório); cada
  alteração mantém seu próprio ciclo de aprovação/documentos/checagens, sem alterar a máquina de
  estados. Qualquer alteração cancelável (rascunho/em andamento/devolvida/reprovada) pode ser
  cancelada isoladamente, sem afetar as demais do mesmo chamado.
- **Concorrência:** decisões usam lock de linha e revalidam estado/perfil sob lock; duas decisões
  concorrentes na mesma etapa resultam em uma transição e um `409`.
- **Evidências:** validação de MIME, extensão, tamanho, conteúdo vazio e assinatura real do arquivo;
  SHA-256 calculado no servidor; binário em `bytea` (nunca no `/bootstrap`); download com
  `Content-Disposition` seguro e `nosniff`. Ao enviar pelo formulário: rascunho → uploads → envio;
  se um upload falha, o rascunho fica salvo e o fluxo **não** é enviado.
- **Conciliação:** compara `gestor`, `cargo`, `centro_custo` e `area` dos snapshots normalizados de
  Apdata e Employee Central (`colaborador_fontes`, dados de demonstração). Persiste cada execução
  (início, fim, status, erro), cria/reabre divergências sem duplicar (índice único parcial) e roda uma
  por vez (advisory lock). Se a diferença ainda existe na fonte, a divergência resolvida é reaberta na
  execução seguinte.
- **Auditoria:** `movimentacao_eventos`, `movimentacao_decisoes` e `logs_integracao` são append-only
  (trigger). A única exceção é a limpeza do log pelo RH Central, que deixa registro da própria limpeza.
- **Protocolo:** gerado no banco (trigger, a partir do id) — nada de `max + 1` na aplicação.

### Modelo e índices

Tabelas: `plantas`, `areas`, `cargos`, `cargo_plantas`, `centros_custo`, `horarios`, `folhas`,
`usuarios`, `colaboradores`, `colaborador_fontes`, `movimentacoes`, `movimentacao_decisoes`,
`movimentacao_eventos`, `movimentacao_documentos`, `divergencias`, `conciliacoes`, `exports`,
`logs_integracao`, `folha_fechamento` (singleton, id=1), `folha_fechamento_eventos`. Datas civis em
`date`, instantes em `timestamptz`, salários `numeric(14,2)`, enums com `text + CHECK`, `jsonb` só em
`alteracao`/`checagens`. `movimentacoes.chamado_pai_id` é auto-referência (nula = a própria linha é a
raiz do chamado); `movimentacoes.potencial` e `colaboradores.tipo_mao_de_obra` são opcionais. IPE
não é persistido por movimentação — é sempre derivado de `cargo_plantas.ipe` no momento da leitura.
Índices compostos conforme os filtros das telas, incluindo `(coalesce(chamado_pai_id, id))` para
agrupar um chamado; `test/indices.test.ts` confirma via `EXPLAIN` que cada um é utilizável. Não foi
criado o índice parcial de `em_andamento` (o composto por planta/status/etapa já cobre o filtro no
volume atual).

## O que é demonstrativo

- **Arquivos de saída:** `apdata-demo-<protocolo>.csv` e `employee-central-demo-<protocolo>.json` têm
  **formato demonstrativo, não homologado**. O layout oficial da transação Apdata 19092 e o canal de
  entrega/retorno do Employee Central não foram fornecidos. Nenhuma conexão externa é feita e não há
  escrita direta no Employee Central. Cada geração registra hash, autor, timestamp, tipo e evento.
- **Snapshots de Apdata/Employee Central:** dados fictícios seedados; não há leitura das fontes reais.
- **Regras de negócio** (compatibilidade cargo-planta, faixa salarial…) são de demonstração e não
  substituem políticas oficiais. **"Resumo inteligente"** é heurística local, não IA.
- **Usuários demo/`DEMO_MODE`** existem apenas para desenvolvimento/teste, em loopback.

## Suposições adotadas (lacunas registradas)

- Sem matriz de alçadas, o escopo é por **planta**: Gestor aprova só liderados diretos; RH Central atua
  em todas as plantas quando o usuário não tem planta definida (a estrutura já aceita restringir).
- Gestor/RH podem abrir movimentações para colaboradores da sua planta (regra de demonstração).
- Transferência de centro de custo só dentro da planta atual (como no frontend); transferência de
  localidade cruza plantas; proposta igual ao valor atual é tratada como "não informada".
- Responsável de divergência: colaborador ativo da área Recursos Humanos.
- Logs: RH Central e Auditoria veem todos; os demais veem apenas os próprios.
- **Aprovação dupla do gestor de destino** (transferência de localidade): implementada apenas para
  esse tipo, porque é o único caso descrito na planilha ("necessidade de aprovação do gestor para
  aprovar workflow qdo transfere funcionário"). A extensão a outros tipos (mudança de gestor,
  transferência de CC) e a ordem exata das duas aprovações não estão descritas — o mecanismo é
  genérico e configurável, mas a decisão de ampliá-lo é de negócio.
- **Bônus/PRP:** a planilha nunca preenche esses campos em nenhum exemplo e não define taxonomia —
  não foram implementados para não inventar dado ausente.

## Bloqueios para produção

Não implementados por falta de definição: **layout oficial da transação 19092**; **layout/canal de
entrega e retorno do arquivo do Employee Central**; **credenciais e formato de leitura de Apdata/Employee
Central**; **autoridade por campo e processo de resolução de divergências**; **matriz de
aprovação/alçadas/substituições por planta**; **extensão da aprovação dupla do gestor de destino a
outros tipos de movimentação além de transferência de localidade**; **taxonomia de bônus/PRP**;
**modelo oficial das cartas de promoção/mérito** (hoje só upload/consulta como anexo, sem geração
automática); **retenção legal, classificação LGPD, RPO/RTO e SLA**.
Ainda é necessário configurar o tenant Entra, provisionar os usuários e aplicar TLS, HSTS/CSP e rate
limiting na borda de produção. Também fora de escopo: recrutamento,
onboarding e demais módulos, IA/agentes, API personalizada do Apdata, relógios de ponto, Slack/Teams,
hub de iniciativas, regras salariais corporativas (arredondamento, retroatividade, dissídio,
parcelamento) e rollout técnico para as seis plantas.

> `ponytail:` `/bootstrap` (sem paginação) e `bytea` para documentos são escolhas deliberadas do MVP.
> Migrar para consultas paginadas e object storage só quando tamanho, latência, backup ou volume
> medidos justificarem.

## Roteiro de apresentação (≈ 3 minutos)

1. **Visão geral** — quatro indicadores, gráfico de status e "Resumo inteligente" (heurística local).
2. **Colaboradores → Bianca Ferreira Aguiar** (Joinville, Qualidade) → **Solicitar movimentação**.
3. **Mudança de gestor** — compare Yasmin Rodrigues Freitas (atual) com Mariana Oliveira Castro
   (proposta), justifique e envie (com o usuário **Yasmin**, gestora direta).
4. **Aprovações** — Yasmin aprova; troque o usuário no topo para **RH Local — Planta Joinville** e depois
   **RH Central — Sede Corporativa** e aprove até concluir. Recarregue o navegador: nada se perde.
5. **Linha do tempo** — abertura, validação, três aprovações e conclusão, gravadas no PostgreSQL.
6. **Saída** — como RH Central, gere a carga Apdata e o arquivo Employee Central (demonstrativos).
7. **Conciliação** — execute a conferência, abra uma divergência (cargo de João Pedro Almeida),
   atribua um responsável e resolva com justificativa.
8. **Log de integração** — cada chamada aparece com duração e resultado; use "Simular falha".
9. **Restaurar demonstração** (rodapé do menu) recria o estado inicial no banco.
