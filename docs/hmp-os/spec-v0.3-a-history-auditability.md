# HMP OS — V0.3-A · History & Auditability

> Especificação funcional e arquitetural da primeira etapa do ciclo **V0.3 — Process Integrity**.
>
> - **Status:** aprovada — todas as recomendações da seção 13 (DV-01 a DV-23) foram aceitas — e implementada. Os critérios de aceite da seção 11 viraram a suíte `tests/acceptance/` (ver README, "Testes de aceite"). O ensaio da migração numa branch do Neon (DV-22) depende de uma ação no painel do Neon.
> - **Base:** `d8ca35b`, depois da auditoria `audit-v0.2.md` (validada).
> - **Objetivo:** criar a camada de memória do HMP OS. O sistema passa a distinguir **estado atual** de **histórico** e impede que alterações posteriores apaguem ou reescrevam o contexto do que aconteceu.
> - **Leitura rápida:** 1.1 (estado atual × histórico), 12 (arquitetura proposta), 13 (decisões para validar antes de qualquer código).

---

## 1. Objetivo, princípios e escopo

### 1.1 Estado atual × Histórico

**Estado atual.** É como a entidade está agora.
- Vive nas tabelas de domínio (`Feature`, `Task`, `Decision`, …).
- Pode mudar, dentro das regras do workflow.
- É o que as telas de trabalho e o Dashboard usam para decidir "o que fazer agora".

**Histórico.** É o que precisa continuar verdadeiro mesmo que a entidade mude depois: quem fez, quando, o que era antes, o que passou a ser, por quê (quando exigido) e em que contexto.
- Vive em registros **somente-inserção**: eventos, mudanças campo a campo, snapshots e tentativas de validação.
- Nunca é atualizado nem apagado.

A regra que resume a V0.3-A:

> **O estado atual pode mudar; o histórico só cresce.** Corrigir o passado significa registrar um novo fato (evento, correção justificada, substituição). Nunca sobrescrever o anterior.

| Entidade | Estado atual (o que é agora) | Histórico (o que precisa continuar verdadeiro) |
|---|---|---|
| Feature | Título, narrativa, prioridade, status e responsáveis vigentes | Quem criou e quando. Cada transição (de/para, quem, quando, motivo se regressão). Cada mudança de prioridade e de responsáveis. Cada versão dos textos até a trava. O que foi validado em cada tentativa e o que foi aprovado |
| Requirement | Texto, prioridade, status e fonte vigentes; ativo ou arquivado | Criação (quem, quando, texto). Cada edição (antes/depois). Arquivamento (quem, quando, motivo, último conteúdo). Versão vigente em cada tentativa de validação |
| AcceptanceCriteria | Texto e resultado atual; ativo ou arquivado | Criação, arquivamento e resultado em cada tentativa |
| ValidationRecord | — (é histórico puro) | Tudo; imutável |
| Task | Título, descrição, status, prioridade, prazo, responsável e dependência vigentes; ativa ou arquivada | Origem (Feature, decisão, reunião, criador — imutável). Cada mudança de status (com motivo do bloqueio), responsável, prazo, prioridade e conteúdo. Arquivamento e reabertura |
| Decision | Status (ativa, substituída, revogada) e vínculos vigentes | O conteúdo como decidido e cada correção com motivo. Autor, participantes, reunião, data da decisão e data do registro. Tasks geradas (mesmo arquivadas). Substituição/revogação (quem, quando, motivo) |
| Meeting | Título, data, pauta, notas e participantes vigentes | Criação. Remarcações (de/para). Participantes adicionados e removidos. Edições de pauta e notas (antes/depois) |
| Person | Nome, papel, ativo/inativo | A identidade referenciada pelo histórico (nunca some) e o nome no momento de cada evento |
| ActivityLog | — | O próprio histórico: somente-inserção |

### 1.2 Princípios

1. **O estado atual é uma projeção; o histórico é o registro.** Em caso de dúvida sobre o passado, vale o histórico.
2. **O passado não se edita:** corrige-se com um novo fato.
3. **Toda escrita tem autor declarado e momento do servidor.** Ações sensíveis têm motivo.
4. **Nada some:** arquivar não é apagar.
5. **Contratos congelam:** o que foi decidido, validado e aprovado fica como estava naquele momento.
6. **Histórico completo por agregado.** Um evento aparece em todos os históricos a que pertence (Feature, Decision, Meeting, Product), não só no da entidade que mudou.
7. **O backend é a autoridade; o banco é a última linha de defesa.** A UI só sinaliza.

### 1.3 Escopo

**Resolve** as lacunas de histórico da auditoria V0.2:

| Lacuna | Situação |
|---|---|
| G05 | Ações sem autor |
| G07 | Edições sem valor anterior |
| G08 | Histórico da Feature incompleto |
| G09 | Exclusão física de tasks |
| G23 | Linguagem e duplicação no log |
| D02 | Log só com texto livre |
| D03 | Eventos artificiais do seed |
| D07 | Hard delete |
| G06 (parcial) | Trava e arquivamento de requisitos |
| G10 (parcial) | Substituição e revogação de decisões |

**Fica fora** (outras etapas da V0.3 ou ciclos próprios):
- registrar Artifacts e evidência das etapas (G01 → V0.3-B);
- vínculo requisito ↔ task ↔ critério (G06, restante → V0.3-B);
- gates de processo: Review registrado, Done com tasks abertas (G02, G03, G04);
- ownership e sinais do Dashboard, incluindo decisão "sem ação necessária", bloqueio sem motivo, pausar/descartar Feature (G10 restante, G12, G13, G14 → V0.3-C);
- autenticação real, permissões por papel, "máquina do tempo" navegável, notificações, IA.

---

## 2. O que precisa ser preservado historicamente

**Feature**
- Criação: autor, momento e conteúdo inicial (snapshot).
- Transições de status: de → para, autor, momento, sentido (avanço/regressão), motivo nas regressões, origem (manual ou resultado de validação).
- Prioridade: cada mudança de → para, autor, momento, motivo opcional.
- Responsáveis (owner, architect, tech lead): cada troca de → para, com os nomes no momento.
- Título e narrativa (contexto, problema, necessidade do usuário, objetivo, fluxo funcional, notas de arquitetura): cada edição com o texto anterior e o novo, até a trava.
- O que foi validado em cada tentativa e o que foi aprovado: snapshot da Feature, dos requisitos, dos critérios e das tasks naquele momento.

**Requirement**
- Criação (autor, momento, conteúdo).
- Cada edição (antes/depois de texto, prioridade, status e fonte).
- Arquivamento (autor, momento, motivo, último conteúdo).
- A versão vigente em cada tentativa de validação.

**AcceptanceCriteria**
- Criação e arquivamento (motivo).
- Resultado em cada tentativa, com o **id** do critério. Hoje o snapshot guarda só o texto.

**ValidationRecord** (tudo, imutável)
- Número da tentativa; resultado **solicitado** e resultado **final** (aprovação convertida em reprovação pelo gate).
- Validador (obrigatório) e nome no momento; data; observações e problemas.
- Snapshots de critérios, requisitos, tasks e Feature.

