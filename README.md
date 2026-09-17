# HMP-GESTAO

Repositório do **HMP OS** — sistema operacional interno da HMP para gestão e execução de produtos.

## Documentação

- [HMP OS — Discovery & Architecture v0.1](docs/hmp-os/discovery-architecture-v0.1.md) — problema, entidades candidatas e perguntas em aberto.
- [HMP OS — Conceptual Architecture v0.1](docs/hmp-os/conceptual-architecture-v0.1.md) — proposta estrutural concreta: entidades, campos, workflow, papéis e MVP.

## HMP OS v0.1 — Functional Prototype

Protótipo navegável e funcional, para validar o modelo operacional na prática com Heitor, Linard e Pedro antes de evoluir para uma versão mais robusta.

### Stack

- **Next.js (App Router) + TypeScript** — Server Components para leitura, Server Actions para toda mutação (sem API separada).
- **Prisma + SQLite** — banco de desenvolvimento simples, em arquivo, fácil de migrar para Postgres depois. Usa driver adapter (`@prisma/adapter-better-sqlite3`), exigido a partir do Prisma 7.
- **Tailwind CSS** — componentes próprios (sem UI kit pesada), visual inspirado em Linear/Height/Notion.
- Sem autenticação real — um seletor de "atuando como" (cookie) simula o usuário atual para fins de demonstração.

### Rodando localmente

```bash
npm install
cp .env.example .env          # já vem com o valor certo para SQLite local
npm run db:migrate            # cria prisma/dev.db e aplica as migrations
npm run db:seed               # popula com dados realistas da HMP (ver abaixo)
npm run dev                   # http://localhost:3000
```

Para recomeçar do zero (reseta o banco e roda o seed de novo):

```bash
npm run db:reset
```

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
