# HMP OS — Auditoria V0.1

> Auditoria crítica de produto, feita depois da validação técnica (`validation-v0.1.md`). Pergunta central: **o HMP OS V0.1 representa o processo operacional real da HMP, ou é um CRUD bem estruturado em cima do modelo de dados?** Nenhum código foi alterado para produzir este documento — é leitura e navegação do estado atual do repositório (schema, seed, Server Actions, páginas).

## 1. Estado atual

Tecnicamente, a V0.1 funciona: builda, roda, navega, mostra os dados certos nos lugares certos (ver `validation-v0.1.md`). Mas essa validação técnica testou principalmente **leitura**. Auditando as `Server Actions` reais do projeto, a resposta à pergunta central é direta:

**Hoje o HMP OS é, na prática, uma vitrine de leitura de um cenário fixo, com quatro portas de escrita — mudar status de uma Feature, mudar status de uma Task, registrar uma Decision, registrar uma Validation. Só isso.** Não existe, em lugar nenhum do produto, uma forma de criar uma Feature, criar uma Task, registrar uma Meeting, anexar um Artifact, criar um Product ou um Release, editar o contexto/objetivo de uma Feature já existente, ou atribuir/reatribuir um responsável. Tudo isso só existe porque foi inserido direto no banco pelo script de seed.

Isso não invalida o protótipo — ele cumpre muito bem o objetivo com que foi construído (validar se o *modelo de dados* consegue representar o caso do Plano Alimentar, e se a navegação comunica esse modelo com clareza). Mas ele ainda não é uma ferramenta que a HMP consegue *usar* na próxima segunda-feira para registrar o que realmente vai acontecer. É um CRUD bem estruturado — com uma exceção real (a tela de Feature) que já aponta pra onde a entidade central pode chegar.

## 2. Feature como entidade central

**O que funciona:** estruturalmente, a Feature já carrega tudo que foi pedido — `context`, `problem`, `userNeed`, `objective`, `functionalFlow`, `architectureNotes`, `priority`, `status`, `requirements[]`, `tasks[]`, `decisions[]`, `artifacts[]`, `acceptanceCriteria[]`/`validationRecords[]`, e histórico via `ActivityLog` filtrado por `entityId`. A tela de detalhe (`src/app/features/[id]/page.tsx`) de fato renderiza tudo isso em uma página só, coerentemente. Esse é o ponto mais forte do produto hoje — dá pra entender o estado inteiro de uma Feature sem sair da página.

**O que é superficial:**

- Todos os campos narrativos (`context`, `problem`, `objective`, `functionalFlow`, `architectureNotes`) são texto livre, sem estrutura, sem versionamento — e **não são editáveis pela UI**. Não existe nenhuma Server Action de update para esses campos. Eles "representam" o problema/objetivo só enquanto alguém os escreve direto no banco; o produto não ajuda ninguém a preenchê-los ou evoluí-los vivo.
- Não existe ação de **criar** uma Feature. Uma necessidade nova para o Nutria não tem, hoje, nenhuma porta de entrada pelo produto.
- `Requirement` não se liga a nenhuma `Task` nem a nenhum `AcceptanceCriteria` específico — é uma lista solta dentro da Feature. Não dá pra responder "qual task implementa qual requisito" nem "qual critério de aceite comprova qual requisito".
- `priority` é estático: sem histórico de repriorização, sem ação de update, sem quem/quando mudou.

## 3. Fluxo operacional

Comparando o `FeatureStatus` atual (`BACKLOG → DISCOVERY → SPECIFICATION → ARCHITECTURE → DEVELOPMENT → REVIEW → VALIDATION → DONE`) com o fluxo de referência de 10 estágios:

| Estágio de referência | Existe hoje? |
|---|---|
| Ideia/Necessidade | Não — toda necessidade já nasce como Feature completa; não há um "inbox" anterior a isso |
| Discovery | Sim (`DISCOVERY`) |
| Especificação | Sim (`SPECIFICATION`) |
| Priorização | **Não como estágio** — só como campo (`priority`), setável a qualquer momento, sem gate nem histórico |
| Arquitetura | Sim (`ARCHITECTURE`) |
| Desenvolvimento | Sim (`DEVELOPMENT`) |
| Review | Sim no enum, mas ver bug abaixo |
| Validação | Sim (`VALIDATION`) — o único estágio com uma Server Action dedicada (`recordValidation`) |
| Aprovação | **Não existe como estado separado** — colapsado dentro de "validação aprovada → DONE" |
| Release | Existe como **entidade** (`Release`/`ReleaseStatus`), mas desconectada do fluxo da Feature (ver abaixo) |