**Task**
- Origem imutável (Feature, decisão, reunião, criador, momento de criação) e o contexto da origem naquele momento (ex.: o texto da decisão que a gerou).
- Status (de/para, com o motivo do bloqueio quando houver).
- Responsável, prazo e prioridade (de/para).
- Título e descrição (antes/depois).
- Dependências adicionadas e removidas.
- Arquivamento e reabertura (motivo).

**Decision**
- Conteúdo como decidido e cada correção (antes/depois + motivo).
- Autor; participantes; reunião de origem; "Afeta".
- Data da decisão **e** data do registro (hoje só existe a primeira).
- Tasks geradas, inclusive arquivadas.
- Substituição (por qual decisão, quem, quando, motivo) e revogação (quem, quando, motivo).

**Meeting**
- Criação.
- Remarcações (data de/para).
- Participantes adicionados e removidos. Hoje a lista inteira é apagada e recriada a cada edição, sem registro.
- Edições de pauta e notas (antes/depois).

**Person**
- Nunca desaparece: é referenciada pelo histórico.
- Nome e papel no momento de cada ação ficam no próprio evento, como `actorName` já faz hoje.

**Product, Release, Artifact, Company**
- Sem edição pela UI hoje.
- Quando ganharem edição (ex.: Artifacts na V0.3-B), seguem o mesmo contrato.
- Artifact: trocar o link cria uma nova versão e preserva o anterior (`conceptual-architecture-v0.1.md`, §12).

**ActivityLog**
- O próprio histórico: somente-inserção.

---

## 3. Quais alterações geram histórico

### 3.1 Regras gerais

1. **Toda escrita bem-sucedida gera pelo menos um evento,** gravado **na mesma transação** que a mudança de estado. Hoje `logActivity` roda depois da mutação e fora da transação: se o registro falhar, o estado muda sem histórico.
2. **Um evento por entidade afetada em cada ação do usuário.** Um `correlationId` agrupa os eventos da mesma ação (ex.: aprovar = evento da validação + mudança de status da Feature).
3. **Salvar sem mudar nada não gera evento.**
4. **O momento é sempre o do servidor.** O usuário não escolhe a data de um evento. Datas de negócio (ex.: `decidedAt`) são campos à parte e ficam lado a lado com a data do registro.
5. **Cada campo alterado vira uma linha de mudança** (antes/depois, com rótulos legíveis). Consultas como "todas as mudanças de status/responsável/prazo" usam essas linhas, não o tipo do evento.

### 3.2 Ações e eventos

| Ação | Evento(s) | O que o evento guarda | Motivo |
|---|---|---|---|
| Criar Feature, Task, Requirement, Critério, Meeting ou Decision | `<entidade>.created` | Snapshot completo + contexto de origem | — |
| Editar campos | `<entidade>.updated` | Uma linha por campo alterado (antes/depois, rótulos) | Só no nível "sensível" (seção 4) |
| Mudar status (Feature, Task) | `<entidade>.status_changed` | Status de → para; motivo do bloqueio (Task) | Regressão de Feature; reabrir Task |
| Trocar responsável | Linha `ownerId`/`architectId`/`techLeadId`/`assigneeId` no evento da ação | De → para, com nomes no momento | — |
| Alterar participantes | Linha `participants` | Conjunto anterior e novo (quem entrou, quem saiu) | Se a reunião já aconteceu ou a decisão travou |
| Arquivar (Task, Requirement, Critério) | `<entidade>.archived` | Snapshot final + motivo | Sim |
| Restaurar | `<entidade>.restored` | Motivo | Sim |
| Registrar validação | `validation.recorded` + `feature.status_changed` (mesma correlação) | Resultado solicitado e final, critérios, snapshots | — |
| Criar Task a partir de Decision | `task.created` com escopo da decisão | Contexto: decisão (id, título, texto) e reunião (id, título, data) no momento | — |
| Substituir decisão | `decision.created` (nova, com `supersedes`) + `decision.superseded` (anterior) | Vínculo entre as duas; motivo | Sim |
| Revogar decisão | `decision.revoked` | Motivo | Sim |
| Migração da V0.2 | `<entidade>.baseline` | Snapshot do estado no momento da migração | — |

### 3.3 Criação de entidades derivadas

- **Decision → Task:** um único evento `task.created`, com os escopos da task e da decisão. Ele aparece no histórico da task, da decisão, da reunião de origem e da Feature, sem duplicar registros. O contexto guarda o texto da decisão **naquele momento**.
- **Validação → status da Feature:** dois fatos distintos (a tentativa e a mudança de status), com a mesma correlação. A UI mostra como uma linha: "Heitor aprovou a tentativa 2 → Feature foi para Done".
- **Substituição de decisão:** a nova decisão nasce com o vínculo `supersedes`; a anterior muda para `SUPERSEDED` no mesmo comando.

### 3.4 O que deixa de acontecer nos novos registros

- **Eventos redundantes:** `validation.started` repetia a mudança de status; `validation.completed` repetia a aprovação/reprovação. Os eventos antigos ficam como estão.
- **`description` deixa de ser a fonte da verdade.** Passa a ser um resumo gerado a partir dos dados estruturados, mantido para leitura rápida e para compatibilidade.

---

## 4. O que continua editável, o que trava e o que vira nova versão

### 4.1 Três níveis

| Nível | Significado | Na UI |
|---|---|---|
| **Livre** | Edita normalmente; o histórico guarda antes/depois | Nada muda para o usuário |
| **Sensível** | Edita, mas com **motivo obrigatório**; o histórico guarda antes/depois + motivo | Campo "motivo" + selo "corrigido" no item |
| **Congelado** | Não edita. Mudar exige nova entidade (substituição), reabrir pelo workflow ou nada | Campo travado com a explicação e o caminho alternativo |

### 4.2 Matrizes

**Feature** (DV-08, DV-09)

| Campo / ação | Backlog → Review | Validation | Done |
|---|---|---|---|
| Título e narrativa | Livre | Congelado | Congelado |
| Prioridade | Livre (motivo opcional) | Livre | Congelado |
| Responsáveis (owner, architect, tech lead) | Livre | Livre | Congelado |
| Avançar status | Regras atuais | Só pelo resultado da validação | Terminal |
| Voltar status | Sensível | Sensível (voltar a Review) | — |
| Requisitos — criar e editar | Livre | Congelado | Congelado |
| Requisitos — arquivar | Sensível | Congelado | Congelado |
| Critérios — criar | Livre | Congelado (já é hoje) | Congelado (já é hoje) |
| Critérios — arquivar | Sensível | Congelado | Congelado |

**Task** (DV-04, DV-13)

| Campo / ação | Aberta | Concluída | Aberta, com a Feature em Done |
|---|---|---|---|
| Título, descrição, prioridade, prazo, responsável, dependência | Livre | Congelado (reabrir antes) | Congelado |
| Status | Livre | Reabrir: Sensível | Só status |
| Origem (Feature, decisão, reunião, criador) | Congelado | Congelado | Congelado |
| Arquivar | Sensível | Proibido | Sensível |

