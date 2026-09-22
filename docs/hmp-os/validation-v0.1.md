# HMP OS — Validation Report v0.1

> Registro técnico da validação de "clone → configure → rode" do protótipo V0.1. Não é um documento de arquitetura — para isso, ver `discovery-architecture-v0.1.md` e `conceptual-architecture-v0.1.md`. Para um roteiro de teste não-técnico, ver `user-validation-v0.1.md`.

Data: 2026-09-22. Branch: `claude/hmp-os-discovery-architecture-e5gw2a`. Ambiente: sandbox remoto (Claude Code on the web) — as validações abaixo rodaram nesse sandbox, não na máquina do Heitor.

## Ambiente

| Item | Valor |
|---|---|
| Node.js | v22.22.2 |
| npm | 10.9.7 |
| Next.js | 16.3.5 (Turbopack) |
| Prisma | 7.10.0 (`@prisma/adapter-pg`) |
| TypeScript | 7.0.2 |
| Banco usado na validação | PostgreSQL 16 local (nativo no sandbox — não é Neon) |
| Banco de produção (Vercel) | Neon — não tocado nesta validação |

Comandos utilizados (nessa ordem, banco local zerado a cada rodada para simular um clone limpo):

```bash
npm install
cp .env.example .env        # DATABASE_URL apontado para o Postgres local
npx prisma migrate deploy
npm run db:seed
npm run build
npm run lint
npm run dev
```

## Infraestrutura

| Etapa | Resultado |
|---|---|
| `npm install` | OK — 230+ pacotes, sem erro |
| `npx prisma migrate deploy` | OK — 1 migration (`20260917000000_init`) aplicada do zero em banco novo |
| `npm run db:seed` | OK — roda de forma independente (ver "Correções realizadas") |
| `npm run build` | OK — `prisma migrate deploy && next build`, TypeScript sem erros, 20 rotas geradas |
| `npm run lint` | Parcial — ver "Problemas encontrados" |
| `npm run dev` | OK — pronto em ~0.5–3s, serve em `http://localhost:3000` |

Resumo do seed confirmado no terminal:

```
Seed concluído: {
  company: 'HMP',
  people: [ 'Heitor', 'Linard', 'Pedro' ],
  products: [ 'Nutria', 'Exomia' ],
  feature: { title: 'Elaboração do Plano Alimentar', status: 'DEVELOPMENT' },
  tasks: 9, decisions: 3, artifacts: 4, activityLog: 20
}
```

## Rotas validadas

Verificado via Chromium automatizado (Playwright), navegação real clicando nos links da própria página — não chamada direta de URL.

| Rota | Status | Observação |
|---|---|---|
| Dashboard (`/`) | OK | Cockpit populado: atenção necessária, em desenvolvimento, próximas atividades, reuniões, decisões recentes, atividade recente |
| Products (`/products`) | OK | Lista Nutria e Exomia |
| Product detail (`/products/[id]`) | OK | Tabs Overview/Features/Tasks/Decisions/Meetings/Documents/Activity; stats corretos (1 Feature, 9 Tasks, 2 Decisions) |
| Features (`/features`) | OK | Lista sem filtro, mostra a Feature seedada |
| Feature detail (`/features/[id]`) | OK | Todas as seções presentes (ver "Vertical slice" abaixo) |
| Tasks (`/tasks`) | OK | |
| Meetings (`/meetings`) | OK | |
| Decisions (`/decisions`) | OK | + formulário de criação (`/decisions/new`) |
| Artifacts (`/artifacts`) | OK | |
| Validations (`/validations`) | OK | |
| Activity (`/activity`) | OK | |
| Settings (`/settings`) | OK | |

Nenhum erro de console (`page.on('console', type === 'error')`) ou erro de runtime (`pageerror`) capturado em nenhuma rota, em duas rodadas completas de navegação.

## Vertical slice

Fluxo simulado: `Dashboard → Nutria → Features → Elaboração do Plano Alimentar → requisitos → tasks → decisions → artifacts → validation → activity`.

Não apenas "a página abre" — coerência de dados entre telas, verificada programaticamente (não só visualmente):

- **Feature ↔ Tasks**: Feature detail mostra "Tasks (5/9)" — bate exatamente com o seed (5 `DONE`, 1 `IN_PROGRESS`, 1 `BLOCKED`, 2 `TODO`). Cada task lista responsável (Heitor/Linard/Pedro) com cargo e badge de status.
- **Decisions no contexto correto**: as 3 decisões do seed foram abertas individualmente.
  - 2 delas (priorização do Plano Alimentar; cálculo automático de macros) **corretamente** referenciam a Feature "Elaboração do Plano Alimentar" e a Meeting de origem, com Heitor como autor.
  - A 3ª (Exomia entra em Discovery) está ligada ao **Product Exomia**, não à Feature/Meeting — e a UI **corretamente não mostra** vínculo com a Feature nem com uma reunião, porque no seed ela não tem `meetingId` nem `featureId`. Ou seja, a tela distingue corretamente contextos diferentes em vez de misturar tudo.
- **Artifacts no contexto correto**: a lista de Artifacts referencia "Elaboração do Plano Alimentar" (os 4 artifacts do seed estão todos vinculados à Feature, 2 deles também à Meeting).
- **Validation representa o resultado da Feature**: a seção Validation na Feature detail mostra um guard contextual — "A Feature precisa estar em Validation para registrar um resultado. Estado atual: Development." — coerente com o status atual da Feature no seed (`DEVELOPMENT`, ainda não chegou em `VALIDATION`).
- **Activity Log reflete tudo**: os 20 eventos do seed aparecem em ordem cronológica — criação da Feature, mudanças de status (Backlog→Discovery→Specification→Architecture→Development), criação de requisitos, da Meeting, das 2 Decisions, vínculo dos 4 Artifacts, criação das 9 Tasks e as mudanças de status de tasks específicas.

