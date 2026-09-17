# HMP OS — Discovery & Architecture v0.1

> Ferramenta interna de gestão operacional e desenvolvimento de produtos da HMP.
> Fase atual: **FASE 0 (Discovery)** + início da **FASE 1 (Modelo conceitual)**.
> Este documento **não é uma decisão de tecnologia e não contém código**. É uma proposta de modelo conceitual para validação conjunta (Heitor, Linard, Pedro) antes de qualquer arquitetura técnica ou implementação.

**Como ler as marcações usadas neste documento:**

- `[A VALIDAR]` — decisão proposta, mas que depende de validação da equipe antes de ser considerada definitiva.
- `[INFORMAÇÃO NECESSÁRIA]` — pergunta em aberto para a qual não havia informação suficiente para decidir; nenhuma lacuna foi preenchida com suposição.

Nada além das seções abaixo foi assumido: se algo do briefing original não é mencionado aqui, é porque não havia base para tratá-lo sem inventar contexto.

---

## Sumário

1. [Problema que estamos resolvendo](#1-problema-que-estamos-resolvendo)
2. [Objetivo do sistema](#2-objetivo-do-sistema)
3. [Usuários](#3-usuários)
4. [Papéis](#4-papéis)
5. [Principais fluxos](#5-principais-fluxos)
6. [Entidades candidatas](#6-entidades-candidatas)
7. [Relações candidatas](#7-relações-candidatas)
8. [Hipótese de workflow](#8-hipótese-de-workflow)
9. [Pontos de decisão arquitetural](#9-pontos-de-decisão-arquitetural)
10. [Riscos](#10-riscos)
11. [O que ainda não sabemos](#11-o-que-ainda-não-sabemos)
12. [Proposta de MVP](#12-proposta-de-mvp)
13. [O que NÃO deve entrar no MVP](#13-o-que-não-deve-entrar-no-mvp)
14. [Próximos passos](#14-próximos-passos)

---

## 1. Problema que estamos resolvendo

Hoje o conhecimento sobre **por que** e **como** os produtos da HMP são construídos está fragmentado entre WhatsApp, uma comunidade e o Google Drive. Não existe um lugar único que conecte, de ponta a ponta:

```
necessidade → decisão → especificação → arquitetura → desenvolvimento → validação → produção
```

Isso gera três problemas concretos hoje (com a Nutria) e que tendem a piorar quando a Exomia entrar em desenvolvimento paralelo:

1. **Perda de rastreabilidade** — não é trivial reconstruir por que uma Feature existe, quem decidiu o quê e quando (a cadeia de perguntas da seção "Requisito Fundamental" do briefing original).
2. **Conhecimento não estruturado** — decisões e requisitos vivem em conversas e documentos soltos, sem relação explícita entre si nem com o que foi de fato construído.
3. **Ferramentas genéricas não refletem o processo real da HMP** — Trello/Notion/Jira/Asana modelam tarefas e projetos genéricos; nenhuma delas representa nativamente o fluxo específico da HMP (pesquisa → decisão de produto → especificação → arquitetura → execução) nem os três papéis que o compõem.

O HMP OS existe para resolver isso — **não para substituir Trello/Notion/Jira/Asana por um clone**, mas para modelar o processo real de desenvolvimento de produtos da HMP como estrutura de dados.

---

## 2. Objetivo do sistema

**Objetivo de longo prazo** (fora do escopo desta entrega e do MVP): centralizar produtos, projetos, features, tarefas, fluxos de desenvolvimento, reuniões, decisões, documentação, referências, diagramas, validações, testes, responsabilidades, dependências, histórico e, futuramente, automações e IA.

**Objetivo desta fase**: transformar o fluxo conceitual atual da HMP — que o próprio briefing trata como hipótese, não como processo definitivo — em um modelo operacional consistente, validado com a equipe antes de virar código.

**Objetivo do primeiro produto útil (MVP — seção 12)**: dar rastreabilidade real ao ciclo de vida de uma Feature, do problema até a produção, testado no desenvolvimento real do Nutria (Fase 5 da metodologia).

IA e automação são explicitamente **não-objetivos** desta fase. A arquitetura deve deixar espaço para isso no futuro (princípio 10), mas nada nessa direção é construído agora.

---

## 3. Usuários

Hoje, 100% interno à HMP:

| Usuário | Papel hoje |
|---|---|
| Heitor | Visão de produto, requisitos, priorização, validação |
| Linard | Arquitetura, modelagem, tradução negócio → sistema |
| Pedro | Desenvolvimento, infraestrutura, testes técnicos |

Explicitamente **fora do escopo de usuário** do HMP OS: clientes do Nutria e usuários finais dos produtos da HMP. O HMP OS é uma ferramenta interna de operação, não um produto voltado a cliente externo.

- `[INFORMAÇÃO NECESSÁRIA]` Se/quando a Exomia tiver equipe própria, ela usará o mesmo workspace do HMP OS (multiproduto) ou uma instância separada? Isso afeta se **Company** precisa ser modelada como entidade real desde já (seção 6).
- `[INFORMAÇÃO NECESSÁRIA]` Plano de crescimento de equipe (novas contratações previstas) — afeta o quanto investir em papéis/permissões já no MVP.

---

## 4. Papéis

| Papel | Pessoa hoje | Foco | Pergunta característica |
|---|---|---|---|
| Visão de Produto | Heitor | visão de produto, requisitos funcionais, apresentação de recursos, pesquisa de mercado, contato com clientes, análise de concorrentes, marketing, priorização, validação funcional, testes, validação do resultado final | "O que precisamos construir e por quê?" |
| Arquitetura | Linard | arquiteto, tradutor entre negócio e arquitetura, estruturação técnica dos requisitos, modelagem, diagramas, organização sistêmica | "Como isso deve funcionar dentro do sistema?" |
| Desenvolvimento | Pedro | desenvolvimento, código, estrutura técnica, implementação, processos de produção, integração, infraestrutura, testes técnicos | "Como transformar essa arquitetura em software funcional?" |

Papel é modelado como algo **distinto de pessoa** (seção 6). Hoje 1 pessoa exerce 1 papel principal, mas o modelo não deve travar essa suposição — a equipe deve crescer, e uma pessoa pode acumular papéis temporariamente.

**Insight que orienta o resto do documento**: as três perguntas características acima mapeiam quase literalmente para três camadas dentro do ciclo de vida de uma Feature:

```
O QUÊ / POR QUÊ (Heitor)  →  COMO FUNCIONA NO SISTEMA (Linard)  →  COMO IMPLEMENTAR (Pedro)
       ↓                              ↓                                    ↓
  problema/objetivo/          fluxo funcional/arquitetura/          Tasks de execução
  requisitos (na Feature)     diagramas (na Feature)                (entidade própria)
```

Isso reforça por que a Feature provavelmente carrega, internamente, uma progressão entre "o que ela é" e "como foi arquitetada" antes de virar Tasks — e por que separar Feature de Task (princípio 6) não é uma escolha arbitrária, é o reflexo direto de como a equipe já trabalha.

---

## 5. Principais fluxos

### a) Fluxo conceitual de produto (hipótese, **ainda não definitivo** — conforme o próprio briefing)

```
Pesquisa/necessidade → análise → decisão de produto → especificação funcional →
priorização → fluxo funcional → arquitetura → diagramas → desenvolvimento →
testes → validação → produção
```

### b) Fluxo de reunião → decisão → item afetado → documentação

```
Meeting → Decision → (Feature | Task | Product) → Artifact/Document relacionado
```

Exemplo dado no briefing: reunião → decisão sobre o Plano Alimentar → Feature afetada → tarefas geradas → documentação relacionada.

### c) Exemplo aplicado (Plano Alimentar, Nutria) — usado como caso de teste do modelo

1. Identificar a necessidade.
2. Pesquisar referências (ex.: Dietbox).
3. Analisar respostas da pesquisa de mercado.
4. Definir o que o Nutria deve fazer.
5. Separar recursos essenciais e secundários.
6. Definir prioridades.
7. Especificar requisitos.
8. Definir fluxo funcional.
9. Criar arquitetura.
10. Criar diagramas.
11. Criar tarefas técnicas.
12. Desenvolver.
13. Testar.
14. Validar funcionalmente.
15. Aprovar.
16. Colocar em produção.

Este exemplo é usado na seção 7 para verificar se o modelo de entidades proposto consegue efetivamente representar o caso real.

---

## 6. Entidades candidatas

**Esta é a pergunta central desta entrega.** As entidades abaixo são organizadas por cluster, não por ordem de importância — a Feature continua sendo, por hipótese, a entidade central do sistema (seção 5 do briefing), mas ela só faz sentido cercada das entidades de apoio abaixo.

### Núcleo organizacional

| Entidade | Descrição | Status |
|---|---|---|
| **Company** (Empresa) | A HMP como organização. Hoje só existe uma. | `[A VALIDAR]` |
| **Product** (Produto) | Nutria, Exomia e, por consistência, o próprio HMP OS enquanto produto interno da HMP | Confirmada |
| **Project** (Projeto) | Camada intermediária entre Produto e Feature | `[A VALIDAR]` — proposta é **remover do MVP** |
| **Feature** | Unidade central de valor: do problema à produção | Confirmada como entidade central |
| **Task** | Unidade de execução técnica | Confirmada |
| **Subtask** | Subdivisão de Task | `[A VALIDAR]` — proposta é **não criar entidade separada** |

**Sobre Company:** hoje existe só a HMP. Modelá-la como entidade custa pouco (uma linha) e evita retrabalho se um dia existir uma segunda empresa ou o HMP OS for usado por outra operação. Proposta: incluir como entidade mínima (id + nome), sem funcionalidade adicional no MVP — só para não hardcodar "HMP" no sistema. `[A VALIDAR]`

**Sobre Project:** nos dois exemplos concretos do briefing (o fluxo do Plano Alimentar e o fluxo de reunião) "Projeto" **nunca aparece** — só Produto e Feature. Isso é um indício de que, no dia a dia, a HMP pensa em Produto → Feature diretamente, e "Projeto" pode ser:

- (i) redundante com Produto no estágio atual (cada Produto já funciona como uma frente contínua), ou
- (ii) um agrupamento temporal futuro (ex.: "Nutria — Ciclo Q3 2026") quando houver necessidade de organizar entregas por período/release.

Proposta: **não incluir Project no MVP** (hierarquia Product → Feature direta); reintroduzir se/quando um Produto precisar de múltiplas frentes paralelas organizadas separadamente. `[A VALIDAR]`

**Sobre Subtask:** proposta é modelar como a própria entidade Task com auto-relacionamento (`parent_task_id` opcional), em vez de uma entidade própria — evita duplicar workflow e campos para o mesmo conceito em granularidade diferente. `[A VALIDAR]`

**Hierarquia proposta para o MVP:**

```
HMP (Company)
 └─ Product (Nutria | Exomia | HMP OS)
     └─ Feature
         └─ Task
             └─ Task (subtask, mesmo tipo, parent_task_id)
```

Sem camada de Project no MVP. Company como âncora mínima para múltiplos Produtos.

### Pessoas & responsabilidade

| Entidade | Descrição |
|---|---|
| **Person** | Heitor, Linard, Pedro e futuros membros |
| **Role** | Papel (Visão de Produto, Arquitetura, Desenvolvimento, ...) — desacoplado de Person |
| **Assignment** (Responsabilidade) | Liga Person + Role a uma Feature, Task ou Product específico |

`[A VALIDAR]` Granularidade necessária: um campo simples "responsável" por Feature/Task é suficiente no MVP, ou já é preciso suportar múltiplos papéis por item (estilo RACI)? Proposta: campo simples de responsável (1 pessoa) por Feature e por Task no MVP; Assignment mais rico só se a necessidade aparecer no uso real (Fase 5).

### Conhecimento & decisão

| Entidade | Descrição |
|---|---|
| **Meeting** | Reunião semanal de acompanhamento/validação |
| **Decision** | Decisão tomada (em reunião ou não) que afeta um ou mais itens do sistema |

Meeting gera Decisions (1—N) e também pode gerar Tasks diretamente, para itens de ação que não chegam a ser propriamente uma "decisão" (ex.: "Pedro verificar X até sexta"). `[A VALIDAR]` se toda decisão relevante precisa virar um registro formal de Decision, ou só as que afetam Features — registrar demais gera atrito de uso (ver Riscos, seção 10).

### Artefatos & documentação

| Entidade | Descrição |
|---|---|
| **Artifact** (Documento/Referência) | Documento, pesquisa de mercado, referência de concorrente, especificação, diagrama (C4, classes, sequência), relatório de teste — tratado como **referência**, versionada ou não, apontando para conteúdo externo ou interno |
| **Requirement** | Requisito funcional — hipoteticamente uma lista estruturada dentro da Feature, não uma entidade profunda própria no MVP |
| **AcceptanceCriteria / Test** | Critério de validação de uma Feature/Task: descrição, status (pendente/aprovado/reprovado), validado por quem e quando |

`[A VALIDAR]` Se Requirement precisa de rastreabilidade própria (cada Task apontando para um Requirement específico) já no MVP, ou se basta o vínculo Task → Feature, deixando Requirement como lista simples dentro da Feature no início. Recomendação: começar simples e evoluir se o uso real (Fase 5) mostrar necessidade de granularidade maior — princípio "não criar abstrações sem necessidade".

`[A VALIDAR]` Taxonomia de tipos de Artifact (Document, Diagram, Research/Reference, Spec, Test Report, ...). Proposta inicial: um único tipo com um campo de categoria, não uma entidade por tipo.

Explicitamente **fora de escopo agora**: um editor de diagramas. Artifact aponta para fora (Drive, Figma, Miro etc.), não hospeda o conteúdo.

### Rastreabilidade

| Entidade | Descrição |
|---|---|
| **ActivityLog / Event** | Registro append-only de mudanças (status, campos, vínculos) em qualquer entidade rastreável |

Este é o único item que a proposta recomenda **não adiar**, mesmo em um MVP mínimo (ver seção 9). Rastreabilidade é o requisito fundamental do projeto; reconstruir histórico depois que os dados já existem sem log é muito mais caro do que registrar desde o primeiro dia.

---

## 7. Relações candidatas

| De | Para | Cardinalidade | Observação |
|---|---|---|---|
| Company | Product | 1—N | `[A VALIDAR]` se Company existe como entidade |
| Product | Feature | 1—N | sem Project no meio, proposta de MVP |
| Feature | Task | 1—N | |
| Task | Task | 0—N | auto-relacionamento (`parent_task_id`), substitui Subtask |
| Feature | Artifact | N—N | polimórfico — Artifact também se relaciona com Decision, Meeting, Task |
| Feature | Requirement | 1—N | lista simples no MVP |
| Feature | AcceptanceCriteria | 1—N | |
| Meeting | Decision | 1—N | |
| Meeting | Task | 1—N | ação direta, sem decisão formal no meio |
| Decision | Feature / Task / Product | N—N | "afeta" — polimórfico |
| Decision | Artifact | N—N | "referenciado por" / "baseado em" |
| Person | Role | N—N | via Assignment |
| Feature | Person | N—1 | responsável — campo simples no MVP |
| Task | Person | N—1 | responsável — campo simples no MVP |
| ActivityLog | qualquer entidade rastreável | N—1 | polimórfico, gerado automaticamente |

**Nota arquitetural**: várias dessas relações são **polimórficas** (Decision afeta Feature/Task/Product; Artifact se relaciona com Feature/Decision/Meeting/Task). Isso é uma decisão técnica concreta a resolver na Fase 2 — ver seção 9, item 1.

### Exemplo aplicado (validando o modelo com o caso do Plano Alimentar)

```
Necessidade identificada
  → Feature "Elaboração do Plano Alimentar" (Product: Nutria)
      → Artifact tipo "Reference" (pesquisa Dietbox) vinculado à Feature
      → discussão em Meeting semanal
          → Decision "priorizar recursos X e Y" vinculada à Feature e à Meeting
      → Requirements definidos dentro da Feature
      → Artifacts de arquitetura/diagrama (Linard) vinculados à Feature
      → Feature avança para DEVELOPMENT
          → Tasks técnicas criadas, vinculadas à Feature, responsável: Pedro
          → Tasks concluídas
      → AcceptanceCriteria validados por Heitor
      → Feature → DONE
```

Todo o caminho acima fica reconstruível a partir das relações da tabela + do ActivityLog — o que é exatamente o teste de aceitação para o modelo proposto (ver "Requisito Fundamental" no briefing original).

---

## 8. Hipótese de workflow

O briefing pergunta diretamente se faz sentido separar o fluxo da Feature do fluxo da Task. Resposta: **sim, essa separação faz sentido arquiteturalmente**, pelos seguintes motivos:

1. Representam **planos diferentes** — Feature é o "plano de produto" (o quê/por quê, ritmo de decisão), Task é o "plano de execução" (como, ritmo operacional). É o princípio "separação entre produto e execução" aplicado diretamente.
2. Têm **donos diferentes** na prática atual — o avanço de uma Feature depende de decisão (Heitor/Linard), o avanço de uma Task depende de execução (Pedro).
3. Têm **granularidade e tempo de vida diferentes** — uma Feature vive semanas/meses, uma Task vive dias.
4. Uma Feature pode ter Tasks em estados diferentes ao mesmo tempo (ex.: uma Task de teste em DOING enquanto outra de desenvolvimento ainda está em REVIEW) — um único workflow para os dois obrigaria a achatar essa realidade.

**Proposta técnica para a Fase 2** (não implementar agora): não construir de imediato um motor de workflow genérico e configurável. Modelar o status de Feature e o status de Task como dois campos de enum simples e independentes no MVP. Deixar a porta aberta para um motor de workflow configurável **apenas se** um terceiro caso de uso real precisar disso (ex.: um fluxo de aprovação próprio para Decision) — não construir isso preventivamente.

### Fluxo da Feature (hipótese)

```
BACKLOG → DISCOVERY → SPECIFICATION → ARCHITECTURE → DEVELOPMENT → REVIEW → VALIDATION → DONE
```

com dois estados laterais prováveis: `ON_HOLD` e `DISCARDED` — nenhum dos dois aparece no briefing original; são adicionados aqui como hipótese realista (toda feature pode ser pausada ou descartada). `[A VALIDAR]`

### Fluxo da Task (hipótese)

```
TODO → DOING → REVIEW → DONE
```

com um estado lateral provável: `BLOCKED`. `[A VALIDAR]`

### Relação entre os dois fluxos

Uma Feature tende a avançar de fase quando (a) as Tasks daquela fase estão concluídas **e** (b) existe uma Decision (ou aprovação informal) confirmando o avanço — esse é o "phase gate" que conecta execução e decisão. `[A VALIDAR]` se todo avanço de fase precisa de uma Decision formal, ou só os avanços críticos (ex.: DISCOVERY → SPECIFICATION talvez precise; DEVELOPMENT → REVIEW talvez seja automático quando as Tasks fecham).

---

## 9. Pontos de decisão arquitetural

Esta seção lista **decisões técnicas que precisarão ser tomadas**, sem escolher stack ainda — a proposta formal de stack (linguagens, frameworks, banco de dados, hospedagem) fica para a Fase 2, depois deste documento ser validado, conforme a própria metodologia definida para o projeto.

1. **Associações polimórficas** — como implementar Decision → (Feature | Task | Product) e Artifact → (Feature | Decision | Meeting | Task): tabela de vínculo genérica (`entity_type` + `entity_id`) vs. tabelas de junção explícitas por par. Afeta integridade referencial e complexidade das queries de rastreabilidade.
2. **Rastreabilidade/auditoria** — log de eventos append-only desde o MVP (recomendado) vs. adicionar depois. Recomendação: implementar desde o início; é o requisito fundamental do projeto e caro de retrofitar depois que já existem dados sem histórico.
3. **Motor de workflow** — enum fixo por tipo de entidade (recomendado para o MVP) vs. motor configurável genérico (adiar até haver necessidade real comprovada).
4. **Modelo de dados** — relacional vs. documento. Hipótese preliminar: o domínio é fortemente relacional e a rastreabilidade depende de integridade referencial e joins consistentes, o que favorece um banco relacional — mas a confirmação formal fica para a Fase 2. `[A VALIDAR]`
5. **Autenticação/autorização** — uso 100% interno (3 pessoas hoje) permite começar sem RBAC granular; mas se HMP OS um dia tiver usuários externos (ex.: equipe própria da Exomia, ou terceiros) isso muda o quanto investir nisso agora. `[INFORMAÇÃO NECESSÁRIA]`
6. **Hospedagem/infraestrutura** — preferências e restrições (cloud provider, self-host, orçamento). `[INFORMAÇÃO NECESSÁRIA]`
7. **Reuso de padrões técnicos de outros projetos HMP/Nexo** — aguardando os materiais mencionados no briefing original antes de decidir o que reaproveitar. `[INFORMAÇÃO NECESSÁRIA]`
8. **Integrações futuras** (Drive, WhatsApp, calendário) — nenhuma decisão necessária agora; Artifact e Meeting só precisam conseguir referenciar um link externo, sem integração ativa no MVP.

---

## 10. Riscos

| Risco | Descrição | Mitigação proposta |
|---|---|---|
| Baixa adoção / atrito de uso | Se o HMP OS for mais lento que WhatsApp/Drive, a equipe volta às ferramentas antigas e a rastreabilidade fica com buracos | MVP mínimo, validado com uso real (Fase 5) antes de crescer escopo |
| Over-engineering prematuro | Construir estrutura complexa antes de validar o processo real | Fases explícitas; "simplicidade antes de complexidade" |
| Workflow travado cedo demais | Fixar estados antes do processo real da HMP estabilizar | Estados marcados `[A VALIDAR]`; motor de workflow configurável adiado |
| Custo de oportunidade | Tempo de Pedro/Linard/Heitor construindo o HMP OS é tempo não construindo Nutria/Exomia | MVP enxuto e timeboxed; validação com uso real cedo |
| Lacuna de histórico | Decisões passadas (WhatsApp/Drive/comunidade) não entram automaticamente; rastreabilidade completa só vale a partir do go-live | Backfill manual é opcional, não assumido — ver seção 11 |
| Ambiguidade estrutural não resolvida cedo | Product vs. Project, Task vs. Subtask ainda em aberto | Marcados `[A VALIDAR]` nesta entrega, antes de qualquer implementação |
| Concentração em poucas pessoas | Hoje 3 pessoas cobrem todos os papéis | Modelo e ferramenta precisam funcionar com baixa redundância e escalar com o time |
| "Ferramenta para a ferramenta" | Risco de o HMP OS virar desvio de foco em vez de suporte real ao Nutria | Fase 5 (validação com uso real) obrigatória antes de expandir escopo |

---

## 11. O que ainda não sabemos

1. `[INFORMAÇÃO NECESSÁRIA]` HMP OS será usado por uma eventual equipe própria da Exomia no mesmo workspace, ou em instância separada?
2. `[INFORMAÇÃO NECESSÁRIA]` Plano de crescimento de equipe (contratações previstas) — afeta prioridade de papéis/permissões.
3. `[INFORMAÇÃO NECESSÁRIA]` HMP OS será sempre 100% interno, ou pode um dia ter usuários externos?
4. `[INFORMAÇÃO NECESSÁRIA]` Toda decisão relevante precisa virar um registro formal de Decision, ou só as que afetam Features?
5. `[INFORMAÇÃO NECESSÁRIA]` Existe intenção de migrar/backfillar decisões e documentos históricos do WhatsApp/Drive/comunidade, ou o HMP OS começa do zero a partir do go-live?
6. `[INFORMAÇÃO NECESSÁRIA]` Preferências ou restrições de infraestrutura e hospedagem.
7. `[INFORMAÇÃO NECESSÁRIA]` Padrões técnicos de outros projetos HMP/Nexo (mencionados no briefing original) — ainda não recebidos.
8. `[INFORMAÇÃO NECESSÁRIA]` Volume esperado (quantas Features/Tasks por mês, hoje e em 6–12 meses) — afeta quanto investir em estrutura agora.
9. `[INFORMAÇÃO NECESSÁRIA]` O processo da Exomia será igual ao do Nutria, ou fundamentalmente diferente (equipe/domínio distintos)? Afeta se o workflow deve ser único ou específico por Produto desde já.

---

## 12. Proposta de MVP

**Escopo**: um único workspace (HMP), 3 usuários, sem permissões granulares.

**Entidades**: Product, Feature, Task (com `parent_task_id`), Person, Role (simples), Decision, Meeting, Artifact (como link externo + tipo), Requirement (lista simples dentro da Feature), AcceptanceCriteria (lista simples), ActivityLog (automático, transversal).

**Capacidades**:

- CRUD de Product, Feature, Task.
- Feature e Task com status simples (enum fixo, sem motor configurável).
- Responsável (1 pessoa) por Feature e por Task.
- Registro manual de Meeting (data, participantes, notas ou link) e de Decision (texto, vínculo com Feature/Task/Product afetado, vínculo opcional com a Meeting de origem).
- Vínculo de Artifact (link externo + tipo) a Feature/Decision/Meeting.
- Lista simples de Requirements e AcceptanceCriteria dentro da Feature.
- Histórico automático (ActivityLog) de mudanças de status e vínculos, visível por entidade.

**Critério de sucesso do MVP** (Fase 5): conseguir acompanhar, de ponta a ponta, pelo menos uma Feature real do Nutria (por exemplo, o próprio caso do Plano Alimentar) e responder todas as perguntas de rastreabilidade da seção "Requisito Fundamental" do briefing original usando apenas os dados registrados no sistema — nada reconstruído de memória ou de fora dele.

---

## 13. O que NÃO deve entrar no MVP

- Project como entidade.
- Subtask como entidade separada.
- Motor de workflow configurável.
- Editor de diagramas.
- IA / geração de contexto para IA.
- Integrações ativas (Slack, WhatsApp, Google Drive, calendário).
- Permissões granulares / RBAC.
- Suporte multiempresa / multi-tenant.
- Aplicativo mobile.
- Busca avançada, dashboards e relatórios.
- Automações.
- Qualquer funcionalidade voltada a usuários externos ou clientes.

---

## 14. Próximos passos

1. Revisar este documento com Linard e Pedro; resolver os itens `[A VALIDAR]` e `[INFORMAÇÃO NECESSÁRIA]` — idealmente em uma reunião que, seguindo o próprio modelo proposto, já poderia gerar as primeiras Decisions "reais" do HMP OS.
2. Compartilhar os materiais mencionados no briefing original (C4 Model, diagramas, definição de papéis, estrutura da empresa, processos) para uma análise comparativa formal: o que confirma, o que complementa, o que contradiz, o que falta, o que precisa ser revisado. Este documento **não** será substituído automaticamente por eles.
3. Consolidar as decisões em uma v0.2 do modelo conceitual (fechando a Fase 1).
4. Só então avançar para a Fase 2 (arquitetura técnica) — incluindo a proposta formal de stack, deliberadamente fora desta entrega.
5. Manter este documento e seus sucessores versionados no repositório, como primeiro artefato de rastreabilidade do próprio HMP OS.