Task concluída de uma Feature em Done: tudo congelado, inclusive reabrir.

**Decision** (DV-05, DV-06, DV-07)

A decisão fica **travada** quando gera a primeira task (mesmo que depois arquivada) ou quando termina a janela de correção. A janela proposta é de 24 h após o registro, valendo o que vier antes.

| Campo / ação | Na janela, sem tasks | Travada | Substituída ou revogada |
|---|---|---|---|
| Título | Livre | Sensível (correção) | Congelado |
| Decisão, contexto, justificativa, alternativas | Livre | Congelado → substituir | Congelado |
| Autor, data da decisão, reunião, participantes | Livre | Congelado → substituir | Congelado |
| Afeta | Livre | Congelado (hoje já trava quando há tasks) | Congelado |
| Gerar task | Permitido | Permitido | Proibido |
| Substituir | — | Permitido (nova decisão) | — |
| Revogar | Sensível | Sensível | — |

**Meeting** (DV-10)

| Campo | Futura, sem decisões | Realizada ou com decisões |
|---|---|---|
| Título, pauta, notas | Livre | Livre (a ata costuma ser completada depois) |
| Data | Livre | Sensível |
| Participantes | Livre | Sensível |
| Excluir | Não existe e continua não existindo | Não existe |

**ValidationRecord:** congelado sempre (já não há ação de edição; passa a ser garantido também no banco).

**Person, Product, Release, Artifact:** sem edição pela UI hoje. Quando houver, passam pelo mesmo pipeline. Person nunca é apagada (inativar); Artifact muda de link criando versão.

### 4.3 Correção, substituição e reabertura

- **Correção (sensível):** a mesma entidade muda. O histórico guarda antes, depois e motivo, e a UI mostra "corrigido em … por … — motivo". Serve para erro material (digitação, participante esquecido, reunião remarcada).
- **Substituição:** mudança de **mérito** depois da trava. Nasce uma nova entidade, ligada à anterior. A anterior continua visível, congelada e com suas consequências (tasks). Serve para decisões.
- **Reabertura:** voltar de estado pelo workflow (Feature para Review; Task concluída para em andamento), com motivo. O conteúdo volta a ser editável dentro das regras.

---

## 5. Exclusões

### 5.1 Alternativas avaliadas

| Abordagem | Como funciona | A favor | Contra | Veredito |
|---|---|---|---|---|
| Exclusão física + evento com snapshot ("tombstone") | Apaga a linha e guarda o último estado no evento | Simples; telas não precisam filtrar | Quebra vínculos: com `SET NULL`, a decisão deixa de saber que gerou a task e a dependência some. A página vira 404. O snapshot não é navegável nem relacionável | Não |
| **Soft delete (arquivamento) + evento com snapshot** | A linha permanece com `archivedAt/By/Reason`; um evento registra o ato | Vínculos e FKs intactos. A página continua existindo (somente leitura). Os históricos por escopo continuam completos. Restaurável. Mesma tabela, sem schema duplicado | Toda consulta de estado atual precisa excluir arquivados (risco de vazamento, mitigado com helpers e testes). Os dados crescem (irrelevante no volume da HMP) | **Recomendado** |
| Tabelas de arquivo (`TaskArchive`, …) | Move a linha para outra tabela | Tabelas de trabalho limpas | Duplica o schema a cada mudança; relações quebram na movimentação; complexidade | Não |
| Event sourcing | O estado é derivado dos eventos | Histórico perfeito por construção | Reescrita do sistema; complexidade desproporcional a 3 usuários | Não |
| Só triggers no banco | Trigger copia linhas apagadas/alteradas | Não depende do código | Perde a semântica (qual ação do usuário) e o autor; difícil de testar e evoluir com Prisma | Só como complemento (seção 8.4) |

### 5.2 Justificativa da recomendação

**Soft delete com evento** é a única opção que mantém ao mesmo tempo:

- **Os vínculos:** "esta decisão gerou esta task", "esta task dependia daquela", "este requisito era desta Feature". São FKs reais e continuam válidas.
- **A navegação:** o link do histórico continua abrindo uma página, agora em modo somente leitura com o motivo do arquivamento.
- **O conteúdo final:** o snapshot fica no evento de arquivamento.
- **A simplicidade:** nenhuma tabela nova para cada entidade, nenhuma mudança na forma de consultar os vínculos.

O custo (filtrar arquivados no estado atual) é controlável com helpers explícitos de "somente ativos" e com a suíte de aceite.

### 5.3 Comportamento do arquivamento

- **Botão:** "Excluir" passa a ser **"Arquivar"**, com motivo obrigatório (DV-02, DV-14).
- **Onde o item arquivado some:**
  - listas e contadores ("Tasks 5/9");
  - Dashboard e pauta sugerida;
  - opções de novos vínculos (ex.: "Depende de").
- **Onde ele continua aparecendo:**
  - nos históricos;
  - na origem, marcado: a decisão mostra "1 task arquivada";
  - na página própria, com a faixa "Arquivada em … por … — motivo: …".
- **Item arquivado não é editável** e não recebe novos vínculos. Restaurar (se aprovado em DV-03) exige motivo e gera evento.
- **Dependências:** uma task que dependia de uma task arquivada mostra "depende de (arquivada)", e isso não bloqueia nada.
- **Não arquiváveis:**
  - task concluída (é evidência de trabalho feito);
  - requisitos e critérios de Feature em Validation ou Done.
- **Entidades sem exclusão hoje continuam sem exclusão** (Feature, Decision, Meeting, Person, Product). Tirá-las de circulação é mudança de **estado**, não de existência: decisão revogada, pessoa inativa, Feature descartada (G14, ciclo futuro).
- **O que não se recupera:** tasks excluídas fisicamente antes da V0.3-A. Os eventos delas continuam aparecendo como `Task "X" (excluída)` (microfix da auditoria).

---

## 6. Evolução do Activity Log

### 6.1 Limitações atuais

- A única carga do evento é um texto livre: "Decisão … foi editada". Não diz o que mudou nem guarda o valor anterior.
- `entityId` inconsistente: eventos de requisito, critério e validação apontam para a Feature, não para o item.
- Cada página filtra do seu jeito. O Histórico da Feature exclui requisitos e tasks excluídas e mostra só os 30 últimos.
- Evento sem autor quando não há usuário selecionado.
- Eventos artificiais do seed sem marcação.
- Gravação fora da transação da mudança.
- Para mostrar uma task excluída, a UI precisa extrair o título do texto (o microfix usa uma expressão regular).

### 6.2 Modelo do evento (v2)

O evento passa a ter duas partes. É uma evolução aditiva da tabela atual, e eventos antigos continuam válidos.

**Cabeçalho** (`ActivityLog`, evoluído):

