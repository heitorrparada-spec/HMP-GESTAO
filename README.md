# HMP-GESTAO

Repositório do **HMP OS** — sistema operacional interno da HMP para gestão e execução de produtos.

## Documentação

- [HMP OS — Discovery & Architecture v0.1](docs/hmp-os/discovery-architecture-v0.1.md) — problema, entidades candidatas e perguntas em aberto.
- [HMP OS — Conceptual Architecture v0.1](docs/hmp-os/conceptual-architecture-v0.1.md) — proposta estrutural concreta: entidades, campos, workflow, papéis e MVP.
- [HMP OS — Validation Report v0.1](docs/hmp-os/validation-v0.1.md) — validação técnica de "clone → configure → rode": ambiente, infraestrutura, rotas, vertical slice, problemas e correções.
- [HMP OS — Roteiro de Teste v0.1](docs/hmp-os/user-validation-v0.1.md) — roteiro prático (não-técnico) para o Heitor validar o produto na prática.
- [HMP OS — Auditoria Operacional V0.2](docs/hmp-os/audit-v0.2.md) — o que o sistema já sustenta como processo e onde ainda perde contexto.
- [HMP OS — V0.3-A · History & Auditability](docs/hmp-os/spec-v0.3-a-history-auditability.md) — especificação (aprovada e implementada) da camada de histórico: o que fica registrado, o que trava, arquivar em vez de excluir e os critérios de aceite.

## HMP OS v0.1 — Functional Prototype

Protótipo navegável e funcional, para validar o modelo operacional na prática com Heitor, Linard e Pedro antes de evoluir para uma versão mais robusta.

### Stack

- **Next.js (App Router) + TypeScript** — Server Components para leitura, Server Actions para toda mutação (sem API separada). Todas as rotas são `force-dynamic`: o app depende 100% de dados ao vivo (banco + cookie de ator), não há nada a pré-renderizar no build.
- **Prisma + Postgres** — usa driver adapter (`@prisma/adapter-pg`), exigido a partir do Prisma 7. Funciona com qualquer Postgres (Neon, Supabase, Vercel Postgres, um Postgres local); o protótipo foi validado com **Neon** e com **Postgres local** (incl. via Docker).
- **Tailwind CSS** — componentes próprios (sem UI kit pesada), visual inspirado em Linear/Height/Notion.
- Sem autenticação real — um seletor de "atuando como" (cookie) simula o usuário atual para fins de demonstração. Desde a V0.3-A, **toda escrita exige alguém selecionado** (é o autor que vai para o histórico — declarado, não autenticado).

### Pré-requisitos

- **Node.js 20 ou superior** (testado com Node 22) e **npm**.
- Um **Postgres** para apontar o app — escolha uma opção:
  1. **Docker** (mais simples): `docker compose up -d` sobe um Postgres 16 já configurado (`docker-compose.yml` na raiz, credenciais de desenvolvimento apenas).
  2. Um **Postgres já instalado** localmente.
  3. Um projeto **Neon** (ou Supabase/Vercel Postgres) — o mesmo tipo de banco usado em produção.

### Configurar o `.env`

```bash
cp .env.example .env
```

- `DATABASE_URL` — connection string do Postgres que a aplicação usa em runtime.
  - Com o Docker acima: `postgresql://hmp:hmp@localhost:5432/hmp_os`.
  - Com Neon: a variante **pooled** (hostname com `-pooler`).
- `DIRECT_URL` — só necessária atrás de um pooler em modo transaction (caso do Neon). Usada exclusivamente por `prisma migrate deploy`/`migrate dev`: o advisory lock que o Migrate usa para evitar migrations concorrentes não é confiável através de um pooler — sem isso, a migration trava e falha com `Error: P1002` (timeout tentando `pg_advisory_lock`). Com Docker ou Postgres local (sem pooler), pode deixar sem definir — cai automaticamente para `DATABASE_URL`.
  - No painel do Neon, a caixa de "Connection string" tem as duas variantes (normalmente um toggle "Pooled connection"/"Connection pooling") — copie cada uma para a variável certa.
- `SEED_TOKEN` — opcional, só usado pela rota `/api/admin/seed` (reset da demonstração, ver "Deploy na Vercel" abaixo). Não precisa dele para rodar local.
- `ALLOW_DEMO_RESET` — opcional. Em produção, `/api/admin/seed` fica **desligada** (apagar tudo contradiz o histórico preservado); `ALLOW_DEMO_RESET=true` a religa, junto com o `SEED_TOKEN`, só se quiser mesmo recomeçar a demo do zero.

