# HMP-GESTAO

Repositório do **HMP OS** — sistema operacional interno da HMP para gestão e execução de produtos.

## Documentação

- [HMP OS — Discovery & Architecture v0.1](docs/hmp-os/discovery-architecture-v0.1.md) — problema, entidades candidatas e perguntas em aberto.
- [HMP OS — Conceptual Architecture v0.1](docs/hmp-os/conceptual-architecture-v0.1.md) — proposta estrutural concreta: entidades, campos, workflow, papéis e MVP.
- [HMP OS — Validation Report v0.1](docs/hmp-os/validation-v0.1.md) — validação técnica de "clone → configure → rode": ambiente, infraestrutura, rotas, vertical slice, problemas e correções.
- [HMP OS — Roteiro de Teste v0.1](docs/hmp-os/user-validation-v0.1.md) — roteiro prático (não-técnico) para o Heitor validar o produto na prática.

## HMP OS v0.1 — Functional Prototype

Protótipo navegável e funcional, para validar o modelo operacional na prática com Heitor, Linard e Pedro antes de evoluir para uma versão mais robusta.

### Stack

- **Next.js (App Router) + TypeScript** — Server Components para leitura, Server Actions para toda mutação (sem API separada). Todas as rotas são `force-dynamic`: o app depende 100% de dados ao vivo (banco + cookie de ator), não há nada a pré-renderizar no build.
- **Prisma + Postgres** — usa driver adapter (`@prisma/adapter-pg`), exigido a partir do Prisma 7. Funciona com qualquer Postgres (Neon, Supabase, Vercel Postgres, um Postgres local); o protótipo foi validado com **Neon** e com **Postgres local** (incl. via Docker).
- **Tailwind CSS** — componentes próprios (sem UI kit pesada), visual inspirado em Linear/Height/Notion.
- Sem autenticação real — um seletor de "atuando como" (cookie) simula o usuário atual para fins de demonstração.

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
- `SEED_TOKEN` — opcional, só usado pela rota `/api/admin/seed` (bootstrap em produção sem acesso local ao banco, ver "Deploy na Vercel" abaixo). Não precisa dele para rodar local.

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

Para recomeçar do zero (⚠️ **apaga todos os dados** do banco apontado por `DATABASE_URL` e roda o seed de novo):

```bash
npm run db:reset
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
   - `SEED_TOKEN` — qualquer valor secreto à sua escolha (é só a "senha" de um endpoint de bootstrap, ver abaixo).
3. Deploy. O próprio build já roda a migration e cria as tabelas — não precisa terminal, nem `npx`, nem nada local.
4. Depois do deploy, popule os dados de demonstração visitando uma vez, no navegador:
   `https://<seu-projeto>.vercel.app/api/admin/seed?token=<o mesmo valor de SEED_TOKEN>`
   Isso roda o mesmo seed de `npm run db:seed`, direto no banco de produção. Pode chamar de novo a qualquer momento para resetar a demo ao estado inicial.
5. **Depois de usar**, remova a variável `SEED_TOKEN` da Vercel (ou troque o valor) — essa rota apaga e recria todos os dados sempre que é chamada, então não é algo para deixar disponível indefinidamente com um token previsível.

> Validado de ponta a ponta na Vercel com um banco Neon real (build → `migrate deploy` → seed → app funcionando). Dois problemas apareceram só durante esse primeiro deploy real, específicos da conta/projeto do usuário (não do código): o projeto tinha sido criado com Framework Preset "Other" (antes de existir código Next.js para detectar), e o Neon exige a connection string direta — não a pooled — para o advisory lock do Migrate. Os dois pontos acima já refletem a correção.

### O que vem no seed

Dados demonstrativos da HMP, prontos para o passeio funcional descrito no critério de sucesso do protótipo:

- Empresa **HMP**, pessoas **Heitor** (Product), **Linard** (Architecture), **Pedro** (Engineering).
- Produtos **Nutria** (Development) e **Exomia** (Discovery).
- Feature **"Elaboração do Plano Alimentar"** (Nutria), em `DEVELOPMENT`, com contexto, problema, requisitos, fluxo funcional, arquitetura, 9 tasks (algumas concluídas, uma em andamento, uma bloqueada), 2 decisões, 4 artifacts e critérios de aceite — pronta para ser levada até `VALIDATION` ao vivo durante uma demonstração.
- Uma Meeting com as 3 pessoas, que originou as 2 decisões da Feature; uma delas gerou a task "Implementar backend" — a cadeia Meeting → Decision → Task → Feature → Product já vem navegável. Uma terceira decisão (Exomia) afeta só o Product.
- A próxima reunião semanal já agendada (3 dias depois de rodar o seed), para o Dashboard mostrar a pauta sugerida.
- Histórico completo (`ActivityLog`) reconstruindo a cadeia inteira da Feature, da criação até o estado atual.

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
- Meetings e Decisions têm criação e edição reais, mas sem exclusão e sem status próprio: a Meeting é contexto e a Decision é registro — a execução é acompanhada pelas Tasks que ela gera. Artifacts continuam somente leitura.
- Uma Decision "afeta" no máximo uma coisa: uma Feature (que já implica o Product) ou só um Product. Depois que a decisão gera Tasks, esse vínculo trava, para as duas pontas não divergirem.
- Task criada a partir de uma Decision guarda só `decisionId` e fica na Feature da decisão (ou numa Feature do Product dela, ou avulsa se a decisão não afeta nada); a reunião de origem vem pela decisão. `Task.meetingId` fica reservado para follow-ups diretos de reunião, que ainda não têm UI.
- O Dashboard não guarda nada: tudo é calculado na hora. "Precisa de você" usa a pessoa do seletor *Atuando como* e os papéis da Feature (Product valida, Architecture co-revisa em Review, Engineering leva para Review quando as tasks fecham). Task atrasa quando o dia do prazo já passou (não na hora). "Features paradas" = nenhum evento no histórico há 7+ dias. A pauta sugerida olha a última reunião: decisões dela ainda sem task, tasks decorrentes em aberto e Features que mudaram de estágio desde então.

### Estrutura

```
docker-compose.yml            Postgres local opcional (docker compose up -d)
prisma/schema.prisma          Modelo de dados completo
prisma/migrations/            Migration inicial (Postgres)
prisma/seed.ts                Wrapper de CLI para o seed (npm run db:seed)
src/lib/seed-data.ts          Dados de demonstração (fonte única, usada pelo CLI e pela rota abaixo)
src/app/api/admin/seed/       Bootstrap do seed em produção, protegido por SEED_TOKEN
src/app/                      Rotas (App Router) — uma pasta por entidade
src/app/*/actions.ts          Server Actions (mutações + ActivityLog)
src/lib/action-result.ts      ActionError: erro esperado de Server Action, mostrado no próprio form (ActionForm)
src/components/ui/            Design system (Badge, Card, StatusTracker, ...)
src/components/entities/      Componentes específicos de domínio (FeatureStepper)
src/lib/                      Prisma client, labels/cores por enum, activity log, formatação
```
