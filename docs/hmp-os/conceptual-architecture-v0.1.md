# HMP OS — Conceptual Architecture v0.1

> Proposta estrutural concreta do HMP OS: como o sistema funcionará na prática.
> Constrói sobre e refina o [`discovery-architecture-v0.1.md`](./discovery-architecture-v0.1.md) — onde os dois documentos divergem, este prevalece, por representar uma camada de detalhe maior.
> Ainda **sem código e sem stack técnica escolhida**. O objetivo é uma proposta que Heitor, Linard e Pedro possam criticar, alterar e validar como primeira arquitetura estrutural do produto.

**Como ler as marcações:** `[A VALIDAR]` = decisão proposta e assumida como recomendação de trabalho, mas que a equipe deve confirmar, ajustar ou rejeitar. Não é uma pergunta em aberto — é uma escolha feita, sinalizada para revisão. Todas as demais decisões neste documento devem ser lidas como propostas firmes, não hipóteses soltas.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Princípios](#2-princípios)
3. [Hierarquia](#3-hierarquia)
4. [Entidades](#4-entidades)
5. [Relações](#5-relações)
6. [Feature](#6-feature)
7. [Task](#7-task)
8. [Workflow](#8-workflow)
9. [Roles](#9-roles)
10. [Meetings](#10-meetings)
11. [Decisions](#11-decisions)
12. [Artifacts](#12-artifacts)
13. [Validation](#13-validation)
14. [ActivityLog](#14-activitylog)
15. [Exemplo completo do Nutria](#15-exemplo-completo-do-nutria)
16. [Dashboard](#16-dashboard)
17. [MVP](#17-mvp)
18. [Roadmap futuro](#18-roadmap-futuro)
19. [Pontos ainda sujeitos à validação](#19-pontos-ainda-sujeitos-à-validação)

---

## 1. Visão geral

O HMP OS é o **sistema operacional interno que transforma uma necessidade de produto em uma entrega de software validada e rastreável**. Não é um gerenciador de tarefas — Trello, Notion, Jira e Asana são referências conceituais, não o modelo a copiar.

O sistema conecta, com rastreabilidade em cada etapa:

```
Pesquisa → Decisão → Especificação → Priorização → Arquitetura → Desenvolvimento → Testes → Validação → Produção
```

Este documento assume as entidades centrais já propostas em v0.1 (Feature como unidade de valor, Task como unidade de execução, Decision/Meeting/Artifact como camada de conhecimento) e as leva a um nível concreto: estrutura de campos, estados, responsáveis, permissões e comportamento esperado — suficiente para visualizar o sistema funcionando, sem ainda escrever código.

---

## 2. Princípios

Os princípios abaixo governam toda escolha feita neste documento:

1. **Feature é a unidade de valor; Task é a unidade de execução.** Nunca se misturam no mesmo workflow.
2. **Toda decisão relevante é registrada e vinculada** ao que ela afeta — não existe decisão "solta".
3. **Rastreabilidade não é opcional.** ActivityLog existe desde o MVP, não é evolução futura.
4. **Papéis são independentes de pessoas.** Product/Architecture/Engineering são funções, não sinônimos de Heitor/Linard/Pedro.
5. **Workflows são fixos agora, configuráveis apenas quando um segundo caso real exigir.** Não construímos um motor de workflow genérico especulativamente.
6. **Artifacts referenciam, não hospedam.** Diagramas e documentos vivem no Drive/Figma/GitHub; o HMP OS aponta para eles com contexto.
7. **Simplicidade antes de completude.** Cada entidade nova precisa justificar seu custo (uma tabela, uma tela, uma decisão de UX).
8. **A arquitetura se prepara para IA sem construir IA agora** — o modelo de dados deve conseguir exportar contexto estruturado no futuro, mas nada disso é MVP.
9. **Evolução guiada por uso real** — o Nutria é o primeiro "cliente interno" do HMP OS (Fase 5); funcionalidades além do MVP só se justificam pelo uso, não por antecipação.

---

## 3. Hierarquia

### Modelo recomendado

```
Company (HMP)
 └─ Product (Nutria | Exomia | HMP OS)
     └─ Feature ──(vínculo opcional, não hierárquico)──▶ Release
         └─ Task
             └─ Task (subtask, via parent_task_id)
```

Sem camada de **Workspace** e sem camada de **Project** como níveis hierárquicos obrigatórios. Em vez de Project, uma entidade leve e não-hierárquica — **Release** — resolve a necessidade de organizar iniciativas maiores sem recriar um contêiner rígido.

### Por que cada nível existe

| Nível | Por que existe | O que representa | Quando é usado | O que contém | Como se relaciona |
|---|---|---|---|---|---|
| **Company** | Ancora múltiplos Produtos sob uma organização; custa uma linha, evita hardcoding de "HMP" | A organização legal/operacional | Hoje quase invisível na UI (só existe uma); passa a importar se surgir uma segunda empresa ou necessidade de isolar dados entre times | Nome; futuramente configurações/billing se necessário | 1—N Product |
| **Product** | Nutria e Exomia são vertentes com roadmap, usuários e prioridades próprias; o HMP OS também é um produto (dogfooding) | Algo que a HMP constrói e mantém, com identidade própria | Sempre — toda Feature pertence a exatamente um Product | Nome, descrição, status (ativo/pausado/descontinuado) | N—1 Company, 1—N Feature |
| **Feature** | Unidade central de valor (ver seção 6) | Um problema/necessidade de produto do início à produção | Sempre que há trabalho de produto com um "porquê" claro | Ver seção 6 | N—1 Product, 0—1 Release, 1—N Task |
| **Release** | Responde à necessidade de organizar iniciativas maiores sem reintroduzir um "Project" rígido | Um agrupamento de planejamento/entrega — ex.: "Nutria v2.0", "Ciclo Q3 2026" | Opcional — só quando faz sentido comunicar/planejar um conjunto de Features junto | Nome, data-alvo (opcional), descrição, status (planejado/em andamento/lançado) | 1—N Feature (uma Feature tem 0 ou 1 Release) |
| **Task** | Unidade de execução técnica (ver seção 7) | Trabalho de engenharia concreto | Dentro de uma Feature (o caso comum) ou, para tarefas técnicas sem valor de produto direto, sem Feature (ver `[A VALIDAR]` abaixo) | Ver seção 7 | N—1 Feature (nullable), 0—N Task (subtask) |

### Por que não Workspace agora

Um `Workspace` só ganha sentido quando é preciso **isolar** dados/permissões entre grupos dentro da mesma Company — por exemplo, se a Exomia um dia tiver equipe própria que não deve ver o backlog interno do Nutria. Hoje as três pessoas veem tudo; `Company` já cumpre o papel de fronteira única. Reintroduzir `Workspace` é um passo de arquitetura simples (uma tabela nova entre Company e Product) quando essa necessidade for real — não há custo de adiar. `[INFORMAÇÃO NECESSÁRIA — já registrada em v0.1]`: se a Exomia terá equipe própria.

### Por que não Project — e como organizar iniciativas maiores sem ele

Nos exemplos reais do briefing (o fluxo do Plano Alimentar, o fluxo de reunião), "Projeto" nunca aparece — só Produto e Feature. Forçar uma camada hierárquica obrigatória entre os dois adicionaria um nível que, hoje, não tem conteúdo próprio: toda Feature já sabe a que Produto pertence, e a HMP não relatou precisar agrupar Features em iniciativas *fixas e exclusivas* (uma Feature pertencer a exatamente um "projeto", nunca a mais de um).

`Release` resolve o problema real por trás de "Project" — comunicar e planejar um conjunto de entregas — sem os efeitos colaterais de uma hierarquia rígida:

- Uma Feature pode existir **sem** Release (trabalho contínuo, não amarrado a uma entrega específica).
- Um Release agrupa Features de **um único Product** (não é um nível acima de Product; é uma etiqueta de planejamento dentro dele).
- Se, no futuro, um Produto precisar de frentes paralelas organizadas de forma mais rígida (ex.: "Nutria Web" vs. "Nutria Mobile" como sub-produtos com equipes distintas), a resposta provável não é reintroduzir "Project" — é avaliar se aquilo virou um **Product** novo.

`[A VALIDAR]` Nome exato do conceito — `Release`, `Milestone` ou `Cycle` podem carregar conotações diferentes (entrega técnica vs. meta de planejamento vs. período de tempo). A mecânica (vínculo opcional, não-hierárquico, 1 Feature → 0 ou 1 agrupamento) é a parte proposta com confiança; o nome não.

### Subtask

Confirmado: **não** existe entidade `Subtask` separada. Uma subtarefa é uma `Task` com `parent_task_id` preenchido — mesmos campos, mesmo workflow (seção 8), apenas aninhada. `[A VALIDAR]` se a conclusão do Task-pai deve exigir que todos os filhos estejam `DONE` (bloqueio automático) ou se isso é apenas indicativo.

---

## 4. Entidades

Dicionário de entidades — forma conceitual de cada uma (não é schema de banco de dados, é o suficiente para visualizar um registro real).

| Entidade | Campos principais |
|---|---|
| **Company** | `id`, `name` |
| **Product** | `id`, `company_id`, `name`, `description`, `status` (active / paused / discontinued) |
| **Release** | `id`, `product_id`, `name`, `target_date?`, `status` (planned / in_progress / shipped) |
| **Feature** | ver seção 6 |
| **Task** | ver seção 7 |
| **Person** | `id`, `name`, `email`, `active` |
| **Role** | `id`, `name` (Product / Architecture / Engineering) |
| **Meeting** | `id`, `title`, `date`, `participants[Person]`, `agenda`, `notes`, `related_artifacts[Artifact]` |
| **Decision** | `id`, `title`, `context`, `decision`, `reason`, `alternatives?`, `author_id`, `participants[Person]`, `decided_at`, `meeting_id?`, `affects[Feature\|Task\|Product]`, `generated_tasks[Task]`, `related_artifacts[Artifact]` |
| **Artifact** | `id`, `type` (C4 / ClassDiagram / SequenceDiagram / MarketResearch / Reference / Document / Spec / TestReport / Other), `title`, `url`, `version`, `related_entities[Feature\|Decision\|Meeting\|Task]`, `created_by`, `created_at` |
| **Requirement** | `id`, `feature_id`, `description`, `priority` (Must / Should / Could), `status` (proposed / approved / implemented / tested), `source?` |
| **AcceptanceCriteria** | `id`, `feature_id`, `description`, `status` (pending / passed / failed), `validated_by?`, `validated_at?` |
| **ValidationRecord** | `id`, `feature_id`, `attempt_number`, `criteria_results[AcceptanceCriteria→pass\|fail]`, `overall_result` (approved / rejected), `issues_found?`, `fixes[Task]`, `validated_by`, `validated_at` |
| **ActivityLog** | `id`, `entity_type`, `entity_id`, `event_type`, `actor_id`, `timestamp`, `payload` (before/after ou descrição) |

Notas de design que evitam entidades redundantes:

- Não existe entidade `Reference` separada de `Artifact` — é um `Artifact.type = Reference/MarketResearch`.
- Não existe `Assignment` genérico N—N no MVP — `Feature` tem três campos de responsabilidade nomeados (`owner_id`, `architect_id`, `tech_lead_id`, ver seção 6) e `Task` tem `assignee_id`. Um modelo RACI genérico é adiado até haver necessidade real (ver seção 19).
- Não existe `Subtask` — é `Task.parent_task_id`.
- Não existe `Project` — é `Release`, com semântica diferente (seção 3).

---

## 5. Relações

| De | Para | Cardinalidade | Observação |
|---|---|---|---|
| Company | Product | 1—N | |
| Product | Release | 1—N | |
| Product | Feature | 1—N | |
| Release | Feature | 1—N | vínculo opcional, não-hierárquico |
| Feature | Task | 1—N | |
| Feature | Task | 0—1 | `[A VALIDAR]` Task sem Feature, para chores de engenharia pura (ex.: "atualizar dependência X") |
| Task | Task | 0—N | subtask (`parent_task_id`) |
| Task | Task | N—N | `depends_on` / `blocks` — relação distinta da de subtask |
| Feature | Person | N—1 (×3) | `owner_id`, `architect_id`, `tech_lead_id` |
| Task | Person | N—1 (×3) | `assignee_id`, `created_by`, `reviewer_id?` |
| Feature | Artifact | N—N | polimórfico — Artifact também se liga a Decision, Meeting, Task |
| Feature | Requirement | 1—N | |
| Feature | AcceptanceCriteria | 1—N | |
| Feature | ValidationRecord | 1—N | histórico de tentativas, nunca sobrescrito |
| Feature | Decision | N—N | "afetada por" |
| Meeting | Decision | 1—N | |
| Meeting | Task | 1—N | follow-ups que são ações diretas, sem decisão formal no meio |
| Decision | Task | N—N | "gerou" — tarefas que nascem diretamente de uma decisão |
| ActivityLog | qualquer entidade | N—1 | polimórfico, gerado automaticamente, nunca editado manualmente |

---

## 6. Feature

### Refinamento da estrutura proposta

A estrutura original (Context, Problem, Objective, User Need, References, Requirements, Priority, Functional Flow, Decisions, Architecture, Artifacts, Tasks, Tests, Validation, History, Release) está correta na intenção, mas mistura dois tipos de coisa: **campos que a Feature possui diretamente** e **coleções que são, na verdade, vínculos com outras entidades já modeladas**. Separar isso evita duplicar conceitos:

- `References` **não é um campo próprio** — é uma visão filtrada de `Artifacts` (`type = Reference/MarketResearch`).
- `Decisions` **não é um campo a preencher** — não se "escreve uma decisão dentro de uma Feature"; cria-se um `Decision` que referencia a Feature. A seção "Decisions" na tela de uma Feature é uma consulta, não um formulário.
- `Architecture`, na parte de diagramas, é a mesma coleção de `Artifacts` (`type = C4/ClassDiagram/SequenceDiagram`) — só a parte textual (o raciocínio da solução) é campo próprio (`architecture_notes`).
- `Tests` = `AcceptanceCriteria` + opcionalmente um `Artifact` do tipo `TestReport`.
- `Validation` = coleção de `ValidationRecord` (seção 13).
- `History` = consulta filtrada de `ActivityLog` por esta Feature (seção 14) — nunca editada manualmente.
- `Tasks` = relação já modelada (seção 5).
- `Release` = vínculo opcional já modelado (seção 3).

Ou seja: **uma única relação com `Artifact` cobre References, diagramas de arquitetura e specs** — a UI é quem filtra por tipo para mostrar seções diferentes. Isso evita três relações redundantes fazendo o mesmo trabalho.

### Campos diretos da Feature

| Campo | Propósito | Tipo | Responsável | Preenchido em | Obrigatório? |
|---|---|---|---|---|---|
| `title` | Nome curto identificador | texto curto | Owner | BACKLOG | Sim |
| `product_id` | A qual Produto pertence | FK Product | Owner | BACKLOG | Sim |
| `context` | Situação/cenário que originou a necessidade | texto longo | Owner | DISCOVERY | Sim a partir de DISCOVERY |
| `problem` | Problema específico, de forma falseável | texto longo | Owner | DISCOVERY | Sim a partir de DISCOVERY |
| `user_need` | A necessidade na perspectiva do usuário final (ex.: citação/job-to-be-done) | texto curto | Owner | DISCOVERY | Recomendado, não bloqueante |
| `objective` | Como se parece o sucesso, idealmente mensurável | texto longo | Owner | SPECIFICATION | Sim a partir de SPECIFICATION |
| `priority` | Prioridade relativa entre Features do mesmo Produto | enum (Must/Should/Could ou P0–P3) | Owner | PRIORITIZATION | Sim a partir de PRIORITIZATION |
| `status` | Estado atual no ciclo de vida (seção 8.1) | enum | derivado do workflow | sempre | Sim |
| `owner_id` | Responsável pela visão de produto | Person (Role=Product) | Owner | BACKLOG | Sim |
| `architect_id` | Responsável pela arquitetura | Person (Role=Architecture) | Owner ou Architect | ARCHITECTURE | Sim a partir de ARCHITECTURE |
| `tech_lead_id` | Responsável pela execução técnica | Person (Role=Engineering) | Architect | DEVELOPMENT | Sim a partir de DEVELOPMENT |
| `functional_flow` | Como a funcionalidade se comporta do ponto de vista do usuário | texto estruturado (pode referenciar Artifacts) | Architect, traduzindo o Owner | SPECIFICATION | Sim a partir de SPECIFICATION |
| `architecture_notes` | Raciocínio/resumo da solução técnica | texto estruturado | Architect | ARCHITECTURE | Sim a partir de ARCHITECTURE |
| `release_id` | Agrupamento de entrega | FK Release, opcional | Owner | PRIORITIZATION ou depois | Opcional |

### Coleções (vínculos, não campos de formulário)

| Coleção exibida na tela da Feature | Origem real | O que mostra |
|---|---|---|
| Requirements | `Requirement` (1—N) | Lista de requisitos, com prioridade e status próprios |
| References | `Artifact` filtrado por tipo (Reference/MarketResearch) | Pesquisas e referências de mercado/concorrentes |
| Architecture / Diagrams | `Artifact` filtrado por tipo (C4/ClassDiagram/SequenceDiagram) + campo `architecture_notes` | Solução técnica |
| Decisions | `Decision` (N—N, "afeta") | Decisões que impactaram esta Feature, com data e autor |
| Tasks | `Task` (1—N) | Trabalho de execução, com progresso agregado |
| Tests | `AcceptanceCriteria` (1—N) + `Artifact` tipo TestReport | Critérios de aceite e evidência de teste |
| Validation | `ValidationRecord` (1—N) | Histórico de tentativas de validação (seção 13) |
| History | `ActivityLog` filtrado por esta Feature | Linha do tempo completa e imutável |

`[A VALIDAR]` Exatamente três papéis nomeados (`owner_id`/`architect_id`/`tech_lead_id`) cobre a realidade — funciona bem para os três membros atuais, mas talvez precise de um quarto papel (`qa_id`?) se testes técnicos ganharem um responsável distinto de quem desenvolve.

---

## 7. Task

### Campos

| Campo | Propósito | Tipo |
|---|---|---|
| `title` | Nome curto | texto |
| `description` | O que precisa ser feito | texto longo |
| `feature_id` | A qual Feature pertence | FK Feature, **nullable** (ver `[A VALIDAR]` seção 5) |
| `parent_task_id` | Subtask — task-pai, se houver | FK Task, opcional |
| `depends_on[Task]` | Dependências — tasks que precisam terminar antes desta | N—N Task |
| `status` | Estado no workflow (seção 8.2) | enum |
| `priority` | Prioridade — herda da Feature por padrão, pode ser sobrescrita | enum |
| `due_date` | Prazo | data, opcional |
| `assignee_id` | Quem executa | Person |
| `created_by` | Quem criou | Person |
| `reviewer_id` | Quem revisa | Person, opcional (ver `[A VALIDAR]` abaixo) |

### Quem faz o quê

- **Quem cria**: normalmente o Architect, ao quebrar a arquitetura em trabalho executável (fase ARCHITECTURE/DEVELOPMENT); Engineering também pode criar Tasks durante o desenvolvimento, ao descobrir trabalho não previsto; qualquer um dos três papéis pode abrir uma Task avulsa (sem Feature) para um chore técnico.
- **Quem executa**: `assignee_id` — hoje, na prática, majoritariamente Pedro.
- **Quem revisa**: `reviewer_id`, opcional. `[A VALIDAR]` — com um único desenvolvedor hoje, revisão de código por pares não é sempre viável; o campo existe mas pode ficar vazio, com o próprio Architect revisando por aderência à arquitetura (não ao código linha a linha). Ganha peso real quando a equipe de engenharia crescer.
- **Quem encerra**: o assignee move para `REVIEW`; quem fecha para `DONE` é o `reviewer_id` se houver, ou o próprio assignee na ausência de um revisor definido.

---

## 8. Workflow

### 8.1 Ciclo de vida da Feature

```
BACKLOG → DISCOVERY → SPECIFICATION → PRIORITIZATION → ARCHITECTURE → DEVELOPMENT → REVIEW → VALIDATION → APPROVED → RELEASED
                                                                                         ↑___________________|
                                                                                         (reprovado: volta para DEVELOPMENT)

Estados laterais (a partir de quase qualquer estado ativo): ON_HOLD, DISCARDED
```

A proposta original do briefing somada à revisão desta rodada: **`PRIORITIZATION` como estado próprio** faz sentido — múltiplas Features competem por atenção, e "especificado mas ainda não priorizado" é uma situação real que merece um estado, não só um campo. Da mesma forma, **separar `APPROVED` de `RELEASED`** é necessário para responder "qual versão foi para produção" (o requisito fundamental do projeto) — validado funcionalmente não é o mesmo que estar em produção.

**Nota de nomenclatura**: o `REVIEW` neste nível é diferente do `REVIEW` de Task (seção 8.2). Aqui é uma revisão agregada — Owner e Architect conferem se o que foi construído confere com o que foi especificado/arquitetado — não uma revisão de código linha a linha.

| Estado | Objetivo | Entrada | Saída | Responsável | Critério para avançar | Possíveis bloqueios |
|---|---|---|---|---|---|---|
| BACKLOG | Necessidade capturada, ainda não avaliada | Ideia/pedido registrado | → DISCOVERY | Owner | Alguém decide investigar | — (estado de espera) |
| DISCOVERY | Entender problema, contexto e necessidade real | Retirada do backlog | `context`/`problem`/`user_need` preenchidos | Owner | Problema está claro e vale a pena resolver | Falta de dados de mercado/cliente |
| SPECIFICATION | Definir o que exatamente será construído | Problema validado | `objective`, Requirements e `functional_flow` definidos | Owner (fluxo funcional com apoio do Architect) | Requisitos e fluxo aprovados pelo Owner | Requisitos ambíguos ou conflitantes |
| PRIORITIZATION | Decidir quando será feito frente a outras Features | Especificação pronta | `priority` definida | Owner | Prioridade atribuída e capacidade disponível no horizonte | Disputa de prioridade, falta de capacidade |
| ARCHITECTURE | Traduzir especificação em solução técnica | Priorizada, capacidade disponível | `architecture_notes` + diagramas (Artifacts) + `architect_id`/`tech_lead_id` definidos | Architect | Arquitetura revisada e aceita pelo Owner | Complexidade não prevista, dependências externas |
| DEVELOPMENT | Construir a solução | Arquitetura definida, Tasks criadas | Todas as Tasks da Feature em `DONE` | Engineering (tech_lead) | 100% das Tasks concluídas | Bloqueios técnicos, dependências, escopo mal dividido |
| REVIEW | Conferir se o construído confere com o especificado/arquitetado | Desenvolvimento concluído | Owner + Architect concordam que está pronto para validação formal | Architect + Owner | Divergências resolvidas | Divergência entre construído e especificado |
| VALIDATION | Confirmar que a Feature resolve o problema e atende aos critérios de aceite | Review aprovado | `ValidationRecord` com resultado | Owner | Todos os AcceptanceCriteria passam | Critério de aceite falha → volta para DEVELOPMENT (seção 13) |
| APPROVED | Validado, pronto para produção | Validação aprovada | Aguardando janela/processo de release | Owner | Decisão de liberar (pode ser imediata) | Dependência de outras Features/infra |
| RELEASED | Em produção | Deploy realizado | Estado terminal | Engineering (tech_lead) confirma o deploy | — | — |
| ON_HOLD | Pausada por decisão explícita | De qualquer estado ativo | Retorna ao estado de onde saiu | Owner | Decisão de retomar | — |
| DISCARDED | Descartada, não será feita | De qualquer estado ativo | Estado terminal | Owner | — | — |

`[A VALIDAR]` `ON_HOLD` e `DISCARDED` não estavam no briefing original — são adicionados aqui por realismo (toda Feature pode ser pausada ou descartada); confirmar se são suficientes ou se `DISCARDED` precisa de um campo de motivo obrigatório.

### 8.2 Fluxo da Task

A proposta original (`TODO → IN PROGRESS → BLOCKED → REVIEW → DONE`) trata `BLOCKED` como parte da sequência linear. Refinamento proposto: **`BLOCKED` é um estado lateral**, não um passo do meio — uma Task pode ficar bloqueada a partir de `TODO` ou `IN PROGRESS`, e volta para o estado de onde saiu quando o bloqueio é removido.

```
TODO → IN PROGRESS → REVIEW → DONE
  ↑          ↑
  └── BLOCKED ┘   (lateral: entra de TODO ou IN PROGRESS, volta para o mesmo estado)
```

| Estado | Objetivo | Responsável para avançar | Critério para avançar |
|---|---|---|---|
| TODO | Definida, ainda não iniciada | Assignee | Assignee começa o trabalho |
| IN PROGRESS | Em execução | Assignee | Trabalho concluído, pronto para revisão |
| BLOCKED (lateral) | Sinaliza impedimento externo | Assignee (marca) / quem resolve o bloqueio (desbloqueia) | Bloqueio removido |
| REVIEW | Verificar o trabalho antes de fechar | Reviewer (ou assignee, se não houver reviewer) | Aprovado |
| DONE | Concluída | Reviewer ou assignee | — (estado terminal) |

**Dependências** (`depends_on`) são distintas de `BLOCKED`: uma Task pode depender de outra sem estar formalmente bloqueada ainda (só não pode começar antes). `BLOCKED` é o sinal ativo de "estou impedido agora", com um motivo textual; `depends_on` é estrutural e pode ser checado automaticamente (a UI pode impedir mover para `IN PROGRESS` se uma dependência não está `DONE` — comportamento a confirmar em Fase 2).

### 8.3 Como os dois fluxos se conectam

O avanço de fase de uma Feature depende de dois sinais combinados: **(a)** as Tasks daquela fase concluídas e **(b)** uma decisão (formal via `Decision`, ou informal, um clique do Owner/Architect) confirmando o avanço. Isso é o "phase gate" que liga execução e decisão. `[A VALIDAR]` se todo avanço de fase precisa de uma `Decision` formal registrada, ou só os avanços considerados críticos (ex.: `DISCOVERY → SPECIFICATION` provavelmente sim; `DEVELOPMENT → REVIEW` provavelmente é automático quando as Tasks fecham, sem burocracia extra).

---

## 9. Roles

Papel → Responsabilidades → Permissões → Ações de workflow. Proposta de trabalho, não definitiva.

| Role | Pessoa hoje | Responsabilidades | Permissões | Ações de workflow que pode disparar |
|---|---|---|---|---|
| **Product** (Product/Business/Validation) | Heitor | Visão de produto, pesquisa de mercado, priorização, validação funcional, aprovação | Criar Feature; editar `context`/`problem`/`objective`/`user_need`/`priority`; criar Requirement; criar Decision; criar Meeting; aprovar/reprovar em VALIDATION | `BACKLOG→DISCOVERY`, `DISCOVERY→SPECIFICATION`, `SPECIFICATION→PRIORITIZATION`, `VALIDATION→APPROVED` (ou reprovar `→DEVELOPMENT`) |
| **Architecture** (Architecture/Systems) | Linard | Estruturar arquitetura, atualizar diagramas, revisar especificações técnicas, traduzir requisitos em fluxo funcional | Editar `functional_flow`/`architecture_notes`; criar/vincular Artifacts técnicos; criar Task; atribuir `tech_lead_id`; co-participar do REVIEW de Feature | `PRIORITIZATION→ARCHITECTURE`, `ARCHITECTURE→DEVELOPMENT`, co-aprovação em `REVIEW` |
| **Engineering** (Engineering/Development) | Pedro | Executar Tasks, atualizar desenvolvimento, registrar implementação, executar testes técnicos | Criar/editar Task; mudar status de Task; vincular Artifacts técnicos (test reports); confirmar deploy | `DEVELOPMENT→REVIEW` (quando as Tasks fecham), `APPROVED→RELEASED` |

Todos os três papéis têm **leitura total** do sistema — não há necessidade de restringir visibilidade com uma equipe de 3 pessoas confiáveis. As permissões acima são sobre **escrita e transições de estado**, não sobre visualização.

---

## 10. Meetings

### Estrutura

```
Meeting
├── agenda            (o que será discutido)
├── participants       (Person[])
├── notes              (texto ou link para Artifact)
├── decisions          (Decision[], geradas nesta reunião)
├── features           (Feature[], discutidas — derivado das Decisions/Tasks vinculadas)
├── tasks              (Task[], ações diretas sem decisão formal — os "follow-ups")
├── artifacts          (Artifact[], referenciados na discussão)
```

`follow-ups` não é uma entidade nova: um follow-up que é uma ação concreta **é uma Task** (`meeting_id` preenchido, `feature_id` opcional). Um follow-up que é só um ponto em aberto para a próxima reunião fica como texto simples na próxima `agenda`.

### Exemplo real: reunião semanal da HMP

**Meeting** — "Reunião Semanal HMP — 15/09/2026"
- `participants`: Heitor, Linard, Pedro
- `agenda`: revisar andamento do Nutria; decidir prioridade do Plano Alimentar
- `notes`: discussão sobre a pesquisa da Dietbox; proposta de incluir cálculo automático de macros

```
Meeting (15/09/2026)
  → Decision: "Priorizar Plano Alimentar com cálculo automático de macros"
      → affects: Feature "Elaboração do Plano Alimentar"
  → Task (follow-up direto, sem decisão formal): "Pedro validar viabilidade técnica de
    biblioteca de cálculo nutricional até sexta" (meeting_id set, feature_id ainda null)
  → Artifact vinculado: link da pesquisa Dietbox (type=MarketResearch)
```

Isso demonstra o fluxo `Meeting → Decision → Feature → Task` pedido: a reunião gera uma Decision, a Decision afeta uma Feature, e tanto a Decision quanto a própria Meeting podem gerar Tasks diretamente.

---

## 11. Decisions

### Estrutura

```
Decision
├── context               (situação que motivou a decisão)
├── decision              (a escolha feita, em uma frase clara)
├── reason                (por que essa escolha)
├── alternatives          (o que mais foi considerado, opcional)
├── author_id             (quem propôs/decidiu)
├── participants          (Person[], quem estava envolvido)
├── decided_at            (data)
├── meeting_id            (opcional — decisões também acontecem fora de reunião)
├── affects               (Feature | Task | Product, N—N)
├── generated_tasks       (Task[], ações diretas resultantes)
└── related_artifacts     (Artifact[], o que embasou a decisão)
```

### Exemplo real

> **Decision**: "Plano Alimentar incluirá cálculo automático de macronutrientes"
> - `context`: pesquisa mostrou que nutricionistas gastam tempo calculando macros manualmente; a Dietbox oferece isso como diferencial.
> - `reason`: reduzir tempo de criação do plano e aumentar valor percebido do Nutria.
> - `alternatives`: manter cálculo manual (rejeitado — não diferencia o produto); integrar API externa de nutrição (considerado, adiado por custo).
> - `author_id`: Heitor · `participants`: Heitor, Linard, Pedro · `decided_at`: 15/09/2026
> - `meeting_id`: Reunião Semanal HMP — 15/09/2026
> - `affects`: Feature "Elaboração do Plano Alimentar"
> - `generated_tasks`: "Pedro validar viabilidade técnica de biblioteca de cálculo nutricional"

Essa estrutura responde diretamente: **quando** (`decided_at`), **por quê** (`context` + `reason`), **quem participou** (`participants`), **qual Feature foi afetada** (`affects`) e **quais tarefas foram geradas** (`generated_tasks`) — a decisão nunca fica "solta".

---

## 12. Artifacts

### Estrutura

```
Artifact
├── type            (C4 | ClassDiagram | SequenceDiagram | MarketResearch | Reference |
│                     Document | Spec | TestReport | Other)
├── title
├── url             (aponta para Drive/Figma/Miro/GitHub/etc. — HMP OS não hospeda conteúdo)
├── version         (rótulo simples, ex.: "v2 — revisado após feedback")
├── related_entities (Feature | Decision | Meeting | Task, N—N)
├── created_by
└── created_at
```

### Exemplo de contexto (Feature → cadeia de Artifacts)

```
Feature "Elaboração do Plano Alimentar"
 ├─ Artifact (C4)                → diagrama de contexto do módulo de planos
 ├─ Artifact (ClassDiagram)      → modelagem das entidades PlanoAlimentar/Refeicao/Macro
 ├─ Artifact (MarketResearch)    → pesquisa comparativa com a Dietbox
 └─ Artifact (Document)          → documento de requisitos detalhado (se mantido fora do HMP OS)
```

### Versionamento

MVP **não** implementa controle de versão real de conteúdo — o conteúdo vive fora (Drive/Figma/GitHub). `version` é um rótulo que o usuário atualiza manualmente ao trocar o link; cada troca gera uma entrada no `ActivityLog`, preservando o link anterior no histórico (não apagado, só superado). `[A VALIDAR]` se mesmo esse rótulo simples é necessário já no MVP, ou se "link mais recente, sem histórico de versão" basta no início.

---

## 13. Validation

### Estrutura

```
ValidationRecord
├── feature_id
├── attempt_number        (1, 2, 3... — cada tentativa gera um novo registro)
├── criteria_results      (cada AcceptanceCriteria → pass | fail)
├── overall_result        (approved | rejected)
├── issues_found          (texto, se houver reprovação)
├── fixes                 (Task[], criadas para corrigir os problemas encontrados)
├── validated_by
└── validated_at
```

Uma Feature **não** vai direto para `DONE`/`APPROVED` — ela acumula `ValidationRecord`s, nunca sobrescritos.

### Exemplo do ciclo reprovado → corrigido → aprovado, sem perder histórico

```
Feature.status = VALIDATION
  → ValidationRecord #1
      criteria_results: 3 pass, 1 fail
      overall_result: REJECTED
      issues_found: "cálculo de macros incorreto para dietas vegetarianas"
      fixes: [Task "corrigir cálculo para dietas vegetarianas"]
  → Feature.status → DEVELOPMENT (reaberta)
  ... Task de correção concluída ...
  → Feature.status → VALIDATION (novamente)
  → ValidationRecord #2
      criteria_results: 4 pass
      overall_result: APPROVED
  → Feature.status → APPROVED
```

`ValidationRecord #1` continua existindo e visível — a reprovação faz parte da história da Feature, não é apagada quando a segunda tentativa passa.

---

## 14. ActivityLog

### Eventos a registrar no MVP

| Evento | Disparado quando |
|---|---|
| `feature.created` | Feature criada |
| `feature.status_changed` | Qualquer transição de estado (seção 8.1) |
| `feature.field_changed` | Mudança em `priority`, `owner_id`, `architect_id`, `tech_lead_id`, `release_id` |
| `requirement.added` / `requirement.status_changed` | Requirement criado ou seu status muda |
| `decision.created` | Decision criada e vinculada |
| `artifact.linked` | Artifact vinculado a qualquer entidade |
| `task.created` / `task.status_changed` / `task.reassigned` | Ciclo de vida da Task (seção 8.2) |
| `validation.recorded` | Novo ValidationRecord criado, com resultado |
| `feature.released` | Feature chega a `RELEASED` |

`[A VALIDAR]` Granularidade: registrar toda edição de texto longo (`context`, `problem`, `functional_flow`...) geraria ruído; a proposta acima loga **mudanças estruturais e de estado**, não cada tecla digitada. Se a equipe achar insuficiente no uso real, ampliar é uma mudança aditiva, não uma reescrita.

### Reconstrução de uma cadeia completa

```
feature.created (Heitor)
  → requirement.added ×N (Heitor)
  → decision.created "priorizar cálculo automático de macros" (Heitor, reunião 15/09)
  → feature.field_changed architect_id=Linard (Heitor)
  → artifact.linked C4 + ClassDiagram (Linard)
  → feature.status_changed ARCHITECTURE→DEVELOPMENT (Linard)
  → task.created ×3 (Linard)
  → task.status_changed DONE ×3 (Pedro)
  → feature.status_changed DEVELOPMENT→REVIEW (Pedro)
  → feature.status_changed REVIEW→VALIDATION (Heitor/Linard)
  → validation.recorded REJECTED attempt=1 (Heitor)
  → task.created "corrigir cálculo vegetariano" (Linard)
  → task.status_changed DONE (Pedro)
  → validation.recorded APPROVED attempt=2 (Heitor)
  → feature.status_changed APPROVED→RELEASED (Pedro)
```

Essa é literalmente a cadeia pedida no requisito fundamental do projeto — reconstruível a partir de dados, não de memória.

---

## 15. Exemplo completo do Nutria

Simulação passo a passo da Feature "Elaboração do Plano Alimentar", Product = Nutria, seguindo os 14 passos solicitados:

| # | Passo | O que acontece no HMP OS |
|---|---|---|
| 1 | Origem da necessidade | Heitor cria `Feature` "Elaboração do Plano Alimentar" (`product_id`=Nutria), `status=BACKLOG`, `owner_id`=Heitor |
| 2 | Pesquisa | Heitor cria `Artifact` (`type=MarketResearch`, "Pesquisa Dietbox", link Drive), vinculado à Feature |
| 3 | Decisão | Na Reunião Semanal, `Decision` "Priorizar Plano Alimentar com cálculo automático de macros" é criada, `affects`=Feature; `status→DISCOVERY` |
| 4 | Especificação | Heitor preenche `problem`, `objective`, `user_need`; cria `Requirement`s ("calcular macros automaticamente", "permitir edição manual do plano"...); `status→SPECIFICATION` |
| 5 | Prioridade | Heitor define `priority=P1`; `status→PRIORITIZATION` |
| 6 | Arquitetura | `architect_id`=Linard; Linard preenche `architecture_notes`; `status→ARCHITECTURE` |
| 7 | Diagramas | Linard cria `Artifact`s (C4, ClassDiagram), vinculados à Feature |
| 8 | Criação das tasks | Linard cria `Task`s ("modelar entidade PlanoAlimentar", "implementar cálculo de macros", "criar tela de edição"); `tech_lead_id`=Pedro; `status→DEVELOPMENT` |
| 9 | Desenvolvimento | Pedro move cada Task `TODO→IN PROGRESS→REVIEW→DONE`; `ActivityLog` registra cada mudança |
| 10 | Revisão | Todas as Tasks `DONE`; Linard e Heitor conferem o resultado; `status→REVIEW→VALIDATION` |
| 11 | Testes | `AcceptanceCriteria` verificados (ex.: "cálculo bate com 10 casos de referência"); Pedro anexa `Artifact` (`type=TestReport`) |
| 12 | Validação | `ValidationRecord #1`: 1 critério falha (dietas vegetarianas) → `REJECTED` → `status→DEVELOPMENT`; Task de correção criada e concluída; `ValidationRecord #2`: `APPROVED` |
| 13 | Aprovação | `status→APPROVED` |
| 14 | Release | Pedro confirma deploy; `status→RELEASED`; opcionalmente vinculada ao `Release` "Nutria v1.3" |

Toda a cadeia acima é reconstruível via `ActivityLog` + as relações das seções 4–5 — este é o teste de aceitação do modelo proposto.

---

## 16. Dashboard

Não um dashboard de gráficos — um **cockpit operacional**, orientado à pessoa logada, priorizando o que exige ação sobre o que é só informação.

```
┌─────────────────────────────────────────────────────────┐
│ PRECISA DE MIM                                           │  ← topo, mais importante
│ Tasks minhas em TODO/IN PROGRESS/BLOCKED com prazo próximo│
│ Features onde sou owner/architect/tech_lead com ação      │
│ pendente (ex.: Validation aguardando minha aprovação)     │
├─────────────────────────────────────────────────────────┤
│ BLOQUEADOS                                                │
│ Tasks em BLOCKED · Features sem atividade há N dias       │
├─────────────────────────────────────────────────────────┤
│ ATRASADOS                                                 │
│ Tasks/Features com due_date vencido sem avançar de estado │
├─────────────────────────────────────────────────────────┤
│ EM DESENVOLVIMENTO AGORA                                  │
│ Features em DEVELOPMENT, com progresso X/Y tasks          │
├─────────────────────────────────────────────────────────┤
│ AGUARDANDO VALIDAÇÃO                                      │
│ Features em VALIDATION com ValidationRecord pendente       │
├─────────────────────────────────────────────────────────┤
│ DECISÕES RECENTES                                         │
│ Últimas N Decisions, mais recentes primeiro                │
├─────────────────────────────────────────────────────────┤
│ PRÓXIMA REUNIÃO                                            │
│ Agenda-rascunho: follow-ups em aberto + Features que        │
│ acabaram de chegar em PRIORITIZATION/VALIDATION/APPROVED   │
└─────────────────────────────────────────────────────────┘
```

Cada bloco é uma lista, não um gráfico — o único indicador numérico é uma fração simples (X/Y tasks concluídas), não um KPI decorativo.

---

## 17. MVP

### MUST HAVE

- Entidades: `Company`, `Product`, `Feature`, `Task` (com `parent_task_id` e `depends_on`), `Person`, `Role` (3 papéis fixos)
- Ciclo de vida completo da Feature (seção 8.1) e da Task (seção 8.2), com os phase gates básicos
- Estrutura completa da Feature (seção 6): campos diretos + Requirements + AcceptanceCriteria
- `Decision` e `Meeting` completos, com o encadeamento Meeting → Decision → Feature/Task
- `Artifact` como link externo tipado, vinculável a Feature/Decision/Meeting/Task
- `ValidationRecord` com suporte ao ciclo reprovado→corrigido→aprovado (seção 13)
- `ActivityLog` com a taxonomia de eventos da seção 14
- Dashboard (cockpit, seção 16)
- Permissões por papel (seção 9) aplicadas ao menos na UI (quem pode disparar qual transição)
- Workspace único, sem RBAC granular — todos veem tudo

### SHOULD HAVE (importante, mas pode vir depois de validar o MUST HAVE)

- `Release` como entidade (agrupamento de planejamento)
- Rótulo de versão em `Artifact`
- `reviewer_id` de Task com peso real (quando a equipe de engenharia crescer)
- Notificações in-app (ex.: "você foi atribuído", "uma decisão te afeta") — sem integração externa ainda
- Busca/filtro básico entre Features e Tasks
- Exportar/imprimir o histórico completo de uma Feature para compartilhar fora do sistema

### FUTURE (fora do MVP; não incluído só porque foi mencionado)

- IA / geração de contexto estruturado para Claude/Codex
- Automações (transições automáticas, lembretes)
- Motor de workflow configurável
- Integração com GitHub (commits/PRs vinculados a Tasks)
- Templates de Feature/Requirements
- Análise de gargalos e métricas de ciclo
- Permissões granulares multiproduto/multitime
- Uso externo/customer-facing
- Aplicativo mobile

---

## 18. Roadmap futuro

Sequenciamento lógico (não datado), sempre condicionado ao MVP estar validado com uso real (Fase 5):

1. **Pós-MVP imediato**: `Release`, notificações in-app, busca, templates simples de Feature/Requirements.
2. **Integrações**: GitHub (commits/PRs ↔ Tasks), preview de Artifacts do Drive/Figma incorporado.
3. **Workflow configurável**: só se um segundo caso real (ex.: Exomia com processo diferente) mostrar necessidade — não construído preventivamente.
4. **Camada de contexto para IA**: exportar, a partir de uma Feature `APPROVED`, um pacote estruturado (problema + requisitos + decisões + arquitetura + critérios de aceite) consumível por Claude/Codex — preparar terreno, não construir um assistente.
5. **Métricas de ciclo**: tempo médio por estado, taxa de retrabalho em Validation, gargalos por papel.
6. **Multiproduto/multiequipe**: reintroduzir `Workspace` se a Exomia (ou outra frente) tiver equipe própria; só então avaliar qualquer exposição externa.

---

## 19. Pontos ainda sujeitos à validação

Lista consolidada de todo `[A VALIDAR]` usado neste documento — cada um é uma recomendação já assumida, não uma pergunta em aberto:

1. Nome do agrupamento cross-cutting: `Release`, `Milestone` ou `Cycle` (seção 3).
2. Task sem Feature permitida para chores de engenharia pura (seção 5).
3. Três papéis nomeados de responsabilidade na Feature (`owner`/`architect`/`tech_lead`) cobrem a realidade, ou falta um `qa_id` (seção 6).
4. Conclusão do Task-pai exige todos os subtasks `DONE`, ou é só indicativo (seção 3).
5. `reviewer_id` obrigatório em Task, dado que hoje há um único desenvolvedor (seção 7).
6. Estados laterais `ON_HOLD`/`DISCARDED` da Feature são suficientes; `DISCARDED` precisa de motivo obrigatório (seção 8.1).
7. Todo avanço de fase da Feature exige uma `Decision` formal, ou só os avanços críticos (seção 8.3).
8. Bloqueio automático de `Task` quando uma dependência (`depends_on`) não está `DONE` (seção 8.2).
9. Granularidade do `ActivityLog` — mudanças estruturais/de estado (proposta) vs. toda edição de campo (seção 14).
10. Rótulo de versão em `Artifact` já no MVP, ou "link mais recente, sem histórico" é suficiente para começar (seção 12).

As lacunas de informação já registradas em `discovery-architecture-v0.1.md` (seção 11 daquele documento) continuam em aberto e não são repetidas aqui.