Nunca commite o `.env` com credenciais reais — ele já está no `.gitignore` (`.env.example` é o único versionado, e só tem placeholders).

### Instalação

```bash
npm install
```

### Banco

```bash
npx prisma migrate deploy   # cria as tabelas a partir da migration em prisma/migrations/
npm run db:seed             # popula com dados realistas da HMP (ver "O que vem no seed" abaixo)
```

`npm run db:seed` **recomeça do zero**: apaga todos os dados do banco apontado por `DATABASE_URL` (com `TRUNCATE` — o banco recusa `DELETE`, ver "Histórico e auditoria") e recria a demonstração. Para também recriar as tabelas a partir das migrations:

```bash
npm run db:reset   # ⚠️ apaga o schema inteiro, reaplica as migrations e roda o seed
```

### Desenvolvimento

```bash
npm run dev
# http://localhost:3000
```

### Build

```bash
npm run build
```

Roda `prisma migrate deploy` automaticamente antes do `next build` (o mesmo comando usado no build da Vercel, ver abaixo) — não precisa rodar a migration separadamente antes de buildar.

### Deploy na Vercel (sem precisar rodar nada localmente)

1. Importe o repositório em [vercel.com/new](https://vercel.com/new) (Next.js é detectado automaticamente) e garanta que o **Framework Preset** está como **Next.js** (se o projeto já existia antes do app ter código, a Vercel pode ter detectado "Other" — troque manualmente em Settings → Build and Deployment se for o caso).
2. Em **Environment Variables**, adicione (marcando Production **e** Preview nas duas primeiras):
   - `DATABASE_URL` — a connection string **pooled** do Neon.
   - `DIRECT_URL` — a connection string **direta** do Neon (mesmo host, sem `-pooler`) — necessária para o `migrate deploy` rodar no build (ver seção acima).
   - `SEED_TOKEN` — opcional: só para resetar a demonstração (passo 5).
3. Deploy. O próprio build já roda a migration e cria as tabelas — não precisa terminal, nem `npx`, nem nada local.
4. Depois do deploy, com o banco **totalmente vazio**, abra o app, clique em **Selecionar usuário** (canto inferior esquerdo) e em **Carregar dados de demonstração**: roda o mesmo seed de `npm run db:seed`, numa transação. Ele só aparece e só funciona com o banco vazio — nunca apaga dados.
5. Resetar uma demo já populada apaga o histórico, então em produção a rota `/api/admin/seed` fica desligada por padrão (responde 403). Se quiser mesmo recomeçar do zero: defina `ALLOW_DEMO_RESET=true` e um `SEED_TOKEN`, faça o deploy, visite uma vez `https://<seu-projeto>.vercel.app/api/admin/seed?token=<SEED_TOKEN>` e **depois remova as duas variáveis**.
6. **Antes de publicar uma versão com migration nova** (como a da V0.3-A), ensaie numa branch do Neon criada a partir da produção — ver "Testes de aceite" abaixo.

> Validado de ponta a ponta na Vercel com um banco Neon real (build → `migrate deploy` → seed → app funcionando). Dois problemas apareceram só durante esse primeiro deploy real, específicos da conta/projeto do usuário (não do código): o projeto tinha sido criado com Framework Preset "Other" (antes de existir código Next.js para detectar), e o Neon exige a connection string direta — não a pooled — para o advisory lock do Migrate. Os dois pontos acima já refletem a correção.

### O que vem no seed

Dados demonstrativos da HMP, prontos para o passeio funcional descrito no critério de sucesso do protótipo:

- Empresa **HMP**, pessoas **Heitor** (Product), **Linard** (Architecture), **Pedro** (Engineering).
- Produtos **Nutria** (Development) e **Exomia** (Discovery).
- Feature **"Elaboração do Plano Alimentar"** (Nutria), em `DEVELOPMENT`, com contexto, problema, requisitos, fluxo funcional, arquitetura, 9 tasks (algumas concluídas, uma em andamento, uma bloqueada), 2 decisões, 4 artifacts e critérios de aceite — pronta para ser levada até `VALIDATION` ao vivo durante uma demonstração.
- Uma Meeting com as 3 pessoas, que originou as 2 decisões da Feature; uma delas gerou a task "Implementar backend" — a cadeia Meeting → Decision → Task → Feature → Product já vem navegável. Uma terceira decisão (Exomia) afeta só o Product.
- A próxima reunião semanal já agendada (3 dias depois de rodar o seed), para o Dashboard mostrar a pauta sugerida.
- A narrativa da Feature no histórico (`ActivityLog`), da criação até o estado atual — eventos marcados como **demonstração** na tela — e um snapshot inicial (*baseline*) de cada entidade, ponto de partida do histórico completo.

Artifacts marcados com `[DEMO]` usam links de exemplo (`example.com`) — não são documentos reais.

### Simplificações deliberadas deste protótipo

Registradas para não serem confundidas com decisões definitivas de arquitetura (ver `conceptual-architecture-v0.1.md` para o modelo completo):

- `Role` é um enum em `Person`, não uma entidade própria.
- `Decision` liga a `Feature`/`Product` por FK direta, não por uma tabela de vínculo N—N genérica.
- Fluxo da Feature simplificado a 8 estados (`BACKLOG…DONE`), sem `PRIORITIZATION` nem a separação `APPROVED`/`RELEASED` propostas no documento conceitual. A aprovação fica registrada no `ValidationRecord` e leva a Feature direto para `DONE`.
- Gates do workflow (aplicados nas Server Actions, não só na UI): `DONE` só é alcançado aprovando em Validation; `VALIDATION` só a partir de `REVIEW`; `DONE` é terminal. Os estágios anteriores a Review continuam livres nos dois sentidos.
- Todos os Acceptance Criteria são tratados como obrigatórios (o modelo não tem campo "opcional"): aprovar exige ao menos 1 critério e todos em "Passou". Critérios ficam travados em Validation e depois de Done.
- Entrar em Review não exige Tasks concluídas: o modelo não distingue Tasks bloqueantes de informativas/canceladas, então a Feature só sinaliza tasks abertas/bloqueadas, sem bloquear a transição.
- `Product`/`Release` são roteados por `id`, não por slug.
- Artifacts são só link/metadado (sem upload de arquivo real).
- Meetings e Decisions têm criação e edição reais, sem exclusão. A Decision é registro: fica **Ativa**, **Substituída** (por uma nova decisão, com vínculo) ou **Revogada** (com motivo); a execução é acompanhada pelas Tasks que ela gera. Artifacts continuam somente leitura.
- Uma Decision "afeta" no máximo uma coisa: uma Feature (que já implica o Product) ou só um Product. O mérito da decisão (texto, contexto, justificativa, autor, data, reunião, vínculo, participantes) trava na primeira Task gerada ou 24 h depois do registro — o que vier primeiro; depois disso, só o título admite correção, com motivo.
- Task criada a partir de uma Decision guarda só `decisionId` e fica na Feature da decisão (ou numa Feature do Product dela, ou avulsa se a decisão não afeta nada); a reunião de origem vem pela decisão. `Task.meetingId` fica reservado para follow-ups diretos de reunião, que ainda não têm UI.
- O Dashboard não guarda nada: tudo é calculado na hora. "Precisa de você" usa a pessoa do seletor *Atuando como* e os papéis da Feature (Product valida, Architecture co-revisa em Review, Engineering leva para Review quando as tasks fecham). Task atrasa quando o dia do prazo já passou (não na hora). "Features paradas" = nenhum evento no histórico há 7+ dias. A pauta sugerida olha a última reunião: decisões dela ainda sem task, tasks decorrentes em aberto e Features que mudaram de estágio desde então.

### Histórico e auditoria (V0.3-A)

O sistema distingue **estado atual** (o que as telas mostram para trabalhar) de **histórico** (o que aconteceu, que não pode ser reescrito). Detalhes e justificativas na [especificação](docs/hmp-os/spec-v0.3-a-history-auditability.md).

- **Autor obrigatório.** Sem alguém em *Selecionar usuário*, toda escrita é recusada com a mensagem na própria tela (única exceção: carregar a demo com o banco vazio).
- **Toda mudança vira evento**, na mesma transação da mudança: quem, quando, o quê, **de → para** por campo (`ActivityChange`), motivo quando houver, e escopos (Feature, decisão, reunião, Product) que montam o histórico completo de cada agregado. Salvar sem mudar nada não gera evento. Os eventos da V0.2 continuam lá, com o texto original e o selo "anterior à V0.3".
- **Arquivar em vez de excluir.** Task, requisito e critério saem do trabalho corrente (listas, contadores, Dashboard, pauta) com motivo obrigatório, mas continuam no banco, nos históricos e na origem, com página somente leitura. Restaurar também pede motivo.
- **Travas** (o backend decide; a tela só antecipa):
  - Feature em **Validation**: narrativa, requisitos e critérios travados. Em **Done**: nada muda — nem status, nem prioridade, nem responsáveis; tasks concluídas não reabrem e as abertas só mudam de status ou são arquivadas.
  - Voltar o status de uma Feature, reabrir uma task concluída, remarcar ou mudar participantes de uma reunião que já aconteceu: exigem motivo.
  - Task concluída não é editada nem arquivada (reabrir primeiro, com motivo). A origem da task (Feature, decisão, reunião, criador) nunca muda.
  - Decisão: janela de correção (ver acima); substituir e revogar exigem motivo; decisão substituída ou revogada não gera tasks nem é editada. Data de decisão no futuro é recusada.
- **Validação com snapshot.** Cada tentativa guarda validador, resultado pedido e final, e o que estava em vigor: critérios, requisitos, tasks (com status e responsável) e dados da Feature — a tela mostra "o que foi aprovado".
- **No banco** (triggers da migration `20260924120000_history_auditability`): `ActivityLog`, `ActivityChange` e `ValidationRecord` só aceitam inserção; `DELETE` em tabelas de domínio é recusado; as FKs opcionais viraram `RESTRICT`. O reset de desenvolvimento/demonstração usa `TRUNCATE`.
- **Reconstrução.** `reconstructAt(tipo, id, momento)` (`src/lib/history/reconstruct.ts`) devolve o estado de uma entidade em qualquer ponto do histórico completo; a decisão mostra a "versão original" e a validação, "o que foi aprovado".

### Testes de aceite

Os critérios de aceite da V0.3-A (spec, seção 11) são uma suíte versionada em `tests/acceptance/` — Playwright na UI de verdade (formulários normais e adulterados) com conferência no banco.

```bash
npx playwright install chromium   # uma vez (ou use CHROMIUM_PATH=<caminho de um Chromium já instalado>)
npm run dev                       # num terminal
npm run test:acceptance           # noutro — BASE_URL (padrão http://localhost:3000) e DATABASE_URL do .env
```

- ⚠️ `test:acceptance` **apaga e recria os dados** (mesmo reset do `db:seed`) e escreve no banco. Por isso só roda com `DATABASE_URL` local; para uma branch descartável do Neon, defina `HMP_ACCEPTANCE_ALLOW_REMOTE=1`. **Nunca aponte para a produção.** O servidor em `BASE_URL` precisa usar o mesmo banco.
- `npm run test:migration` confere um banco **migrado a partir da V0.2** (CA-28): baseline de cada entidade, eventos antigos preservados, triggers e FKs, todas as páginas e links do histórico abrindo. É **somente leitura** (sessão read-only no banco, só GET nas páginas).

**Ensaio da migração antes de publicar (DV-22):**

1. No painel do Neon, crie uma **branch a partir da produção** (ex.: `ensaio-v0-3-a`) e copie as connection strings dela.
2. Com `DATABASE_URL`/`DIRECT_URL` apontando para a branch: `npx prisma migrate deploy`.
3. Suba o app contra a branch (`npm run build && npm start`, ou `npm run dev`) e rode `npm run test:migration` (com `BASE_URL`, se o app não estiver em `http://localhost:3000`).
4. Opcional: `HMP_ACCEPTANCE_ALLOW_REMOTE=1 npm run test:acceptance` contra a mesma branch (ela é descartável — a suíte recria os dados).
5. Tudo verde → publique; depois, apague a branch no Neon.

### Estrutura

```
docker-compose.yml            Postgres local opcional (docker compose up -d)
prisma/schema.prisma          Modelo de dados completo
prisma/migrations/            Migrations (Postgres) — a da V0.3-A inclui backfill, baseline e triggers
prisma/seed.ts                Wrapper de CLI para o seed (npm run db:seed)
src/lib/seed-data.ts          Dados de demonstração (fonte única, usada pelo CLI e pela rota abaixo)
src/app/api/admin/seed/       Reset da demo (SEED_TOKEN); desligado em produção sem ALLOW_DEMO_RESET=true
src/app/                      Rotas (App Router) — uma pasta por entidade
src/app/*/actions.ts          Server Actions: cada mutação é um command() — autor + estado + evento numa transação
src/lib/history/              Histórico: command, eventos v2, diff, travas (policy), snapshots, leitura, reconstructAt
src/lib/action-result.ts      ActionError: erro esperado de Server Action, mostrado no próprio form (ActionForm)
src/components/ui/            Design system (Badge, Card, StatusTracker, ...)
src/components/entities/      Componentes específicos de domínio (FeatureStepper)
src/lib/                      Prisma client, labels/cores por enum, formatação
tests/acceptance/             Suíte de aceite da V0.3-A (npm run test:acceptance / test:migration)
```
