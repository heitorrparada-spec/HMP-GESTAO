# HMP-GESTAO

Repositório do **HMP OS** — sistema operacional interno da HMP para gestão e execução de produtos.

## Documentação

- [HMP OS — Discovery & Architecture v0.1](docs/hmp-os/discovery-architecture-v0.1.md) — problema, entidades candidatas e perguntas em aberto.
- [HMP OS — Conceptual Architecture v0.1](docs/hmp-os/conceptual-architecture-v0.1.md) — proposta estrutural concreta: entidades, campos, workflow, papéis e MVP.

## HMP OS v0.1 — Functional Prototype

Protótipo navegável e funcional, para validar o modelo operacional na prática com Heitor, Linard e Pedro antes de evoluir para uma versão mais robusta.

### Stack

- **Next.js (App Router) + TypeScript** — Server Components para leitura, Server Actions para toda mutação (sem API separada). Todas as rotas são `force-dynamic`: o app depende 100% de dados ao vivo (banco + cookie de ator), não há nada a pré-renderizar no build.
- **Prisma + Postgres** — usa driver adapter (`@prisma/adapter-pg`), exigido a partir do Prisma 7. Funciona com qualquer Postgres (Neon, Supabase, Vercel Postgres); o protótipo foi validado com **Neon**.
- **Tailwind CSS** — componentes próprios (sem UI kit pesada), visual inspirado em Linear/Height/Notion.
- Sem autenticação real — um seletor de "atuando como" (cookie) simula o usuário atual para fins de demonstração.

### Banco de dados (Neon/Postgres)

O app precisa de uma connection string Postgres em `DATABASE_URL`. Para Neon, use a variante **pooled** (hostname com `-pooler`), que é a recomendada tanto para uso local quanto para funções serverless na Vercel.

```bash
npm install
cp .env.example .env
# edite .env e cole sua DATABASE_URL do Neon (ou outro Postgres)

npx prisma migrate deploy     # aplica prisma/migrations/ — cria todas as tabelas
npm run db:seed               # popula com dados realistas da HMP (ver abaixo)
npm run dev                   # http://localhost:3000
```

> A migration inicial (`prisma/migrations/20260917000000_init/`) já vem pronta no repositório — foi gerada offline (`prisma migrate diff --from-empty`), sem precisar de uma conexão viva com o banco no momento em que foi criada. `migrate deploy` só aplica esse SQL contra o banco real apontado por `DATABASE_URL`.

Para recomeçar do zero (⚠️ **apaga todos os dados** do banco apontado por `DATABASE_URL` e roda o seed de novo):

```bash
npm run db:reset
```

### Deploy na Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new) (Next.js é detectado automaticamente).
2. Em **Environment Variables**, adicione `DATABASE_URL` com a mesma connection string do Neon (pooled).
3. Antes do primeiro deploy ficar realmente utilizável, rode `npx prisma migrate deploy` e `npm run db:seed` uma vez contra esse banco (do seu próprio ambiente local — o build da Vercel não roda migrations automaticamente).
4. Deploy.

> **Nota**: a migração de SQLite para Postgres foi feita e o `npm run build` foi validado localmente, mas `migrate deploy`/`db:seed`/o app rodando contra Postgres **não foram testados de ponta a ponta** neste ambiente — o sandbox de desenvolvimento usado bloqueia acesso de rede a `neon.tech` (mesma política que bloqueia `vercel.com`). Rode os passos acima a partir de uma máquina com rede normal antes de considerar o deploy validado.

### O que vem no seed

Dados demonstrativos da HMP, prontos para o passeio funcional descrito no critério de sucesso do protótipo:

- Empresa **HMP**, pessoas **Heitor** (Product), **Linard** (Architecture), **Pedro** (Engineering).
- Produtos **Nutria** (Development) e **Exomia** (Discovery).
- Feature **"Elaboração do Plano Alimentar"** (Nutria), em `DEVELOPMENT`, com contexto, problema, requisitos, fluxo funcional, arquitetura, 9 tasks (algumas concluídas, uma em andamento, uma bloqueada), 3 decisões, 4 artifacts e critérios de aceite — pronta para ser levada até `VALIDATION` ao vivo durante uma demonstração.
- Uma Meeting com as 3 pessoas, que originou as decisões.
- Histórico completo (`ActivityLog`) reconstruindo a cadeia inteira da Feature, da criação até o estado atual.

Artifacts marcados com `[DEMO]` usam links de exemplo (`example.com`) — não são documentos reais.

### Simplificações deliberadas deste protótipo

Registradas para não serem confundidas com decisões definitivas de arquitetura (ver `conceptual-architecture-v0.1.md` para o modelo completo):

- `Role` é um enum em `Person`, não uma entidade própria.
- `Decision` liga a `Feature`/`Product` por FK direta, não por uma tabela de vínculo N—N genérica.
- Fluxo da Feature simplificado a 8 estados (`BACKLOG…DONE`), sem `PRIORITIZATION` nem a separação `APPROVED`/`RELEASED` propostas no documento conceitual.
- `Product`/`Release` são roteados por `id`, não por slug.
- Artifacts são só link/metadado (sem upload de arquivo real).
- Meetings e Artifacts são somente leitura neste protótipo; Decisions têm um formulário real de criação.

### Estrutura

```
prisma/schema.prisma      Modelo de dados completo
prisma/seed.ts            Dados de demonstração
src/app/                  Rotas (App Router) — uma pasta por entidade
src/app/*/actions.ts      Server Actions (mutações + ActivityLog)
src/components/ui/        Design system (Badge, Card, StatusTracker, ...)
src/components/entities/  Componentes específicos de domínio (FeatureStepper)
src/lib/                  Prisma client, labels/cores por enum, activity log, formatação
```