| Campo | Para quê |
|---|---|
| `entityType`, `entityId` | A entidade que mudou (sempre o id do próprio item, inclusive requisito e validação) |
| `eventType` | A ação (`task.updated`, `decision.superseded`, …) |
| `actorId`, `actorName` | Quem fez; nome no momento. Obrigatório para ações da aplicação |
| `entityLabel` | Nome da entidade no momento (título da task, da decisão) |
| `correlationId` | Agrupa os eventos de uma mesma ação do usuário |
| `reason` | Motivo, quando a ação é sensível |
| `context` | Entidades relacionadas no momento: ids, rótulos e textos relevantes |
| `snapshot` | Estado completo da entidade em `created`, `archived`, `restored` e `baseline` |
| `featureId`, `decisionId`, `meetingId`, `productId` | Escopos: em quais históricos o evento aparece |
| `source` | `app`, `seed`, `migration` ou `legacy` |
| `schemaVersion` | 1 = legado (só texto) · 2 = estruturado |
| `seq` | Ordem total dos eventos, inclusive dentro da mesma transação |
| `description` | Resumo legível, gerado dos dados estruturados |
| `createdAt` | Momento do servidor |

**Linhas de mudança** (`ActivityChange`, nova): uma por campo alterado, com `field`, `fromValue`, `toValue`, `fromLabel` e `toLabel`. Exemplos: rótulos "Pedro" → "Linard" para `assigneeId`; títulos de reunião para `meetingId`.

### 6.3 Exemplos

**Troca de responsável e de prazo de uma task**

```json
{
  "eventType": "task.updated",
  "entityType": "task", "entityId": "tsk_backend", "entityLabel": "Implementar backend",
  "actorId": "per_heitor", "actorName": "Heitor", "correlationId": "cmd_01",
  "featureId": "fea_plano", "decisionId": "dec_macros", "meetingId": "mee_1609", "productId": "pro_nutria",
  "changes": [
    { "field": "assigneeId", "fromValue": "per_pedro", "toValue": "per_linard", "fromLabel": "Pedro", "toLabel": "Linard" },
    { "field": "dueDate", "fromValue": "2026-09-25", "toValue": "2026-09-30" }
  ]
}
```

Na UI: **Heitor alterou a task "Implementar backend"** · Responsável: Pedro → Linard · Prazo: 25/09 → 30/09. A linha aparece nos históricos da task, da Feature, da decisão de origem e da reunião, pelos escopos.

**Substituição de uma decisão** (dois eventos, mesma correlação)

```json
[
  {
    "eventType": "decision.created", "entityType": "decision", "entityId": "dec_v2",
    "entityLabel": "Cálculo de macros via biblioteca externa",
    "context": { "supersedes": { "id": "dec_macros", "title": "Plano Alimentar incluirá cálculo automático de macronutrientes" } },
    "snapshot": { "decision": "…", "reason": "…", "authorId": "per_heitor", "decidedAt": "2026-10-02" }
  },
  {
    "eventType": "decision.superseded", "entityType": "decision", "entityId": "dec_macros",
    "reason": "O teste de desempenho mostrou que o cálculo próprio não atende os 3 s",
    "changes": [ { "field": "status", "fromValue": "ACTIVE", "toValue": "SUPERSEDED" } ],
    "context": { "supersededBy": { "id": "dec_v2", "title": "Cálculo de macros via biblioteca externa" } }
  }
]
```

Na página da decisão antiga: **Substituída por "Cálculo de macros via biblioteca externa"** — Heitor, 02/10 — motivo: … . O texto original continua sendo o conteúdo exibido, e as tasks geradas por ela continuam listadas.

**Aprovação de uma validação** (dois eventos, mesma correlação)

```json
[
  {
    "eventType": "validation.recorded", "entityType": "validation", "entityId": "val_2", "entityLabel": "Tentativa 2",
    "featureId": "fea_plano", "productId": "pro_nutria",
    "changes": [
      { "field": "result", "toValue": "APPROVED" },
      { "field": "criteria:cri_1", "fromValue": "FAILED", "toValue": "PASSED",
        "toLabel": "Cálculo de macros bate com valores de referência" }
    ]
  },
  {
    "eventType": "feature.status_changed", "entityType": "feature", "entityId": "fea_plano",
    "changes": [ { "field": "status", "fromValue": "VALIDATION", "toValue": "DONE" } ]
  }
]
```

### 6.4 Escopos: históricos completos por agregado

Cada evento carrega os escopos de onde a entidade pertencia **no momento**. Como a origem das tasks é imutável, os escopos não mudam depois.

| Evento sobre | `featureId` | `decisionId` | `meetingId` | `productId` |
|---|---|---|---|---|
| Feature | A própria | — | — | Product da Feature |
| Requirement, Critério, Validação | Feature dona | — | — | Product |
| Task | Feature da task | Decisão de origem | Reunião de origem (direta ou via decisão) | Product |
| Decision | Feature afetada | A própria | Reunião de origem | Product afetado |
| Meeting | — | — | A própria | — |

Resultados:
- **Histórico da Feature** = todos os eventos com `featureId` = Feature: ela, requisitos, critérios, validações, tasks (inclusive arquivadas) e decisões que a afetam. Fecha a G08.
- **Históricos da Decision, da Meeting e do Product:** mesma regra.

### 6.5 Reconstrução do passado

- **Estado de uma entidade no momento T:** parte do snapshot mais recente com `seq` até T (`created`, `baseline` ou `restored`) e aplica as linhas de mudança seguintes, em ordem de `seq`, até T.
- **Casos que a V0.3-A mostra na UI:**
  - **"Versão original" da decisão:** o conteúdo antes das correções;
  - **"O que foi aprovado":** o snapshot da tentativa de validação.
- **Reconstrução genérica** (qualquer entidade, qualquer data): fica disponível como função testada, sem tela própria (DV-15).
- **Antes da migração:** a reconstrução só é completa a partir do evento `baseline`. O que aconteceu antes continua como registro legado.

### 6.6 Compatibilidade com eventos antigos

- Eventos com `schemaVersion = 1` continuam sendo exibidos pelo texto original, com o selo **"registro anterior à V0.3"**.
- Nenhum texto, autor ou data de evento antigo é alterado.
- A migração só **acrescenta** metadados de indexação (escopos, rótulo, `source`) antes de a imutabilidade ser ativada (DV-21).
- Eventos de tipos que o produto nunca emitiu (`artifact.linked`, `feature.field_changed`, `requirement.added` agregado, `task.created` com `entityType = feature`) recebem `source = seed` e aparecem com o selo "demonstração".

---

## 7. Relações históricas

| Relação | Hoje | V0.3-A |
|---|---|---|
| Decision → Meeting | `meetingId` editável a qualquer momento; o histórico diz só "editada" | Trava junto com o mérito. Antes da trava, qualquer mudança vira linha de → para com título e data da reunião. O evento de criação guarda a reunião no contexto. FK `RESTRICT` |
| Decision → Task | Task excluída some; a decisão volta a "sem task" e perde o registro | `Task.decisionId` imutável; task só é arquivada. A decisão lista tasks arquivadas. O evento de criação da task guarda o texto da decisão naquele momento. Escopo `decisionId` |
| Feature → Requirement | Requisito editável e excluível até em Done; eventos fora do histórico da Feature | Requisito arquivado, nunca apagado. Congelado em Validation e Done. Eventos com `entityId` = requisito e escopo `featureId`. Snapshot na validação |
| Feature → Validation | Snapshot só dos critérios (sem id); validador pode ser nulo | Tentativa com validador obrigatório e nome no momento, critérios com id, requisitos, tasks e Feature. Imutável no banco |
| Task → origem | Origem não editável pela UI, mas não protegida no backend; task excluída perde tudo | Origem imutável (o backend recusa qualquer mudança). Contexto de origem no evento de criação. O arquivamento preserva tudo |
| Responsáveis | Troca registrada só como "editada" | Linha de → para com nomes. O responsável em qualquer data é reconstruível |
| Participantes | Lista apagada e recriada a cada edição, sem registro | Linha `participants` com conjunto anterior e novo. Depois da reunião realizada ou da decisão travada: sensível ou congelado |