**Transições problemáticas** — este é o achado mais importante da auditoria: `updateFeatureStatus` (`src/app/features/actions.ts:19`) só checa `if (feature.status === status) return;`. Nenhuma outra validação. E o `StatusTracker` (`src/components/ui/StatusTracker.tsx`) renderiza **todos** os 8 estados como botões clicáveis, cada um disparando `updateFeatureStatus.bind(null, feature.id, status)` diretamente — inclusive o estado atual sendo desabilitado, mas todos os outros sete sempre disponíveis. Ou seja: **dá pra ir de Backlog direto pra Done num clique só, ou de Development de volta pra Backlog, sem confirmação e sem qualquer verificação.** O mesmo vale para `updateTaskStatus`.

**Informação perdida na transição:** o log de atividade é gerado com o texto fixo `"avançou de X para Y"` (`src/app/features/actions.ts:31`) — inclusive quando a mudança é uma regressão (Development → Backlog). O histórico literalmente pode descrever uma volta como um avanço.

**Bug concreto de exibição:** o `FeatureStepper` compacto (usado no Dashboard) mapeia `REVIEW` para o mesmo índice visual de `DEVELOPMENT` (`src/components/entities/FeatureStepper.tsx:14`) — uma Feature em Review aparece, nessa versão resumida, como se estivesse em Development. É perda real de informação, não só simplificação visual.

**Entidades que deveriam estar relacionadas e não estão:** Requirement↔Task, Artifact↔Task, Release↔status da Feature (uma Feature é atribuída a um Release estaticamente na criação; chegar a `DONE` não afeta o Release, e não existe ação para mudar `ReleaseStatus`).

**Relação excessivamente rígida (o inverso do "genérico demais"):** `Decision` liga a `Feature`/`Product` por FK direta e única (não polimórfica) — uma decisão não pode afetar duas Features ao mesmo tempo. Isso já está documentado no README como simplificação deliberada; a auditoria só reafirma que é uma limitação real quando se fala de decisões de verdade.

## 4. Execução vs registro

| Módulo | Avaliação | Observação |
|---|---|---|
| Dashboard | adequado | Calcula sinais reais (tasks bloqueadas/atrasadas, features aguardando validação, **decisões sem tasks geradas** via `generatedTasks: { none: {} }`) — não é só um espelho dos dados. Mas todo sinal que aponta um problema esbarra em uma ação que não existe (ex.: não dá pra criar a task que resolveria a "decisão sem desdobramento" direto do Dashboard, nem de lugar nenhum). |
| Product | superficial | Boa leitura (stats, tabs, activity), zero escrita — não dá pra criar produto, editar descrição/status, ou criar um Release daqui. |
| Feature | adequado | A melhor tela do produto para leitura de estado. "Conduzir" a Feature hoje é clicar em qualquer um de 8 botões sem guarda-corpo nenhum — não é conduzir, é teleportar. Nenhum campo narrativo é editável depois de criada. |
| Task | superficial | A única ação é mudar status. Sem criar, sem atribuir/reatribuir, sem editar título/descrição/prazo. Ao ficar `BLOCKED`, não há campo na UI para descrever o motivo — `blockedReason` só existe se veio do seed. |
| Meeting | ausente | 100% leitura. Não existe nenhuma forma de registrar que uma reunião aconteceu. |
| Decision | adequado | O melhor formulário de escrita do produto: contexto, motivo, alternativas, participantes, vínculo com Meeting/Feature/Product. Dois furos reais: autor não é obrigatório (nem no form, nem no schema), e uma decisão não consegue gerar uma Task (não existe ação de criar Task). |
| Artifact | superficial | Modelado como referência/link (proposital, sem upload — isso está correto). Mas é 100% leitura: não dá pra anexar um artifact novo quando o Linard terminar um diagrama. Também não se liga a Task. |
| Validation | superficial | É a peça mais bem desenhada estruturalmente (tentativas numeradas, critérios individuais, notas, auto-transição de status) — mas falha como gate de verdade (ver seção 7). |
| Activity | adequado | Reconstrói bem o que de fato registra — mas o que registra é bem menos do que a história rica do seed sugere (ver seção 8). |