Prints capturados durante a validação (Dashboard, Product detail, Feature detail completo) já foram enviados ao Heitor na sessão de "rodar localmente" anterior a este documento.

## Problemas encontrados

1. **`npm run db:seed` não carregava `.env`** — `prisma/seed.ts` roda via `tsx` direto, fora do fluxo do Prisma CLI, e não importava `dotenv/config` (só `prisma.config.ts` fazia isso). O comando documentado no README falhava (`DATABASE_URL não definida`) num shell limpo. **[Corrigido em sessão anterior, commit `097d909`]**
2. **`npm run lint` estava completamente quebrado** — `next lint` foi **removido** no Next.js 16 (`next build` também não roda mais lint). O script antigo (`"lint": "next lint"`) não executava nada. Nem `eslint` nem `eslint-config-next` estavam instalados — o projeto nunca teve lint funcional de fato.
3. **Lint totalmente funcional ainda não é possível neste projeto** — depois de migrar para a ESLint CLI (ver correção abaixo), `eslint-config-next` (via `typescript-eslint`) recusa rodar: *"typescript-eslint does not support TS 7.0"* (este projeto usa TypeScript 7.0.2). É uma limitação **upstream, conhecida e já sendo rastreada** pelo próprio typescript-eslint (issue referenciada no erro), não um bug do HMP OS. Tentei contornar com um parser só-de-sintaxe (`@babel/eslint-parser`), mas o `@babel/preset-react` mais recente disponível exige `@babel/core@^8`, que conflita com o `@babel/core@7.x` já usado por outras dependências do projeto — instalar isso forçaria versões bleeding-edge conflitantes só para viabilizar lint, o que não parecia uma troca razoável. Não vale a pena forçar essa dependência a mais só para lint (ver "Pontos para validação humana").
4. `.next/dev/lock` (mecanismo novo do Next.js 16 para impedir múltiplas instâncias de `next dev` no mesmo projeto) ficou órfão depois que um processo anterior de `next dev` neste sandbox foi encerrado abruptamente, e bloqueou o próximo `next dev` de subir. **[Contornado: removido o lock órfão antes de reiniciar]** — não deve acontecer em uso normal (só ocorre se o processo for morto sem terminar limpo); se acontecer, a correção é `rm .next/dev/lock` com o dev server realmente parado.

## Correções realizadas

- `prisma/seed.ts`: adicionado `import "dotenv/config"` — `npm run db:seed` volta a funcionar isoladamente. *(commit `097d909`, sessão anterior)*
- `README.md`: reestruturado em Pré-requisitos / Configurar `.env` / Instalação / Banco / Desenvolvimento / Build, para permitir clone → configure → rode sem contexto prévio. Nenhuma credencial real adicionada.
- `docker-compose.yml` (novo): Postgres 16 local com credenciais de desenvolvimento fixas (`hmp`/`hmp`, só localhost) — opção de setup local sem precisar instalar Postgres manualmente. **Não testado neste sandbox** (sem daemon Docker disponível aqui — ver "Pontos para validação humana").
- Migração de `next lint` (removido no Next 16) para a ESLint CLI: rodado o codemod oficial (`@next/codemod next-lint-to-eslint-cli`), que criou `eslint.config.mjs` e atualizou o script `lint`. Como a config padrão gerada (`eslint-config-next`) quebra com TS 7 (problema 3 acima), o config final usa `@next/eslint-plugin-next` diretamente (sem `typescript-eslint`) — funciona para arquivos `.js`/`.mjs`; para `.ts`/`.tsx` fica bloqueado pela limitação upstream, documentada no próprio arquivo. `package.json` ajustado para depender do pacote realmente usado (`@next/eslint-plugin-next`) em vez de `eslint-config-next` (não usado na config final).
- Checagem de tipos continua 100% coberta por `npm run build` (TypeScript nativo do Next, não depende de ESLint) — passou sem erros.

## Pontos para validação humana

Para o Heitor avaliar quando puder abrir o sistema:

1. **Lint incompleto**: hoje só cobre regras estruturais do Next.js em arquivos `.js`/`.mjs`; arquivos `.ts`/`.tsx` (100% do código da aplicação) não são lintados até o `typescript-eslint` suportar TypeScript 7. Duas opções quando isso incomodar: (a) esperar o upstream resolver (é ativo, tem issue aberta), ou (b) decidir baixar o TypeScript do projeto para a série 6.x só para destravar lint — troca que não fiz sozinho porque é uma downgrade de uma dependência central, não uma correção de bug.
2. **`docker-compose.yml`**: escrito seguindo o padrão oficial mais simples (Postgres 16, um serviço), mas não pôde ser testado de ponta a ponta neste sandbox (não há daemon Docker rodando aqui). Vale confirmar `docker compose up -d` + `DATABASE_URL="postgresql://hmp:hmp@localhost:5432/hmp_os"` numa máquina com Docker de verdade antes de confiar nele como caminho documentado.
3. **Validação visual/de produto**: as checagens acima são estruturais (a rota carrega, o dado certo aparece no lugar certo). Julgamento de produto — se o fluxo faz sentido, se a granularidade das tasks está certa, se a UI comunica bem o estado — é o objeto do roteiro em `user-validation-v0.1.md`, não deste documento.
4. **Ambiente de validação ≠ produção**: tudo acima rodou contra um Postgres local neste sandbox efêmero, não contra o Neon de produção da Vercel. O Neon não foi tocado nesta sessão.