---

## 8. Impacto no banco/schema

> Proposta para orientar a implementação. **Nada foi aplicado.** Nomes e detalhes finais podem mudar na implementação, sem mudar as regras.

### 8.1 Schema proposto

```prisma
// ---------- Histórico ----------

model ActivityLog {
  id          String   @id @default(cuid())
  seq         BigInt   @default(autoincrement()) @unique // ordem total (validar suporte; alternativa: coluna via SQL)
  entityType  String
  entityId    String
  eventType   String
  actorId     String?                                     // obrigatório para source = "app" (regra R01)
  actorName   String?
  description String
  createdAt   DateTime @default(now())

  // novos (aditivos)
  schemaVersion Int     @default(1)     // 1 = legado · 2 = estruturado
  source        String  @default("app") // app | seed | migration | legacy
  correlationId String?
  entityLabel   String?
  reason        String?
  context       Json?
  snapshot      Json?
  featureId     String?
  decisionId    String?
  meetingId     String?
  productId     String?
  changes       ActivityChange[]

  @@index([entityType, entityId, seq])
  @@index([featureId, seq])
  @@index([decisionId, seq])
  @@index([meetingId, seq])
  @@index([productId, seq])
  @@index([actorId, seq])
  @@index([correlationId])
  @@index([createdAt])
}

model ActivityChange {
  id        String      @id @default(cuid())
  eventId   String
  event     ActivityLog @relation(fields: [eventId], references: [id], onDelete: Restrict)
  field     String      // campo do schema: "priority", "assigneeId", "decision", "participants", "criteria:<id>"
  fromValue Json?
  toValue   Json?
  fromLabel String?
  toLabel   String?

  @@index([eventId])
  @@index([field])
}

// ---------- Arquivamento (Task, Requirement, AcceptanceCriteria) ----------

model Task {
  // …campos atuais…
  archivedAt    DateTime?
  archivedById  String?
  archivedBy    Person?   @relation("TaskArchivedBy", fields: [archivedById], references: [id], onDelete: Restrict)
  archiveReason String?

  @@index([featureId, archivedAt])
}
// Requirement e AcceptanceCriteria recebem os mesmos quatro campos e o mesmo índice por featureId.

// ---------- Decision: substituição e revogação ----------

enum DecisionStatus {
  ACTIVE
  SUPERSEDED
  REVOKED
}

model Decision {
  // …campos atuais…
  status       DecisionStatus @default(ACTIVE)
  supersedesId String?        @unique
  supersedes   Decision?      @relation("DecisionSupersession", fields: [supersedesId], references: [id], onDelete: Restrict)
  supersededBy Decision?      @relation("DecisionSupersession")
  revokedAt    DateTime?
  revokedById  String?
  revokedBy    Person?        @relation("DecisionRevokedBy", fields: [revokedById], references: [id], onDelete: Restrict)
  revokeReason String?
  // "travada" é derivado: tem task gerada (mesmo arquivada) OU createdAt + janela < agora (DV-05)
}

// ---------- ValidationRecord: snapshots ampliados ----------

model ValidationRecord {
  // …campos atuais; criteriaSnapshot passa a incluir o id de cada critério…
  requestedResult      ValidationResult? // o que o validador pediu (APPROVED pode virar REJECTED pelo gate)
  validatedByName      String?
  requirementsSnapshot Json?             // [{ id, description, priority, status, source }]
  tasksSnapshot        Json?             // [{ id, title, status, assigneeId, assigneeName }]
  featureSnapshot      Json?             // narrativa, prioridade e responsáveis (ids + nomes)
}
```

`Person` recebe as relações inversas correspondentes (`TaskArchivedBy`, `RequirementArchivedBy`, `CriteriaArchivedBy`, `DecisionRevokedBy`).

**Sem colunas novas** em `Feature` e `Meeting`: as travas derivam do status (Feature) e da data e das decisões (Meeting).

### 8.2 Chaves estrangeiras

Hoje, as relações opcionais usam `ON DELETE SET NULL`. Com a regra "nada é apagado", esse comportamento só dispararia numa exclusão acidental direto no banco, e aí **apagaria vínculos históricos em silêncio**.

A proposta é trocar para `RESTRICT` nas relações abaixo, para que uma exclusão acidental falhe em vez de destruir contexto:

| Tabela | Colunas |
|---|---|
| Feature | `releaseId`, `ownerId`, `architectId`, `techLeadId` |
| Task | `featureId`, `parentTaskId`, `assigneeId`, `createdById`, `reviewerId`, `decisionId`, `meetingId` |
| Decision | `authorId`, `meetingId`, `featureId`, `productId` |
| Artifact | `featureId`, `meetingId`, `decisionId`, `authorId` |
| ValidationRecord | `validatedById` |

Isso **não apaga nem altera dados**, mas não é uma mudança puramente aditiva: é uma exceção à regra combinada para migrations, por isso está em DV-20. Exige que o reset de desenvolvimento/demo use `TRUNCATE … CASCADE`. O reset atual apaga decisões antes das tasks e falharia com `RESTRICT`.

### 8.3 Índices

- **Históricos por escopo:** `(featureId, seq)`, `(decisionId, seq)`, `(meetingId, seq)`, `(productId, seq)`.
- **Histórico da entidade:** `(entityType, entityId, seq)`.
- **Por pessoa:** `(actorId, seq)`.
- **Agrupamento por ação:** `(correlationId)`.
- **Linhas de mudança:** `(eventId)` e `(field)`.
- **Estado atual sem arquivados:** `(featureId, archivedAt)` em Task, Requirement e AcceptanceCriteria. Opcional: índices parciais `WHERE "archivedAt" IS NULL` via SQL.

Volume esperado: centenas a poucos milhares de eventos por mês. Os índices são para consultas simples e paginação, não para desempenho crítico.

### 8.4 Imutabilidade no banco

Dois níveis de proteção, via SQL na própria migration (DV-19):

```sql
CREATE OR REPLACE FUNCTION hmp_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'HMP OS: % em % não é permitido (histórico preservado)', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- histórico: somente inserção
CREATE TRIGGER activity_log_append_only    BEFORE UPDATE OR DELETE ON "ActivityLog"      FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER activity_change_append_only BEFORE UPDATE OR DELETE ON "ActivityChange"   FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER validation_append_only      BEFORE UPDATE OR DELETE ON "ValidationRecord" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();

-- domínio: sem exclusão física
CREATE TRIGGER task_no_delete BEFORE DELETE ON "Task" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
-- idem Requirement, AcceptanceCriteria, Feature, Decision, Meeting, Person, Product
```