## 5. Feature → Task

Simulando "tenho uma nova necessidade para o Nutria" contra o código atual:

1. **Onde ela nasce?** Não nasce em lugar nenhum do produto hoje — só no banco.
2. **Como vira Feature?** Não existe ação de criar Feature.
3. **Como é descrita?** Os campos existem e aparecem bem na tela, mas não há formulário — só é "descrita" no momento do insert direto.
4. **Como é priorizada?** Campo existe, sem ação de update nem histórico de repriorização.
5. **Como vira arquitetura?** `architectureNotes` é texto livre; Artifacts de arquitetura se ligam à Feature por FK solta, sem marcar "este é o artefato oficial desta fase".
6. **Como vira trabalho executável?** Não existe ação de criar Task — tasks só existem se vieram do seed.
7. **Como sabemos quem está fazendo?** `assigneeId` existe no schema e aparece na tela, mas não há nenhuma UI para atribuir ou reatribuir (`grep` por `assigneeId` em `src/app/**/*.tsx` não retorna nenhum uso fora de exibição).
8. **Como sabemos que está bloqueada?** Parcialmente — `status=BLOCKED` funciona e é exibido, mas o motivo (`blockedReason`) não pode ser inserido pela UI (a action `updateTaskStatus(taskId, status)` não recebe texto nenhum); só existe se veio do seed.
9. **Como sabemos que está pronta pra review?** Clicando em "Review" no StatusTracker — sem nenhuma verificação de que as tasks da fase anterior terminaram.
10. **Como sabemos que passou pela validação?** Aqui existe uma resposta real e razoavelmente boa — `ValidationRecord` com tentativa numerada — mas ver o furo na seção 7.
11. **Como sabemos que foi liberada?** Não é rastreado. `DONE` ≠ lançado. `Release`/`ReleaseStatus` existe mas não reage a nada que aconteça na Feature.

**Conclusão desta seção:** o fluxo Feature → Task tem buracos em quase todas as etapas *de criação/atribuição*, e nenhum buraco nas etapas *de leitura/exibição*. O padrão se repete: o produto sabe mostrar um estado, mas não sabe ajudar a chegar nele.

## 6. Meeting → Decision → Task

**Meeting → Decision:** funciona bem para leitura, e é o único trecho realmente cross-entity com escrita de verdade — o formulário de Decision deixa escolher a "Reunião de origem" (`src/app/decisions/new/page.tsx:104`).

**Decision → Feature:** funciona (FK opcional `featureId`, confirmado na validação técnica que o vínculo aparece corretamente e só quando existe de fato).

**Decision → Task:** **não existe.** O schema suporta (`Task.decisionId`), mas como não há nenhuma ação de criar Task, uma decisão não pode gerar uma tarefa através do produto — só via seed direto no banco.

**Consequência prática:** a simulação "tivemos uma reunião na terça e decidimos usar tal abordagem" tem, hoje, **zero pontos de entrada reais** — não dá pra registrar a Meeting (não tem formulário), e mesmo se desse, a Decision resultante não conseguiria virar Task sozinha. Essa é a cadeia que o próprio documento de discovery usa como exemplo central do processo da HMP (seção 5b do `discovery-architecture-v0.1.md`) — e é exatamente a cadeia que o produto, hoje, só consegue *mostrar*, nunca *produzir*.

## 7. Validation Gate

Pergunta do enunciado: *"o que impede uma Feature de simplesmente ser marcada como DONE sem realmente passar por validação?"* Resposta curta: **nada.**