- Triggers por linha não disparam em `TRUNCATE`. Por isso o reset de desenvolvimento e o seed continuam possíveis, e só eles, via `TRUNCATE`.
- Triggers não aparecem no `schema.prisma`: ficam documentados na migration e no README.

### 8.5 O que não muda

- Enums de status de Feature e Task e as regras de workflow da V0.2.
- A estrutura de `Requirement`, `AcceptanceCriteria`, `Meeting` e dos participantes.
- Nenhuma tabela é removida, nenhuma coluna é renomeada ou apagada.

---

## 9. Regras de integridade

Situações proibidas para impedir que o passado seja reescrito. O backend recusa com mensagem na própria tela (padrão `ActionError` da V0.2); a UI só antecipa.

| # | Proibido | Onde é garantido |
|---|---|---|
| R01 | Escrever sem autor declarado (única exceção: carregar a demo com banco vazio) | Backend |
| R02 | Alterar ou apagar registros de histórico (`ActivityLog`, `ActivityChange`, `ValidationRecord`) | Backend + banco (trigger) |
| R03 | Apagar fisicamente entidades de domínio | Backend + banco (trigger, FKs `RESTRICT`) |
| R04 | Mudar estado sem gravar o evento correspondente, ou gravar evento sem mudar estado | Backend (transação única) |
| R05 | Editar narrativa, requisitos ou critérios de Feature em Validation ou Done | Backend |
| R06 | Mudar prioridade, responsáveis ou status de Feature em Done | Backend |
| R07 | Voltar o status de uma Feature sem motivo | Backend |
| R08 | Mudar a origem de uma task (Feature, decisão, reunião, criador, momento de criação) | Backend |
| R09 | Editar task concluída sem reabrir; reabrir sem motivo; arquivar task concluída | Backend |
| R10 | Reabrir ou editar o conteúdo de tasks de uma Feature em Done | Backend |
| R11 | Editar o mérito de decisão travada; corrigir o título dela sem motivo | Backend |
| R12 | Gerar task, editar ou substituir uma decisão já substituída ou revogada | Backend |
| R13 | Substituir ou revogar decisão sem motivo | Backend |
| R14 | Registrar decisão com data futura | Backend |
| R15 | Remarcar ou mudar participantes de reunião realizada (ou com decisões) sem motivo | Backend |
| R16 | Arquivar ou restaurar sem motivo; editar item arquivado; criar vínculo novo com item arquivado (ex.: depender de task arquivada) | Backend |
| R17 | Registrar validação sem validador | Backend (consequência de R01) |
| R18 | Definir manualmente o momento de um evento | Backend + banco (`default now()`) |
| R19 | Apagar uma pessoa referenciada pelo histórico (o caminho é inativar) | Banco (`RESTRICT` + trigger) |
| R20 | Gravar evento estruturado sem rótulo da entidade ou sem os escopos aplicáveis | Backend (pipeline) + teste |

---

## 10. Migração do estado atual

**Premissa:** nenhum dado da V0.2 é apagado ou perde significado, e o sistema continua funcionando durante a transição.

1. **Ensaio (DV-22).** Rodar a migration numa **branch do Neon criada a partir da produção** e passar a suíte de aceite antes do deploy. Exige uma ação sua no painel do Neon.
2. **Migration**, uma só, nesta ordem:
   1. **DDL aditivo:** colunas novas (com default ou nulas), tabela `ActivityChange`, enum `DecisionStatus` com default `ACTIVE`, índices.
   2. **FKs `SET NULL` → `RESTRICT`** (DV-20).
   3. **Enriquecimento dos eventos antigos** (DV-21). O texto, o autor e a data não mudam:
      - `source = 'seed'` para os tipos que o produto nunca emite; `source = 'legacy'` para os demais;
      - escopos a partir das relações atuais. Eventos de requisito e validação já têm a Feature como `entityId`; tasks via `Task.featureId`/`decisionId`; decisões via `featureId`/`meetingId`;
      - `entityLabel` a partir do nome atual da entidade. Para tasks já excluídas, extraído da descrição, como o microfix faz.
   4. **`validatedByName`** das tentativas existentes, a partir de `Person`.
   5. **Baseline:** um evento `<entidade>.baseline` (`source = 'migration'`, `schemaVersion = 2`, snapshot do estado atual) para cada Feature, Requirement, AcceptanceCriteria, Task, Decision, Meeting, Person e Product. Marca a fronteira "a partir daqui, histórico completo".
   6. **Triggers de imutabilidade.** Só depois do enriquecimento, que é a única alteração feita em eventos antigos.
3. **Código.**
   - Pipeline de comandos e novas regras.
   - Renderização dupla no histórico: legado pelo texto, v2 pelas linhas de mudança.
   - Páginas de itens arquivados.
4. **Seed e demo.**
   - Eventos do seed com `source = 'seed'`.
   - Reset por `TRUNCATE … CASCADE`.
   - `/api/admin/seed` desativado em produção, salvo flag explícita (DV-17).
   - O botão "Carregar dados de demonstração" com banco vazio continua: ele só insere dados.
5. **Deploy pelo build,** como hoje (`prisma migrate deploy && next build`).

**Compatibilidade**
- Tentativas de validação antigas mostram "registrada antes da V0.3 — sem snapshot de requisitos e tasks".
- Decisões existentes nascem `ACTIVE`, com a trava calculada pelas regras novas.

**Rollback**
- O esquema é aditivo: voltar o código é seguro.
- Exceção: o código antigo de exclusão física passa a falhar por causa das travas no banco. É o comportamento desejado.

**Limitação honesta:** o que a V0.2 já perdeu não volta. Isso inclui tasks excluídas, valores sobrescritos e participantes substituídos. O histórico completo começa no baseline.

---

## 11. Critérios de aceite da V0.3-A

Todos verificáveis pela UI (formulários normais e adulterados) com conferência no banco. Os que dependem de uma decisão indicam o DV.

**Autoria e atomicidade**
- **CA-01** — Sem usuário selecionado, toda escrita é recusada com mensagem na própria tela e nada muda no banco, nem estado nem histórico. Vale para criar, editar, mudar status, arquivar, restaurar, validar, substituir e revogar. Exceção: carregar a demo com banco vazio. (DV-01)
- **CA-02** — Toda escrita bem-sucedida gera ≥1 evento v2 com autor, entidade, rótulo, escopos corretos e correlação. Uma ação que afeta várias entidades gera eventos com a mesma correlação.
- **CA-03** — Se a gravação do evento falhar (falha simulada em teste), a mudança de estado não é aplicada.
- **CA-04** — Salvar um formulário sem alterar nada não gera evento.