| Item | Situação |
|---|---|
| Critérios | Existem (`AcceptanceCriteria`), marcáveis individualmente como Passed/Failed no formulário de validação |
| Testes | Não existe um conceito de execução de teste — só os critérios textuais |
| Responsável | `validatedById` é preenchido com o actor atual (cookie "atuando como", não autenticação) |
| Resultado | `overallResult` (Approved/Rejected) existe |
| Aprovação/reprovação | Existe e reflete automaticamente no status da Feature (Approved → `DONE`, Rejected → volta pra `DEVELOPMENT`) — isso é bem pensado |
| Histórico | `attemptNumber` incremental + `ActivityLog` — funciona bem |
| Retorno para desenvolvimento | Acontece automaticamente quando reprovado — ponto forte |
| Relação status da Feature ↔ resultado da validação | **Aqui está o furo.** Essa relação só é respeitada *se* o caminho for `recordValidation`. Mas o `StatusTracker` (seção 3) permite ir direto pra `DONE` a qualquer momento, de qualquer estado, sem passar pelo formulário de validação. Os dois controles convivem na mesma tela sem que um restrinja o outro. |

Segundo furo, dentro do próprio `recordValidation`: `overallResult` vem de um campo do formulário **independente** dos resultados individuais dos critérios (`src/app/features/actions.ts:39-78`) — nada impede marcar todos os critérios como `FAILED` e ainda assim submeter `overallResult: APPROVED`, levando a Feature a `DONE`.

## 8. Activity Log

Eventos que **realmente são gerados** ao usar o produto hoje (4 tipos, confirmados em `logActivity(...)` nos 3 arquivos de actions existentes):

- `feature.status_changed`
- `task.status_changed`
- `decision.created`
- `validation.approved` / `validation.rejected`

Eventos que o `EntityType` do log prevê mas que **nunca acontecem ao vivo**, porque não existe nenhuma mutação real para eles: criação/edição de `product`, `release`, `requirement`, `meeting`, `artifact`; atribuição/reatribuição de responsável; qualquer edição de campo de Feature além do status.

Isso importa porque o seed cria 20 eventos de histórico ricos e plausíveis (criação da Feature, vínculo de artifacts, criação de tasks, etc.) chamando `prisma.activityLog.create` diretamente — simulando uma riqueza de rastreabilidade que o produto, hoje, não tem como reproduzir sozinho. Para um visitante que só vê a demo, isso pode dar a impressão de um log mais completo do que realmente é.

## 9. UX

- **Um usuário novo saberia o que fazer?** Provavelmente não de primeira — a reação natural ao ver uma Feature seria tentar editar o contexto ou criar uma Task, e esses controles simplesmente não existem, sem nenhuma explicação de que são somente leitura.
- **Um membro da HMP saberia onde procurar uma informação?** Sim — esse é um ponto forte. Navegação lateral direta, uma entidade por item, e a página de Feature centraliza praticamente tudo num scroll só.
- **Quantidade de cliques é razoável?** Para ler, sim — talvez a melhor característica do produto hoje. Para agir além dos 4 caminhos existentes, a pergunta não se aplica: não há cliques possíveis porque a ação não existe.
- **Contexto é preservado durante a navegação?** Sim — breadcrumbs (Products → Nutria → Feature) funcionam de forma consistente em todas as entidades.
- **Dá pra entender o estado de uma Feature sem abrir várias páginas?** Sim, e isso já foi confirmado na validação técnica com print — é o maior acerto do protótipo.
- **O sistema orienta o próximo passo?** Parcialmente. O aviso textual da seção de Validation ("A Feature precisa estar em Validation para registrar um resultado") é um bom exemplo de orientação. O `StatusTracker`, ao tratar os 8 estados como igualmente clicáveis a qualquer momento, faz o oposto — não sugere qual é o próximo passo certo.

**Gargalo central:** a experiência de leitura é orientada e coesa; a experiência de escrita não é orientada porque quase não existe.

## 10. Débitos arquiteturais

Só os relevantes para a pergunta desta auditoria:

- Ausência de Server Actions de criação para Feature, Task, Meeting, Artifact, Product e Release — não é um bug pontual, é a lacuna estrutural central.
- Transições de status (Feature e Task) sem máquina de estados — qualquer estado aceita ir para qualquer outro, sem pré-condição.
- `recordValidation` não é o único caminho para `DONE`; convive sem coordenação com o `StatusTracker`.
- `FeatureStepper` compacto perde a distinção visual entre `REVIEW` e `DEVELOPMENT`.
- Texto de log de status hardcoded como "avançou", mesmo em regressões.
- Nenhum vínculo Artifact↔Task ou Requirement↔Task — limita a rastreabilidade fina que o discovery doc chama de "requisito fundamental".
- `getCurrentActor` é só atribuição (nome no log), não autorização — qualquer pessoa "atuando como" qualquer pessoa pode executar qualquer uma das 4 ações, o que diverge do desenho de papéis do próprio discovery doc (ex.: validação hoje não é exclusiva de quem tem papel de Produto).

## 11. O que NÃO construir agora

- **Motor de workflow configurável / máquina de estados genérica** — tentador dado o achado da seção 3, mas construir isso antes de saber, por uso real, quais transições a HMP de fato proíbe seria resolver um problema hipotético.
- **RBAC/permissões por papel** — o achado da seção 10 (qualquer actor faz qualquer ação) pede isso, mas já está explicitamente fora do MVP no discovery doc; validar primeiro se os 3 papéis vão mesmo usar o sistema antes de arquitetar permissões.
- **Editor de diagramas / upload de arquivo em Artifact** — já descartado deliberadamente; a auditoria não encontrou motivo pra revisitar.
- **Notificações** (ex.: "Pedro foi atribuído a uma task") — sem atribuição funcionando ainda, notificar sobre ela é construir em cima de algo que não existe.
- **Kanban com drag-and-drop para Tasks** — visualmente sedutor, mas resolve um problema de UX antes do problema mais básico (hoje não dá pra criar uma Task).
- **Generalizar Decision/Artifact para um vínculo polimórfico N–N** — o discovery doc já cogita isso pra Fase 2; não vale generalizar sem 2–3 casos reais de "uma decisão afeta duas Features" aparecerem no uso.
- **Fluxo formal separado para Aprovação e Release** — vale esperar o uso real mostrar se "aprovado" e "lançado" precisam mesmo ser dois momentos distintos pra HMP, ou se `DONE` já basta na prática.

## 12. Recomendações para V0.2

Ordenadas por dependência (o que destrava o quê), não por nota ou ranking.

**1. Implementar as Server Actions de criação que faltam** — pelo menos `createFeature`, `createTask`, `createMeeting`, `createArtifact`. É o item mais fundamental: sem isso, qualquer outra melhoria (gates, permissões, notificações) segue sendo teórica, porque o produto continua sem conseguir representar um dia real de trabalho. Afeta: Feature, Task, Meeting, Artifact. Tipo de mudança: backend (Server Actions) + UX (formulários) — o schema já suporta, não precisa mudar modelo.

**2. Fechar o gate de Validation de verdade** — depende do item 1 existir para fazer sentido plenamente, mas pode ser feito antes: (a) fazer `recordValidation` ser o único caminho legítimo para `DONE` (o `StatusTracker` não deveria oferecer "Done" como destino livre), e (b) impedir `overallResult: APPROVED` se algum critério estiver `FAILED`. Afeta: Feature, ValidationRecord, AcceptanceCriteria. Tipo de mudança: backend (regra de negócio) + UX pequena (StatusTracker precisa saber quais transições são permitidas a partir de onde).

**3. Ligar Decision → Task** — um botão "gerar tarefa a partir desta decisão" na tela de Decision, criando a Task já com `decisionId` preenchido. Depende do item 1 (precisa existir `createTask` primeiro). Fecha o loop Meeting → Decision → Task que hoje só existe no seed. Afeta: Decision, Task. Tipo de mudança: backend + UX.

**4. Corrigir a perda de informação no `FeatureStepper` compacto** (Review comendo o lugar de Development) e o texto hardcoded "avançou" no log. Não depende de nada. Tipo de mudança: UX/correção pontual.

**5. Decidir — como uma Decision de verdade dentro do próprio HMP OS — se Priorização e Aprovação merecem virar estados formais do `FeatureStatus`, ou se continuam informais.** Isso muda o enum (modelo), então vale esperar os Testes 3 e 4 do roteiro humano (`user-validation-v0.1.md`) confirmarem se a ausência desses estados realmente incomoda no uso prático, antes de alterar o schema.