**O que mudou**
- **CA-05** — Mudar a prioridade de P2 para P0: o histórico da Feature mostra "Prioridade: P2 → P0", com autor e data, e o evento tem a linha `priority` de/para.
- **CA-06** — Trocar o responsável de uma task de Pedro para Linard gera uma linha com ids e nomes. A troca aparece nos históricos da task, da Feature e da decisão de origem.
- **CA-07** — Editar um texto longo (problema da Feature, notas da reunião, texto da decisão dentro da janela): o texto anterior completo é recuperável no histórico ("ver anterior").
- **CA-08** — Adicionar e remover participantes registra o conjunto anterior e o novo; a UI mostra quem entrou e quem saiu.
- **CA-09** — Bloquear uma task com motivo registra o motivo no evento daquela transição. Ele continua lá mesmo depois de desbloquear ou de trocar o motivo.

**Travas**
- **CA-10** — Feature em Validation: editar narrativa, criar, editar ou arquivar requisito ou critério é recusado pelo backend, inclusive com formulário adulterado. A UI mostra os campos travados com explicação. (DV-08)
- **CA-11** — Feature em Done:
  - nenhuma edição de campo, requisito ou critério, e nenhuma mudança de status;
  - tasks concluídas dela não podem ser reabertas nem arquivadas;
  - tasks abertas só mudam de status ou são arquivadas com motivo. (DV-13)
- **CA-12** — Voltar o status de uma Feature sem motivo é recusado. Com motivo, o motivo aparece no histórico. (DV-09)
- **CA-13** — Task concluída: editar o conteúdo e arquivar são recusados; "Reabrir" exige motivo e gera evento. (DV-04)
- **CA-14** — A origem de uma task (Feature, decisão, reunião, criador) não muda por nenhum caminho, inclusive formulário adulterado.
- **CA-15** — Decisão travada (task gerada ou janela encerrada): editar o mérito é recusado. Corrigir o título exige motivo e mantém o anterior no histórico. (DV-05, DV-06)
- **CA-16** — Substituir uma decisão cria uma nova decisão com o vínculo "substitui". (DV-07)
  - A anterior fica `SUPERSEDED`, visível e com suas tasks, e não pode gerar novas tasks nem ser editada.
  - Revogar exige motivo e tem o mesmo efeito de bloqueio.
- **CA-17** — Reunião realizada: mudar a data ou os participantes exige motivo; pauta e notas continuam editáveis, com histórico. (DV-10)
- **CA-18** — Data de decisão no futuro é recusada. A página da decisão mostra "decidida em" e "registrada em". (DV-11)

**Exclusões**
- **CA-19** — "Arquivar" task, requisito ou critério exige motivo. (DV-02, DV-14)
  - A linha continua no banco com arquivada em/por/motivo.
  - Some das listas, dos contadores, do Dashboard e da pauta.
  - Aparece nos históricos e na origem como "arquivada", com página própria somente leitura.
- **CA-20** — Nenhum fluxo da UI apaga linhas de tabelas de domínio. Teste: a contagem de linhas nunca diminui depois de qualquer fluxo. Uma exclusão direta no banco falha (trigger).
- **CA-21** — Uma decisão cuja única task foi arquivada continua mostrando que gerou trabalho (task listada como arquivada), e o evento de criação continua navegável.
- **CA-22** — Restaurar um item arquivado exige motivo e gera evento. (DV-03)

**Histórico completo**
- **CA-23** — O histórico da Feature inclui todos os eventos com escopo nela: a própria Feature, requisitos, critérios, validações, tasks (inclusive arquivadas) e decisões que a afetam. É paginado, sem limite fixo.
- **CA-24** — Os históricos da Decision, da Meeting e do Product seguem a mesma regra por escopo.

**Validação**
- **CA-25** — Cada tentativa nova guarda:
  - validador (nunca nulo) e nome no momento;
  - resultado solicitado e resultado final;
  - critérios com id;
  - requisitos vigentes;
  - tasks, com status e responsável;
  - dados da Feature.

  A tela mostra "o que foi aprovado" a partir do snapshot.

**Imutabilidade**
- **CA-26** — `UPDATE` ou `DELETE` direto em `ActivityLog`, `ActivityChange` ou `ValidationRecord` falha no banco. (DV-19)

**Relações e contexto**
- **CA-27** — Criar uma task a partir de uma decisão grava no evento a decisão (id, título, texto) e a reunião (id, título, data) daquele momento. Mudanças posteriores na decisão, quando permitidas, não alteram esse contexto.

**Migração**
- **CA-28** — Depois da migração:
  - todos os dados da V0.2 continuam visíveis e navegáveis;
  - eventos antigos aparecem com o texto original e o selo "registro anterior à V0.3";
  - cada entidade existente tem um evento baseline;
  - eventos do seed aparecem marcados como demonstração.
- **CA-29** — As regressões da V0.2 continuam passando: fluxo, gates, erros, Dashboard e rotas.

---

## 12. Proposta de arquitetura da V0.3-A

```
┌──────────────────────────────── UI (Server Components) ────────────────────────────────┐
│  telas de estado atual            históricos por agregado             páginas arquivadas │
│  (somente ativos)                 (Feature · Decision · Meeting)       (somente leitura)  │
└──────────────┬──────────────────────────────────────┬───────────────────────────────────┘
               │ formulários                           │ leitura
               ▼                                       ▼
┌──────── Pipeline de comandos (Server Actions) ───┐  ┌──────── Leitura de histórico ─────────┐
│ 1. exige autor declarado                (R01)    │  │ getHistory(escopo, cursor)            │
│ 2. carrega o estado atual (na transação)         │  │ renderização: legado × v2             │
│ 3. política: livre · sensível · congelado        │  │ reconstructAt(entidade, momento)      │
│ 4. calcula o diff (sem mudança → nada)           │  │ "versão original" · "o que foi        │
│ 5. grava estado + evento + mudanças     (R04)    │  │  aprovado"                            │
│    em UMA transação, com correlationId           │  └──────────────────┬────────────────────┘
└──────────────┬───────────────────────────────────┘                     │
               ▼                                                         ▼
┌──── Estado atual (tabelas de domínio) ────┐    ┌──── Histórico (somente inserção) ─────────────┐
│ Feature · Task · Requirement · Decision … │    │ ActivityLog v2 + ActivityChange                │
│ + archivedAt / archivedBy / archiveReason │    │ snapshots: created · archived · baseline       │
│ + Decision.status / supersedes / revoked  │    │ ValidationRecord + snapshots ampliados         │
│ triggers: sem DELETE físico               │    │ triggers: UPDATE e DELETE proibidos            │
└───────────────────────────────────────────┘    └────────────────────────────────────────────────┘
```

### 12.1 Componentes

1. **Pipeline de comandos (caminho de escrita).** Todas as Server Actions passam por um executor único que:
   - resolve o autor;
   - abre a transação e carrega o estado;
   - consulta a política;
   - calcula as linhas de mudança;
   - grava estado e eventos juntos.

   Substitui as chamadas soltas a `logActivity` feitas depois da mutação. Continua devolvendo `ActionResult` (erros esperados na própria tela, padrão da V0.2).
2. **Políticas (fonte única das regras).** Uma tabela declarativa entidade × estado × campo → livre, sensível ou congelado, com as mensagens.
   - O backend usa para decidir.
   - A UI usa só para exibir travas e pedir motivo.

   É o mesmo espírito do `disabledReasonFor`, que hoje espelha `assertValidManualTransition`.
3. **Armazenamento do histórico.**
   - `ActivityLog` v2 com linhas `ActivityChange`, snapshots e escopos.
   - `ValidationRecord` com snapshots ampliados.
   - Imutabilidade garantida no banco.
4. **Leitura.**
   - Histórico paginado por escopo.
   - Um renderizador único que entende eventos legados e estruturados, substituindo a extração por texto do microfix nos eventos novos.
   - Função de reconstrução por momento, testada.
   - Páginas de itens arquivados.
5. **Estado atual.** Helpers explícitos de "somente ativos" nas consultas de trabalho.
   - Preferidos a um filtro global no Prisma, porque as telas de histórico precisam ver arquivados, e o explícito é mais fácil de testar.

### 12.2 Consequências diretas em telas existentes

- **Botões "Excluir"** viram "Arquivar" com motivo.
- **Edição de decisão travada** mostra os campos bloqueados e as ações "Substituir por nova decisão" e "Revogar".
- **Task concluída** mostra "Reabrir" (com motivo) em vez de edição livre.
- **Históricos** passam a mostrar as linhas de mudança ("Prioridade: P2 → P0"), agrupadas por ação.
- **Dashboard:**
  - "Features paradas" passa a usar o escopo `featureId`, que é completo;
  - uma decisão cuja task foi arquivada conta como "teve desdobramento", o que remove um falso positivo de "Decisões sem task".

### 12.3 Fatiamento sugerido (para depois da validação)

1. Schema, migration, enriquecimento, baseline e triggers, ensaiados sobre uma cópia dos dados.
2. Pipeline de comandos + autor obrigatório + eventos v2 em Task (menor superfície, valida o desenho).
3. Requirement e Critério (arquivamento) + travas da Feature.
4. Decision: janela, travas, substituição e revogação.
5. Meeting e participantes.
6. Validação com snapshots ampliados.
7. Leitura: históricos por escopo, renderizador, páginas arquivadas.
8. Seed/demo + suíte de aceite versionada + regressão da V0.2.

---

## 13. Decisões para validar antes de qualquer código

Cada decisão traz uma recomendação. Basta confirmar ou ajustar.

### 13.1 Decisões de produto

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| DV-01 | Autor obrigatório em toda escrita | Sim / Não | **Sim.** Muda a UX: escolher "quem sou eu" antes de agir. Exceção: demo com banco vazio |
| DV-02 | "Excluir" vira arquivamento com motivo obrigatório (Task, Requisito, Critério); nada é apagado fisicamente | Sim / Não | **Sim** |
| DV-03 | Restaurar item arquivado | Permitido com motivo / Não permitido | **Permitido com motivo** |
| DV-04 | Task concluída | (a) Não arquivável; editar só reabrindo com motivo · (b) Editável com histórico | **(a)** |
| DV-05 | Quando o mérito de uma decisão trava | (a) Na primeira task gerada · (b) Fim da janela de correção (24 h após o registro) ou primeira task, o que vier antes · (c) Imediatamente | **(b)**. Com (a), decisões sem task (como a de priorização P0) seguiriam reescrevíveis para sempre |
| DV-06 | O que é "mérito" (congelado) e o que é "correção" (sensível) | — | **Mérito:** decisão, contexto, justificativa, alternativas, autor, data, reunião, afeta, participantes. **Correção:** só o título, com motivo |
| DV-07 | Mudar mérito depois da trava | Nova decisão que substitui (`SUPERSEDED`) + revogação com motivo (`REVOKED`) | **Incluir os dois na V0.3-A.** "Sem ação necessária" e o sinal do Dashboard ficam para a V0.3-C |
| DV-08 | Quando narrativa e requisitos da Feature travam | Em Validation (junto com os critérios) / Já em Review | **Validation**, congelados em Done |
| DV-09 | Voltar o status da Feature exige motivo | Sim / Não | **Sim** |
| DV-10 | Reunião realizada ou com decisões | Data e participantes exigem motivo; pauta e notas livres com histórico | **Sim** |
| DV-11 | Data da decisão | Proibir data futura; mostrar "decidida em" e "registrada em"; forçar a data da reunião? | **Proibir futura e mostrar as duas; não forçar** a data da reunião |
| DV-12 | Onde o motivo é obrigatório | — | Arquivar, restaurar, voltar status de Feature, reabrir task, corrigir decisão travada, substituir, revogar, remarcar reunião realizada. **Opcional:** repriorizar |
| DV-13 | Tasks abertas de uma Feature em Done (enquanto o gate G04 não é tratado) | Só mudança de status e arquivamento com motivo / Congelar tudo | **Só status e arquivamento com motivo** |
| DV-14 | Nomenclatura | "Arquivar"/"Arquivada" / manter "Excluir" | **"Arquivar"** (a ação não apaga mais) |
| DV-15 | "Máquina do tempo" na UI | Entra / Fica fora | **Fica fora.** A V0.3-A entrega o dado, a função testada e as telas "versão original" (decisão) e "o que foi aprovado" (validação) |
| DV-16 | Autenticação | Aceitar autor declarado (sem login) / Incluir autenticação mínima | **Aceitar agora e registrar como limitação.** O histórico garante *que* há um autor, não *que* o autor é quem diz ser. Decidir em ciclo próprio |
| DV-17 | Reset total da demo (`/api/admin/seed`) em produção | Desativar / Manter com flag explícita / Remover | **Desativar em produção** (só com flag explícita). Uma rota que apaga tudo contradiz a auditabilidade |

### 13.2 Decisões técnicas (recomendação; basta concordar)

| # | Decisão | Recomendação |
|---|---|---|
| DV-18 | Modelo de histórico | **Eventos estruturados** (cabeçalho + linhas de mudança + escopos) com **snapshots em pontos de contrato**. Sem tabelas de versão por entidade e sem event sourcing (seção 5.1) |
| DV-19 | Imutabilidade no banco | **Sim:** triggers que proíbem `UPDATE`/`DELETE` no histórico e `DELETE` nas tabelas de domínio. Reset de desenvolvimento/demo passa a usar `TRUNCATE` |
| DV-20 | FKs `SET NULL` → `RESTRICT` (seção 8.2) | **Sim.** Não apaga dados, mas é uma exceção à regra "migration aditiva" e precisa do seu aceite explícito |
| DV-21 | Eventos antigos | **Enriquecer uma única vez** (escopos, rótulo, `source`) antes de ativar a imutabilidade, sem mudar texto, autor ou data. **Baseline** de todas as entidades. Seed marcado como demonstração |
| DV-22 | Ensaio da migração | **Sim, numa branch do Neon** criada a partir da produção. Exige sua ação ou autorização no Neon |
| DV-23 | Critérios de aceite como suíte versionada no repositório | **Sim.** Hoje as validações dependem de scripts fora do repositório (débito D05 da auditoria) |

Com essas decisões confirmadas, a implementação pode seguir o fatiamento da seção 12.3, sem nenhuma escolha de produto pendente.
