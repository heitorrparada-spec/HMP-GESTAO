# HMP OS — Operational Audit V0.2

> Segunda auditoria operacional, feita depois das versões V0.2-A (Feature e Tasks operacionais), V0.2-B (workflow com gates de Review/Validation/Done), V0.2-C (Meeting → Decision → Task) e V0.2-D (Dashboard como cockpit).
>
> **Pergunta central:** o HMP OS deixou de ser principalmente um CRUD e passou a funcionar como um sistema operacional do processo de desenvolvimento?
>
> **Base auditada:** `main` em `43a3846` (merge do PR #5; conteúdo idêntico a `e4b7a95`), em 2026-09-23.
>
> **Método:** leitura do código e do schema (fonte da verdade, não a documentação) + comportamento real. O comportamento foi testado pela UI com Chromium automatizado (Playwright), contra o banco local com o seed atual, conferindo o resultado direto no Postgres. Os testes de comportamento estão numerados P1–P13 e citados ao longo do texto.
>
> **Nenhuma funcionalidade foi alterada**, exceto o microfix combinado (seção 8.4): eventos de Task excluída aparecem como `Task "X" (excluída)`, sem link quebrado.

**Classificação usada em cada lacuna:**

- **BLOCKER** — impede o HMP de conduzir uma parte importante do processo.
- **IMPORTANT** — prejudica significativamente a rastreabilidade ou a operação.
- **MINOR** — melhoria útil, mas não impede uso.
- **DEBT** — questão técnica/arquitetural que não afeta diretamente o processo atual.

Cada lacuna tem um identificador (`G01`…, `D01`…) usado nas seções. A lista consolidada está na seção 19.1.

**Testes de comportamento executados pela UI** (seed limpo; resultado conferido no banco):

| # | Teste | Resultado |
|---|---|---|
| P1 | Criar Feature só com título → Backlog → Review direto → 1 critério → Validation → Aprovar | Chega a Done com 0 requisitos, 0 tasks, 0 decisões, sem owner |
| P2 | Sem usuário selecionado: Plano Alimentar (Development, 4 tasks abertas) → Review → Validation → Aprovar | Done; `validatedById` nulo; 5 eventos sem autor |
| P2b | Editar e excluir requisito da Feature já Done | Ambos aceitos; eventos fora do Histórico da Feature |
| P2c | Dashboard do Pedro depois do P2 | Tasks abertas de Feature Done seguem em "Precisa de você" |
| P3 | Criar task removendo a Feature do formulário (sem decisão) | Backend cria task sem Feature, decisão, reunião e responsável |
| P4 | Botão "Blocked" do tracker | Task bloqueada sem motivo; Dashboard: "motivo não registrado" |
| P5 | Adulterar "Depende de" com a própria task e com task de fora da Feature | Ambos aceitos pelo backend |
| P6 | Editar decisão que já gerou task: texto, justificativa, reunião de origem | Aceito; log só "foi editada" |
| P7 | Feature sem owner em Validation; Dashboard dos três usuários | Ninguém recebe em "Precisa de você" |
| P8 | Aprovar com 1 critério pendente | Tentativa registrada como reprovada; volta a Development |
| P9 | Feature em Development sem tasks, tech lead Pedro | Nenhum sinal para o Pedro |
| P10 | Task sem responsável, sem prazo | Não aparece em nenhum sinal do Dashboard |
| P11 | Dashboard com o seed | "Exomia entra em Discovery" permanente em "Decisões sem task" |
| P12 | Excluir task concluída ("Criar C4") | Aceito sem restrição |
| P13 | Reunião com horário "14:00" | Gravada como 14:00 UTC (servidor em UTC) = 11:00 em São Paulo |

---

## 1. Executive Summary

**Resposta curta: em parte.**

A metade final do processo deixou de ser CRUD: execução, validação e o caminho reunião → decisão → trabalho.

- Features e Tasks são criadas e conduzidas pela UI.
- Done só se alcança por uma aprovação em Validation, com critérios de aceite como contrato:
  - os critérios ficam travados durante a validação;
  - cada tentativa fica registrada, com snapshot dos critérios.
- Uma Decision gera Task sem quebrar o contexto.
- O Dashboard calcula ações e riscos a partir dos dados reais, em vez de espelhar tabelas.

A metade inicial continua sendo um cadastro de texto livre: por que a Feature existe, o que foi pesquisado, o que foi especificado e qual arquitetura foi escolhida.

- Discovery, Specification, Architecture e Review são rótulos: nada é exigido, registrado ou provado nesses estágios.
- Não existe forma de anexar a pesquisa ou o diagrama que embasa uma etapa, porque Artifacts só existem via seed.
- Requisitos não se ligam a execução nem a validação.
- O histórico, que é a base da rastreabilidade, pode ser reescrito ou perdido sem deixar rastro de conteúdo:
  - edições registram só "foi editada";
  - Tasks concluídas podem ser excluídas;
  - requisitos mudam depois de Done;
  - ações podem ser feitas sem autor.

Em uma frase: **o HMP OS hoje opera bem o "o quê fazer e quando está pronto", mas ainda não guarda de forma confiável o "por quê", o "como foi decidido tecnicamente" e o "quem aprovou".**

### O que mudou desde a auditoria V0.1

| Achado da V0.1 | Situação hoje |
|---|---|
| Não existia criar Feature, Task ou Meeting | Resolvido: criar/editar pela UI (Feature, Task, Meeting, Decision; Requirement e AcceptanceCriteria inline) |
| Qualquer estado ia para qualquer estado, inclusive Done num clique | Resolvido em parte: Done só por aprovação, Validation só a partir de Review, Done terminal. Os estágios antes de Review continuam livres, por decisão de produto (G02) |
| `overallResult` independente dos critérios | Resolvido: aprovação exige ≥1 critério e todos PASSED; transação com update condicional |
| Decision → Task não existia | Resolvido: "+ Criar Task" na decisão, com a Feature da decisão herdada e travada |
| Log dizia "avançou" até em regressão | Resolvido: "avançou"/"voltou" |
| `FeatureStepper` mostrava Review como Development | Resolvido (resta: Backlog e Discovery aparecem iguais no stepper compacto — MINOR) |
| Autor de Decision opcional | Resolvido: autor obrigatório |
| `blockedReason` não podia ser informado | Resolvido em parte: existe no formulário de edição, mas é opcional e o botão "Blocked" bloqueia sem motivo (G13) |
| Artifact/Product/Release só leitura | **Continua igual** (G01, G17, G18) |
| Requirement ↔ Task inexistente | **Continua igual** (G06) |
| Log com eventos artificiais do seed | **Continua** em parte: 7 dos 22 eventos do seed são de tipos que o produto nunca emite (D03) |
| Qualquer ator faz qualquer ação | Continua, e é aceito como fora do escopo (sem RBAC). O agravante novo: **nem ator é exigido** — sem usuário selecionado dá para aprovar uma Feature (G05) |

### Achados principais

1. **BLOCKER — G01.** Artifacts não podem ser registrados nem vinculados pela UI. As etapas de Descoberta e Arquitetura não deixam evidência dentro do sistema.
2. **IMPORTANT — G02, G03, G04.**
   - Uma Feature vai de criada a Done sem requisito, sem task, sem decisão, sem owner e sem revisão registrada (P1).
   - Uma Feature pode ser aprovada com tasks abertas, inclusive bloqueadas (P2).
3. **IMPORTANT — G05.** Sem usuário selecionado, dá para mover e aprovar Features. O `ValidationRecord` fica sem validador (P2).
4. **IMPORTANT — G07, G08, G09.** O histórico não é confiável como fonte da verdade:
   - edições sem valores anteriores (uma Decision que já gerou trabalho teve texto, motivo e reunião de origem reescritos, P6);
   - o Histórico da Feature não mostra eventos de requisito nem de tasks excluídas;
   - Tasks concluídas podem ser excluídas (P12).
5. **IMPORTANT — G06.** Requisitos são uma lista solta: não se ligam a tasks, critérios ou decisões, e continuam editáveis/excluíveis depois de Done (P2b).
6. **IMPORTANT — G10, G12.** O Dashboard tem falsos negativos e falsos positivos estruturais:
   - pendências sem dono não aparecem para ninguém (P7, P9, P10);
   - decisões que não precisam de task ficam para sempre em "Decisões sem task" (P11).

---

## 2. Current Process

Comparação entre o processo esperado e o que o HMP OS suporta hoje, verificado no código e pela UI.

| Etapa | Suportada? | Como | Lacuna |
|---|---|---|---|
| Necessidade | Parcial | Feature criada em Backlog com `context`, `problem`, `userNeed` (texto livre); evento `feature.created` com autor | Não existe registro anterior à Feature (pedido, ideia, origem). "De onde veio" e "quem pediu" ficam em texto. Toda necessidade já nasce como Feature |
| Descoberta | Parcial (rótulo) | Estado `DISCOVERY`; tasks de pesquisa sob a Feature (é assim que o seed representa a descoberta) | O estado não exige nem mostra nada. Resultados não podem ser anexados (G01, G02) |
| Pesquisa / contexto | Não | Só os 4 Artifacts do seed (URLs `example.com`); links podem ser colados em campos de texto (não clicáveis) | Não há como registrar uma pesquisa, referência ou concorrente (G01) |
| Definição | Parcial | `objective`, `functionalFlow`, Requirements | Nada registra que a definição foi aceita; requisitos soltos (G06) |
| Prioridade | Parcial | Campo `priority` em Feature, Requirement e Task | Sem estágio de priorização. Repriorizar gera só "Feature … foi editada": sem o valor anterior, sem motivo. A decisão de priorizar não se liga à mudança do campo (G07, G10) |
| Especificação | Parcial (rótulo) | Estado `SPECIFICATION` + requisitos + fluxo funcional | Sem aprovação da especificação; o estágio pode ser pulado (G02); requisitos editáveis em qualquer momento (G06) |
| Arquitetura | Parcial (rótulo) | Estado `ARCHITECTURE` + `architectureNotes` + `architectId`/`techLeadId` | Diagramas não podem ser anexados (G01); nenhum aceite ou revisão da arquitetura (G03); decisão técnica não se distingue de decisão de produto |
| Decisão | Sim | Decision com contexto, justificativa, alternativas, autor (obrigatório), participantes, reunião de origem, "Afeta" (Feature ou Product); gera Task | Sem ciclo de vida (aplicada, sem ação necessária, revogada, substituída) (G10). Reescrevível sem histórico (G07). Afeta um único item. Consequências que não são task não são rastreáveis |
| Desenvolvimento | Sim | Tasks com responsável, prazo, prioridade, status, dependência, origem (Feature ou Decision), bloqueio com motivo | Bloqueio sem motivo (G13); task sem responsável some do Dashboard (G12); exclusão física (G09); nenhuma ligação com requisito (G06) |
| Review | Não (rótulo) | Estado `REVIEW`; dica "Em revisão — próximo passo: Validation" | Quem revisou, o que encontrou e o que mudou não são registrados. O estado pode ser alcançado direto de Backlog (G02, G03) |
| Validação | Sim | Critérios de aceite; tentativas numeradas; snapshot por tentativa; gate (≥1 critério, todos PASSED); critérios travados em Validation/Done; reprovação volta para Development | Validador pode ser nulo (G05). Aprova com tasks abertas (G04). Correções não se ligam à reprovação (G15). Requisitos fora do snapshot (G06) |
| Conclusão | Parcial | `DONE` terminal, só via aprovação | Done com tasks abertas (G04); requisitos alteráveis depois (G06); tasks concluídas excluíveis (G09) |
| Release | Não | Entidade `Release` do seed com vínculo estático à Feature | Sem UI, sem mudança de status, sem relação com Done; "foi para produção?" não tem resposta (G18) |

---

## 3. Traceability Analysis

### 3.1 Feature: Nutria → Elaboração do Plano Alimentar

Reconstrução feita só com o que está no sistema (seed atual, banco limpo). Estado: `DEVELOPMENT`, P0, owner Heitor, architect Linard, tech lead Pedro, Release "Nutria — Ciclo Q3 2026".

| Pergunta | O que o sistema responde | Onde quebra |
|---|---|---|
| **Origem** — por que existe, qual problema, qual necessidade, qual objetivo | `context`, `problem`, `userNeed` e `objective` preenchidos (texto). A pergunta é respondida em prosa | Não há relação com o que originou a Feature (pesquisa, pedido de cliente, reunião). "Quem criou" é só o autor do evento `feature.created`, que no seed é artificial |
| **Descoberta** — quais pesquisas, referências, resultados | Artifact "[DEMO] Pesquisa de mercado — Dietbox" (RESEARCH, URL `example.com`) e tasks concluídas "Consolidar pesquisa Dietbox" e "Analisar formulário de mercado" | Os **resultados** não estão no sistema: o artifact aponta para fora e o formulário de mercado não tem artefato. Para uma Feature nova nem o artifact seria possível (G01) |
| **Decisão** — quais, por quem, em qual reunião, por quê | 2 decisões na "Reunião HMP — Planejamento Nutria" (16/09), autor Heitor, 3 participantes, com justificativa e alternativas | A decisão "Planejamento Alimentar será tratado como Feature P0" não tem consequência rastreável: a mudança de prioridade só aparece num evento artificial do seed (`feature.field_changed`). As duas podem ser reescritas sem histórico (G07, G10) |
| **Especificação** — requisitos, quem criou, vínculo | 3 requisitos com prioridade, status e fonte (texto, ex.: "Pesquisa de mercado (Dietbox) + reunião de 16/09"); vinculados à Feature | Requirement não tem autor. O único registro de quem criou é o evento agregado do seed "3 requisitos adicionados". Para requisitos criados pela UI, o autor fica só no Activity global: o Histórico da Feature não mostra eventos de requisito (G08). A "fonte" é texto, não vínculo |
| **Arquitetura** — decisões técnicas, artefatos, arquitetura escolhida | `architectureNotes` (texto); Artifacts C4 e diagrama de classes (seed) | Nenhuma decisão técnica registrada como Decision; nenhum aceite/revisão. Novos diagramas não podem ser anexados (G01, G03) |
| **Desenvolvimento** — tasks, quem executou, origem | 9 tasks (5 concluídas), responsáveis visíveis; "Implementar backend" nasceu da decisão de macros | 8 das 9 tasks têm como origem só "a Feature". Nenhuma aponta para o requisito que implementa (G06). "Quem executou" é inferido do responsável e do autor dos eventos de status |
| **Review** — quem revisou, o que encontrou, o que mudou | Nada. No seed a Feature nunca passou por Review. Quando passa (P1, P2), o único registro é `feature.status_changed` com o autor do clique | G03 |
| **Validation** — critérios, quem validou, tentativas, falhas, aprovação | 3 critérios (PENDING), 0 tentativas no seed. Quando acontece: validador, data, snapshot dos critérios, observações e problemas | Validador pode ficar nulo (G05); aprovação com tasks abertas (G04); reprovação não se liga às tasks de correção (G15) |
| **Conclusão** — quando, por quem, o que mudou | N/A (em Development). Quando ocorre: `validation.approved` + `DONE` | "O que foi entregue" vs. "o que foi especificado" não tem registro; requisitos e tasks ainda podem mudar depois (G06, G09) |
| **Release** — foi liberada, quando, em qual versão | A Feature aponta para o Release "Nutria — Ciclo Q3 2026" (IN_PROGRESS), via seed | Não há como mudar status, confirmar deploy ou mudar o vínculo (G18) |

**Onde a cadeia quebra, em ordem:**

1. Origem → Descoberta: não há onde guardar o resultado da pesquisa (G01).
2. Especificação → Desenvolvimento: requisito não se liga a task (G06).
3. Arquitetura: sem artefato novo nem aceite (G01, G03).
4. Review: não existe registro (G03).
5. Validação → Conclusão: Done não garante que o trabalho terminou (G04).
6. Conclusão → Release: não existe (G18).

A cadeia **Decisão → Task → Execução** é a parte que funciona de ponta a ponta.

### 3.2 Decision traceability (caminho inverso)

**Decisão analisada: "Plano Alimentar incluirá cálculo automático de macronutrientes".**

- **Por que existe?** Respondido: contexto, justificativa e alternativas, autor, 3 participantes, reunião de origem (16/09).
- **O que aconteceu por causa dela?** Task "Implementar backend" (Pedro, In progress). A execução é visível pelos eventos de status da task. Meeting → Decision → Feature → Task → Execução está íntegro.
- **Quebras:**
  - **Consequências reais sem vínculo.** O requisito "Sistema deve calcular macronutrientes automaticamente" (status IMPLEMENTED) e o critério "Cálculo de macros bate com valores de referência" são consequências dela. Nenhum dos dois tem vínculo; só o texto da fonte do requisito menciona "reunião de 16/09".
  - **Excluir a task apaga a consequência.** A decisão volta a contar como "sem task" e perde o registro de que gerou trabalho (G09).
  - **A decisão pode ser reescrita.** Texto, justificativa e reunião de origem podem ser trocados depois de gerar a task, e o histórico só diz "foi editada" (P6, G07).

**Uma Decision pode "morrer" sem consequência rastreável? Sim, de três formas:**

1. **Consequência que não é task.** "Planejamento Alimentar será tratado como Feature P0" teve como efeito mudar a prioridade da Feature. O produto não liga decisão a mudança de campo.
2. **Decisão de Product.** "Exomia entra em fase de Discovery formal" afeta um Product. As consequências naturais (criar Features da Exomia, mudar o status do Product) não podem ser feitas pela UI.
3. **Sem estado.** Não há como marcar "aplicada", "não requer ação", "revogada" ou "substituída por…". As duas decisões acima ficam **para sempre** em "Decisões sem task" no Dashboard (P11), e uma decisão revertida só pode ser editada (apagando a original) ou convivendo com uma nova, sem ligação entre as duas.

### 3.3 Task traceability

| Task | Origem | "Por que esta Task existe?" — resposta do sistema | Classificação |
|---|---|---|---|
| "Implementar backend" | Criada a partir de Decision | Decisão + reunião + justificativa + Feature | **Origem clara** |
| Task criada por "+ Criar Task" numa decisão (fluxo V0.2-C) | Decision | Idem; a Feature da decisão é herdada e travada | **Origem clara** |
| "Criar testes", "Validar recurso" | Manual, ligada à Feature | Feature (problema/objetivo) + quem criou. Não diz qual requisito ou critério atende | **Origem parcial** |
| "Implementar frontend" | Manual, ligada à Feature, com dependência | Feature + dependência; o motivo do bloqueio é texto opcional | **Origem parcial** |
| Task de correção depois de uma reprovação | Manual, ligada à Feature | Feature; não se liga à tentativa reprovada nem ao problema encontrado (G15) | **Origem parcial** |
| Ação decidida em reunião sem decisão formal ("Pedro verificar X") | `Task.meetingId` existe no schema, mas não há caminho na UI (nem o seed usa) | Vira decisão artificial ou task só com Feature, e a reunião se perde (G11) | **Origem parcial** |
| Task sem Feature e sem decisão | A UI exige Feature, mas o backend aceita sem nenhuma origem (P3) | Nada | **Origem inexistente** |

---

## 4. Feature Workflow

`BACKLOG → DISCOVERY → SPECIFICATION → ARCHITECTURE → DEVELOPMENT → REVIEW → VALIDATION → DONE`

**Regras realmente aplicadas no backend** (`assertValidManualTransition` e `recordValidation`):

- Validation só a partir de Review.
- Done só por aprovação.
- Done é terminal.
- Aprovação exige ≥1 critério e todos PASSED.

O resto é livre, por decisão explícita no código ("estágios antes de Review ficam livres de propósito").

| Estado | Representa trabalho real? | Há dados que provam que aconteceu? | Observação |
|---|---|---|---|
| Backlog | Sim (espera) | `feature.created` | — |
| Discovery | Rótulo | Não: nenhum campo, artefato ou decisão exigido ou mostrado | Pode ser pulado |
| Specification | Rótulo | Parcial: requisitos e fluxo existem, mas nada é exigido nem aprovado | Pode ser pulado |
| Architecture | Rótulo | Parcial: `architectureNotes` e responsáveis; diagramas não anexáveis | Pode ser pulado |
| Development | Sim | Tasks e seus status | Nada impede sair com tasks abertas |
| Review | Rótulo | Não: sem revisor, achados ou resultado | Pode ser alcançado direto de Backlog (P1) |
| Validation | Sim | `ValidationRecord` + snapshot | Gate real |
| Done | Sim, mas incompleto | Aprovação registrada | Não garante tasks concluídas (P2) |

- **Transições sem significado:** Backlog → Review direto (P1). Development → Review com tasks abertas e bloqueadas (P2). Qualquer regressão antes de Validation.
- **Transições que talvez devessem ter gate** (a decidir, não implementar automaticamente):
  - Development → Review (tasks concluídas: o documento conceitual já previa "100% das tasks");
  - Review → Validation (registro de quem revisou);
  - aprovação (tasks abertas).
- **Contorno legítimo do processo** — é possível hoje, sem nenhum ajuste técnico:
  - criar uma Feature só com título;
  - levá-la direto a Review;
  - cadastrar 1 critério, entrar em Validation e aprovar.

  A Feature chega a Done sem requisito, task, decisão, owner ou revisão (P1). A combinação com G05 permite fazer isso sem usuário selecionado (P2).
- **Burocracia excessiva:** não há. O risco é o oposto: o fluxo é leve demais antes de Review. Dois atritos pontuais:
  - "Aprovar" com um critério esquecido vira uma **tentativa reprovada** e devolve a Feature para Development (P8, G16). O histórico registra uma reprovação que foi só esquecimento.
  - Para corrigir um critério em Validation é preciso voltar a Review. Isso é coerente com o critério como contrato; não é problema.
- **Estados previstos e ausentes** (`conceptual-architecture-v0.1.md`, §8.1): PRIORITIZATION, APPROVED, RELEASED, ON_HOLD, DISCARDED. Não se recomenda adicioná-los automaticamente. Mas a ausência de **pausar/descartar** é uma lacuna real:
  - uma Feature abandonada não pode ser arquivada nem excluída;
  - fica como "parada" no Dashboard para sempre, ou esquecida em Backlog (G14).

---

## 5. Meetings & Decisions

### Meetings

**Funciona:**
- criar e editar reunião (título, data/hora, participantes validados, pauta, notas);
- registrar decisão a partir da reunião;
- página da reunião mostra decisões, tasks decorrentes e histórico;
- não há exclusão, o que preserva contexto.

**Lacunas:**
- **Follow-up direto não existe (G11).** O documento conceitual (§10) previa ação de reunião como Task com `meeting_id`. O schema tem o campo, mas a UI não oferece (nem o seed usa). Uma ação sem "decisão formal" vira decisão artificial ou task sem vínculo com a reunião.
- **Pauta e notas são texto livre.** Não há como pautar "esta Feature/esta decisão" na próxima reunião a partir de outro lugar. A pauta registrada da próxima reunião nem aparece no Dashboard (G19).
- **Edição sem detalhe.** Editar data, participantes ou notas gera só "Reunião … foi editada" (G07).
- **Artefatos da reunião.** Aparecem na página, mas só existem via seed (G01).

### Decisions

**Funciona:**
- responde por quê (contexto, justificativa, alternativas), quem (autor obrigatório, participantes), quando e onde (reunião);
- o vínculo "Afeta" deriva o Product da Feature;
- o vínculo trava depois de gerar tasks, com explicação na tela;
- "+ Criar Task" fecha Decision → Task.

**Lacunas:**
- **Sem ciclo de vida (G10).** Veja 3.2.
- **Reescrevível (G07).** Texto, justificativa, alternativas, reunião de origem e data podem mudar a qualquer momento, inclusive depois de gerar trabalho (P6). O log não guarda o valor anterior.
- **Registro retroativo livre.** `decidedAt` aceita qualquer data e não é conferido contra a data da reunião escolhida. Isso facilita "decidir no WhatsApp e registrar depois" sem que o sistema saiba (seção 14).
- **Um único "Afeta" (Feature ou Product).** Simplificação deliberada. Decisões que afetam duas Features exigem duplicar o registro.
- **Artefatos que embasaram a decisão.** Existem no schema e na página, mas não podem ser vinculados (G01).

---

## 6. Tasks

**Funciona:**
- criar (a partir da Feature ou da decisão), editar, mudar status, excluir;
- responsável, prazo, prioridade, dependência dentro da Feature, motivo do bloqueio;
- página da task com "Origem" (decisão, reunião, Feature, Product) e histórico próprio.

**Lacunas:**

| Tema | Situação | ID |
|---|---|---|
| Bloqueio | O botão "Blocked" do tracker bloqueia sem motivo; no formulário o motivo é opcional; o evento de status não registra o motivo | G13 |
| Responsável | Opcional; uma task sem responsável não aparece em nenhum sinal do Dashboard (P10). Trocar o responsável gera só "foi editada" (quem saiu/entrou se perde) | G12, G07 |
| Exclusão | Física, em qualquer estado, inclusive DONE (P12). Os eventos da task somem dos históricos da Feature, da Decision e da Meeting | G09 |
| Dependência | Uma só pela UI (editar substitui as que houver). Não impede iniciar nem concluir. O backend aceita autodependência e dependência fora da Feature (P5) | G20, D01 |
| Review de task | O status `REVIEW` existe, mas não há revisor atribuível: `reviewerId` aparece na página como "Sem revisor" e não pode ser preenchido | D04 |
| Subtasks e follow-up | `parentTaskId` e `meetingId` aparecem na página, mas não têm caminho de escrita | D04, G11 |
| Origem | Pela UI, sempre há Feature ou decisão. Pelo backend, pode não haver nenhuma (P3) | D01 |
| Feature concluída | Tasks abertas de uma Feature Done continuam em "Precisa de você" (P2c) e nada as encerra | G04 |

---

## 7. Validation

**Pontos fortes:**
- tentativas numeradas e nunca sobrescritas;
- snapshot dos critérios por tentativa;
- gate com ≥1 critério e todos PASSED;
- transação com update condicional, que evita aprovação dupla e aprovação de Feature que já saiu de Validation;
- critérios travados em Validation e depois de Done;
- reprovação volta para Development;
- Done é terminal.

### Depois de aprovada, o sistema consegue explicar exatamente por que a Feature foi aprovada?

**Parcialmente.** Hoje ele mostra, na seção Validation da Feature e em `/validations`:

- **quem** validou e **quando**;
- **contra o quê**: cada critério com o resultado daquela tentativa (snapshot);
- as **observações** e os **problemas** registrados;
- o **caminho**: tentativas reprovadas anteriores continuam visíveis.

**O que falta para a explicação ser confiável:**

1. **Quem aprovou pode estar vazio.** Sem usuário selecionado, a aprovação é aceita com `validatedById = null` (P2, G05).
2. **Aprovado ≠ terminado.** Nada impede aprovar com tasks abertas ou bloqueadas (P2, G04).
3. **O "o quê" pode mudar depois.** Requisitos ficam fora do snapshot e continuam editáveis e excluíveis depois de Done (P2b, G06). O snapshot guarda texto e status dos critérios, mas não o que foi especificado.
4. **Reteste não é distinguível.** Na tentativa seguinte, os critérios vêm pré-marcados com o resultado anterior. O snapshot não diferencia "retestado agora" de "herdado da tentativa anterior" (G15, MINOR).
5. **Sem evidência por critério.** Não há como anexar o que comprovou o resultado (relatório, print, link). Depende de G01.
6. **Correções não se ligam à reprovação.** O ciclo "reprovada → tasks de correção → aprovada", previsto no documento conceitual (§13, `fixes`), não é rastreável. As tasks de correção são tasks comuns da Feature (G15).
7. **Duplicação no log.** Cada validação gera `validation.completed` + `validation.approved`/`rejected`; cada entrada em Validation gera `feature.status_changed` + `validation.started` (G23).

---

## 8. Activity Log

### 8.1 Cobertura por entidade

| Entidade | Eventos relevantes emitidos pelo produto | Há lacunas? |
|---|---|---|
| Feature | `feature.created`, `feature.updated`, `feature.status_changed` ("avançou"/"voltou") | **Sim.** `updated` não diz o que mudou: prioridade, owner/architect/tech lead, problema, objetivo. Não há `field_changed` (previsto no conceito) |
| Task | `task.created`, `task.created_from_decision`, `task.updated`, `task.status_changed`, `task.deleted` | **Sim.** Troca de responsável, prazo e dependência não é registrada; o motivo do bloqueio não entra no evento |
| Requirement | `requirement.created`, `requirement.updated`, `requirement.deleted` (com `entityId` = a Feature) | **Sim.** `updated` não diz o que mudou (ex.: PROPOSED → IMPLEMENTED). Os eventos **não aparecem no Histórico da Feature** (P2b) |
| Meeting | `meeting.created`, `meeting.updated` | **Sim.** Mudança de data, participantes e notas sem detalhe |
| Decision | `decision.created`, `decision.updated` | **Sim.** Reescrita sem valor anterior (P6) |
| Validation | `validation.started`, `validation.completed`, `validation.approved`/`rejected` (+ snapshot no registro) | Parcial: duplicação; autor pode ser nulo |
| Acceptance Criteria | `acceptance_criteria.created`, `acceptance_criteria.deleted` (sob `entityType = validation`) | Pequena: o status só muda via validação (correto) |
| Artifact, Product, Release, Person | Nenhum: não há ação na UI | Só os eventos artificiais `artifact.linked` do seed |

### 8.2 Problemas encontrados

- **Eventos sem destino.** Nenhum além dos de task excluída. Requirement, critério e validação apontam para a Feature por convenção; `release` aponta para a lista `/releases`.
- **Eventos que apontam para entidades excluídas.** Todos os eventos de uma task excluída (criação, status, exclusão), 5 no teste. Antes, linkavam para uma página 404. **Microfix aplicado nesta etapa** (8.4). Continuam fora dos históricos contextuais (G08).
- **Eventos impossíveis de reproduzir pelo produto** (seed, D03):
  - 7 dos 22 eventos são de tipos que o produto nunca emite: `artifact.linked` ×4, `feature.field_changed`, `requirement.added` (agregado) e `task.created` agregado com `entityType = feature` ("8 tasks criadas para a Feature…");
  - outros 4 usam redação que o produto não gera ("Task … concluída" ×3, "Task … foi bloqueada: …").
- **Eventos duplicados.** Entrar em Validation gera dois eventos; validar gera dois eventos (P1).
- **Linguagem ambígua.**
  - "… foi editada" / "… foi editado" não dizem o quê.
  - "Requisito adicionado/editado/removido" aparece sob a Feature, mas não identifica o requisito se o texto dele mudar.
  - "Validação … foi concluída" repete "aprovada/reprovada".
- **Quem fez o quê.** Todo evento pode ficar sem autor quando não há usuário selecionado (5 eventos sem autor no P2). Na UI isso aparece como uma linha sem nome.
- **Consumidores inconsistentes:**
  - O Histórico da Feature filtra `feature`, `task` e `validation`: **exclui requisitos**, decisões e tasks excluídas, e mostra só os 30 últimos.
  - O Dashboard considera eventos de requisito para calcular "parada"; a página da Feature não os mostra.
  - A página do Product mostra só eventos de Product e Feature (sem tasks, decisões, requisitos, validação).
  - O Activity global mostra os 200 últimos, sem filtro por pessoa, entidade ou tipo.

### 8.3 O Activity Log atual consegue reconstruir a história real do trabalho?

**Consegue reconstruir as mudanças de estado; não consegue reconstruir as mudanças de conteúdo nem garantir a autoria.** A sequência de status da Feature e das tasks, as validações e as decisões criadas é reconstruível. Não é reconstruível pelo log:

- o que era a decisão antes de ser editada;
- qual era a prioridade anterior e quem mudou;
- quem era o responsável de uma task;
- o que dizia um requisito antes de mudar depois de Done.

A narrativa do seed continua mais rica do que o produto consegue produzir sozinho, por causa dos eventos artificiais (D03).

### 8.4 Microfix aplicado — Task excluída

`src/components/ActivityFeed.tsx` passou a verificar quais tasks citadas nos eventos ainda existem. Para as excluídas:

- o link é removido;
- a task é marcada como excluída: o evento de exclusão aparece exatamente como `Task "X" (excluída)`, e os demais como `Task "X" (excluída) mudou de To do para In progress` / `… criada` / `… foi bloqueada: …` (inclusive nos formatos do seed).

Verificado pela UI:
- em `/activity` e na "Atividade recente" do Dashboard;
- os 13 links restantes do histórico global abrem (sem 404).

Não foi alterado nenhum outro comportamento: os eventos da task excluída continuam fora do Histórico da Feature (G08, registrado como lacuna, não corrigido).

---

## 9. Dashboard

### "Precisa de você" — representa ações que aquele usuário precisa executar?

**Na maior parte, sim.** São as tasks abertas do usuário (por urgência) e ações por papel:

- owner valida Features em Validation;
- owner/architect revisam Features em Review;
- tech lead leva para Review quando todas as tasks fecham;
- o autor desdobra decisões sem task.

| Tipo | Caso | Evidência |
|---|---|---|
| Falso negativo | Feature em Validation **sem owner**: ninguém recebe (aparece só em "Atenção do time") | P7 |
| Falso negativo | Feature em Development **sem nenhuma task**: o tech lead não é avisado de que falta planejar a execução | P9 |
| Falso negativo | Task **sem responsável**: não aparece para ninguém, em nenhum sinal | P10 |
| Falso negativo | Discovery, Specification e Architecture não geram ação para owner ou architect: o sistema não sabe quem precisa fazer a Feature andar | código (`getPersonalQueue`) |
| Falso negativo | Minha task **bloqueia** a de outra pessoa (dependência): não é sinalizado | código |
| Falso negativo | Reunião próxima de que participo: não entra na minha fila | código |
| Falso positivo | Decisão minha que não requer task (ex.: priorização, decisão de Product): "+ Criar Task" para sempre | P11 |
| Falso positivo | Task aberta de uma Feature já Done continua como pendência, sem indicação | P2c |
| Ambíguo | Feature em Review aparece para owner **e** architect; quando um deles revisa, nada registra isso, e ambos continuam vendo até alguém mover | código, G03 |

### "Atenção do time" — representa riscos reais para o processo?

**Sim, os cinco grupos são riscos reais:** validação pendente, bloqueio, atraso, decisão sem desdobramento, Feature parada há 7+ dias. Faltam riscos que o sistema já conhece:

- tasks sem responsável;
- Features sem owner;
- Features em Development sem tasks;
- Features em Validation sem critérios (não podem ser aprovadas);
- dependências abertas de tasks em andamento.

"Decisões sem task" mistura trabalho perdido com decisões que não geram task (P11). "Features paradas" não diz **por que** estão paradas.

### Próxima reunião — a informação é suficiente para preparar a reunião?

**Parcialmente.** Mostra título, data e participantes. **Não mostra a pauta registrada** da própria reunião (`meeting.agenda`). O horário é interpretado no fuso do servidor: "14:00" digitado vira 14:00 UTC, que é 11:00 em São Paulo. Com isso, a reunião passa de "próxima" para "última" 3 horas antes (P13, G24).

### Pauta sugerida — deriva de dados reais?

**Sim, e só de dados reais.** A base é a última reunião:

- as decisões dela sem task;
- as tasks decorrentes em aberto;
- as Features que mudaram de estágio desde então.

É **incompleta** para preparar a reunião (G19): ignora bloqueios, atrasos, validações pendentes, decisões tomadas fora de reunião e itens de reuniões anteriores à última.

### Decisões sem Task — representam trabalho potencialmente perdido?

**Às vezes.** Hoje o sinal não distingue três casos:

1. Decisão que deveria ter gerado trabalho e não gerou (verdadeiro positivo).
2. Decisão cuja consequência não é task: mudança de prioridade, decisão de Product (falso positivo permanente).
3. Decisão cuja única task foi excluída (volta a aparecer sem registro de que já teve desdobramento).

Sem um estado da decisão (G10), o sinal tende a virar ruído e ser ignorado.

---

## 10. Requirements & Artifacts

### Requirements

| Aspecto | Situação |
|---|---|
| Requirement → Feature | Sim (obrigatório) |
| Criação / edição / exclusão | Sim, inline na Feature, em **qualquer estado, inclusive Done** (P2b) |
| Ownership (quem definiu, quem aprova) | Não existe; só o autor do evento, que nem aparece no Histórico da Feature |
| Histórico | Eventos existem, sem valor anterior; fora do Histórico da Feature (G08) |
| Relação com Tasks | Não existe |
| Relação com Validation | Não existe: critérios e snapshot não se ligam a requisitos |
| Status (Proposed/Approved/Implemented/Tested) | Manual e sem evidência: "Tested" não depende de teste, "Implemented" não depende de task |

**É possível sair de uma necessidade e chegar até uma implementação concreta?** **Não de forma rastreável.** A cadeia quebra entre Requirement e Task: sabe-se que a Feature tem requisitos e tem tasks, mas não qual task implementa qual requisito, nem qual critério comprova qual requisito (G06). A ligação entre necessidade e requisito também é textual (`source`).

### Artifacts

| Pode estar ligado a… | Schema | UI |
|---|---|---|
| Feature | Sim | Só seed |
| Decision | Sim | Só seed |
| Meeting | Sim | Só seed |
| Product | **Não** | — |
| Requirement | **Não** | — |
| Architecture | Indireto (tipos C4/Class/Sequence na Feature) | Só seed |
| Task | **Não** (o conceito previa) | — |

- **"Qual documento explica esta decisão?"** Para decisões novas, impossível: não há como vincular.
- **"Qual arquitetura foi definida para esta Feature?"** Só `architectureNotes` (texto). Diagramas novos não podem ser anexados.

**Os Artifacts ainda são um cadastro de demonstração, não parte do processo (G01, BLOCKER).** Os 4 existentes são `[DEMO]` com URLs `example.com`. `version` é sempre "v1".

---

## 11. Release

- **Onde entra no fluxo:** em lugar nenhum. A entidade existe (Product → Release → Features, status PLANNED/IN_PROGRESS/SHIPPED), mas:
  - não há UI para criar Release, vincular Feature ou mudar status;
  - chegar a Done não afeta o Release;
  - a página `/releases` é só leitura.
- **O que falta para usá-la:**
  - vincular Feature a Release;
  - mudar status;
  - relação com Done;
  - distinguir "aprovada" de "em produção".
- **É necessária agora?** **Não.** O Nutria ainda não tem ciclo de releases operado pelo HMP OS, e Done já representa "validado".
- **Deve continuar separada?** Sim: como entidade separada e fora do fluxo até o uso real mostrar necessidade (G18, MINOR). A questão a responder antes é de processo: "aprovada" e "em produção" são momentos diferentes para a HMP?

---

## 12. Entity Coverage

| Entidade | Criável pela UI | Editável | Usada no processo | Ligada a outras | Apenas seed? |
|---|---|---|---|---|---|
| Company | Não | Não | Não (nome em Settings) | Product | **Sim** |
| Person | Não | Não | Sim (responsáveis, autor, ator) | Feature, Task, Decision, Meeting, Validation | **Sim** (cadastro) |
| Product | Não | Não | Sim (toda Feature pertence a um) | Feature, Release, Decision | **Sim** (cadastro) |
| Release | Não | Não | Não | Product, Feature | **Sim** |
| Feature | Sim | Sim | Sim | Product, Person ×3, Requirement, Task, Decision, Criteria, Validation, Artifact | Não |
| Requirement | Sim | Sim | Parcial (sem vínculo com execução/validação) | Feature | Não |
| Task | Sim | Sim | Sim | Feature, Decision, Person, Dependency | Não. Mas `reviewer`, `parentTask`/subtasks e `meeting` (follow-up) não têm caminho de escrita, e nem o seed os usa |
| TaskDependency | Sim (1 por task) | Sim (substitui) | Parcial (não impede nada) | Task | Não |
| Meeting (+ participantes) | Sim | Sim | Sim | Decision, Task (via decisão), Artifact (seed) | Não |
| Decision (+ participantes) | Sim | Sim | Sim | Meeting, Feature/Product, Task, Artifact (seed) | Não |
| Artifact | Não | Não | Não (só leitura) | Feature, Meeting, Decision, Person | **Sim** |
| AcceptanceCriteria | Sim | Não (excluir e recriar) | Sim (gate) | Feature | Não |
| ValidationRecord | Sim (via validação) | Não (imutável, correto) | Sim | Feature, Person | Não |
| ActivityLog | Automático | Não | Sim | Polimórfico (sem FK) | Parcial (o seed injeta eventos artificiais) |
| Role | — (enum em Person, não entidade) | — | — | — | — |

**Ainda existe parte importante do modelo que só existe porque o seed colocou lá? Sim:**

- **Artifact (G01).** Essa é a mais grave, porque é a evidência das etapas de descoberta e arquitetura.
- **Person e Product (G17).** Um novo membro, um novo produto ou um novo ciclo exigem um desenvolvedor. Não há como remover os dados de demonstração pela UI: Feature, Decision, Meeting e Artifact não têm exclusão. Começar a usar "de verdade" significa conviver com a demo ou mexer no banco.
- **Release (G18).**
- **Três campos de Task** (`reviewerId`, `parentTaskId`, `meetingId`) que a UI exibe e nada preenche (D04).

---

## 13. Backend Integrity

### 13.1 Regras protegidas no backend

Verificado no código e nas regressões anteriores:

- **Feature:** transições para Validation e Done, Done terminal, update condicional contra corrida.
- **Validation:** gate de critérios, resultado válido, Feature precisa estar em Validation, transação.
- **Acceptance Criteria:** travados em Validation e Done; exclusão confere a Feature.
- **Decisions:** autor obrigatório e existente; reunião, participantes e "Afeta" existentes; "Afeta" travado depois de gerar tasks.
- **Tasks:**
  - task de decisão fica na Feature da decisão, ou em Feature do Product dela;
  - existência da Feature, do responsável e da dependência;
  - prazo válido;
  - not-found explícito.
- **Meetings:** título, data válida e participantes existentes.

**O backend continua sendo a autoridade para o que a V0.2 prometeu.**

### 13.2 UI bloqueia, mas backend aceita

| Caso | Evidência | ID |
|---|---|---|
| Task sem Feature e sem decisão (a UI exige Feature quando não há decisão) | P3 | D01 |
| Autodependência (a UI exclui a própria task da lista) | P5 | D01 |
| Dependência para task de outra Feature ou avulsa (a UI lista só a mesma Feature) | P5 | D01 |
| `productId`, `ownerId`, `priority` etc. de selects sem validação de existência ou valor: valor adulterado vira erro inesperado (tela de erro), não mensagem | código | D01 |

### 13.3 Backend bloqueia, mas a UI não explica bem

| Caso | O que acontece | ID |
|---|---|---|
| "Aprovar" com critério pendente | O botão está habilitado. O backend converte em **reprovação**, conta a tentativa e devolve a Feature para Development. A explicação só aparece depois, no histórico ("Aprovação bloqueada: 1 critério ainda não avaliado") (P8) | G16 |
| Entrar em Validation sem critérios | Permitido. A tela então pede para voltar a Review para cadastrá-los: explicado, mas custa uma ida e volta | MINOR |

### 13.4 Integridade de dados

- **Foreign keys:** todas as relações têm FK, com RESTRICT para obrigatórias e SET NULL para opcionais. As exceções são `ActivityLog` (polimórfico, `actorId` sem FK) e `criteriaSnapshot` (JSON), ambas por desenho.
- **Exclusões pela UI:** existem só para Task, Requirement e AcceptanceCriteria, todas físicas.
  - **Task:** remove dependências e desvincula subtasks. Contexto destruído:
    - evidência de trabalho concluído (P12);
    - histórico contextual da task;
    - o registro de que uma decisão gerou trabalho (G09).
  - **Requirement:** excluível em qualquer estado, inclusive com a Feature Done (P2b). O que foi especificado se perde (G06).
  - **Critério:** só antes de Validation; o snapshot das tentativas preserva o texto.
- **Relações incompatíveis possíveis:**
  - dependência circular ou entre Features (D01);
  - `decidedAt` sem relação com a data da reunião de origem.
- **Registros órfãos:** eventos de tasks excluídas (esperado, agora sinalizados). Nenhum outro órfão possível pela UI, porque as demais entidades não são excluíveis.

---

## 14. External Tools Dependency

**Resposta à pergunta da seção 2 do escopo:** se o HMP começasse a usar o sistema amanhã, estes pontos ainda iriam para WhatsApp, Drive, planilhas ou memória.

### Intencional (necessidade legítima)

- Código e revisão de código: GitHub.
- Arquivos, documentos longos, pesquisas, diagramas e protótipos: Drive, Figma, Miro. O HMP OS foi desenhado para **referenciar**, não hospedar.
- Videoconferência e conversa síncrona.
- Deploy e infraestrutura: Vercel/GitHub.

### Necessário por limitação atual

| O que | Para onde vai | Por quê | ID |
|---|---|---|---|
| Link da pesquisa, referência, especificação ou diagrama de uma Feature ou decisão | Drive + memória, ou colado em campo de texto | Artifact não pode ser registrado | G01 |
| Aceite da especificação e da arquitetura; resultado da revisão | Conversa/WhatsApp | Não há registro de review/aceite | G03 |
| "Quem mudou a prioridade, quando e por quê"; "quem era o responsável" | Memória | Edições sem histórico de conteúdo | G07 |
| Ação decidida em reunião sem decisão formal | Notas da reunião (texto), WhatsApp | Follow-up direto não existe | G11 |
| Pausar/descartar uma Feature e o motivo | Memória | Não há estado nem exclusão | G14 |
| O que foi para produção e quando | GitHub/Vercel + memória | Release isolado | G18 |
| Novo membro, novo produto, novo ciclo | Desenvolvedor mexendo no seed/banco | Sem cadastro pela UI | G17 |
| Qual task implementa qual requisito | Memória | Sem vínculo | G06 |

### Problema potencial

- **Decisões tomadas no WhatsApp e registradas depois.** O sistema aceita qualquer `decidedAt` e permite reescrever a decisão depois. O registro pode divergir do que foi decidido sem deixar rastro (G07, G10).
- **Aprovações verbais "clicadas" por quem estiver com o sistema aberto,** inclusive sem usuário selecionado (G05).
- **Motivo de bloqueio e "por que está parado" combinados no chat,** porque o sistema aceita bloqueio sem motivo (G13).
- **Trabalho sem dono combinado no chat,** porque task sem responsável não aparece no Dashboard (G12).

---

## 15. AI Readiness

**O HMP já possui contexto estruturado suficiente para alimentar um agente de IA no futuro? Para a execução, sim; para o raciocínio, ainda não.**

| Elo da cadeia | Disponível estruturado? | Falta |
|---|---|---|
| Contexto da Feature / Problema | Sim (campos de texto) | Origem (pedido, pesquisa) como relação |
| Requisitos | Sim (lista) | Vínculo com tasks, critérios, decisões; autor; histórico |
| Decisões | Sim (por quê, alternativas, quem, onde) | Estado; consequências não-task; artefatos que embasaram |
| Arquitetura | Parcial (`architectureNotes`) | Artefatos registráveis; decisões técnicas identificáveis; aceite |
| Tasks | Sim | Requisito atendido; motivo de bloqueio consistente |
| Histórico | Parcial (mudanças de estado) | Valores anteriores (diff); autoria garantida; sem eventos artificiais |
| Validações | Sim (tentativas + snapshot) | Evidência por critério; ligação reprovação → correção |

Um agente conseguiria hoje montar um bom "estado atual e próximos passos" de uma Feature. Não conseguiria explicar **por que** uma solução foi escolhida, **com base em quê**, nem **como a especificação evoluiu**. As peças que faltam são as mesmas das lacunas estruturais: evidência (G01), vínculos finos (G06) e histórico confiável (G07–G09). Nenhuma exige IA para ser resolvida.

---

## 16. Simplification Opportunities

Nada foi removido; são só apontamentos.

- **Campos sem caminho de escrita, mas exibidos** (D04): `Task.reviewerId` ("Sem revisor" em toda task), `Task.parentTaskId` (subtasks), `Task.meetingId` (follow-up). Decidir entre implementar e remover.
- **Status de Task `REVIEW` sem revisor:** estado sem papel definido.
- **`Requirement.status`** (Proposed/Approved/Implemented/Tested): manual e desconectado de tasks e validação. Duplica informação que deveria vir desses vínculos e pode induzir a erro ("Tested" sem teste).
- **`ValidationResult.PENDING`:** nunca atribuído pelo código.
- **`Artifact.version`:** sempre "v1". **`Product.status`:** sem edição. **`Company`:** um registro, só nome.
- **Quatro campos narrativos com sobreposição** na Feature: `context`, `problem`, `userNeed`, `objective`. Vale confirmar com o uso real se os quatro são preenchidos de forma distinta.
- **Eventos duplicados** no log (validation.started, validation.completed).
- **Participantes da decisão vs. participantes da reunião:** na prática costumam coincidir; o formulário pede os dois.
- **Tela `/releases`:** só leitura de um dado estático do seed; não ajuda o processo hoje.
- **Estágios Discovery, Specification e Architecture:** hoje são rótulos (seção 4). Ou ganham significado (evidência mínima, responsável que faz andar), ou poderiam ser agrupados. Decisão de produto, não técnica.

---

## 17. Operational Gaps

| Situação real | Suporte | Observação |
|---|---|---|
| "Precisamos pesquisar concorrentes" | Parcial | Vira task da Feature; o resultado não pode ser anexado (G01) |
| "Precisamos decidir entre duas alternativas" | Parcial | Decision registra alternativas, mas só **depois** de decidido; não há decisão em aberto/proposta |
| "Precisamos validar uma especificação" | Não | Validation só existe para o que foi construído; Specification avança num clique sem aceite (G02, G03) |
| "Precisamos revisar arquitetura" | Não | Sem registro de revisão; diagramas não anexáveis (G01, G03) |
| "Precisamos preparar a reunião" | Parcial | Próxima reunião + pauta sugerida (da última reunião); sem a pauta registrada, bloqueios e validações (G19) |
| "Precisamos transformar uma reunião em ações" | Parcial | Meeting → Decision → Task funciona; ação sem decisão formal não (G11) |
| "Precisamos saber o que está parado" | Suporta | Tasks bloqueadas + Features sem atividade há 7+ dias |
| "Precisamos saber por que algo está parado" | Parcial | Motivo do bloqueio é opcional (G13); Feature parada não tem motivo |
| "Precisamos saber quem está bloqueando o fluxo" | Parcial | Dependências mostram a task que bloqueia; nada aponta a pessoa; pendências sem dono somem (G12) |
| "Precisamos repriorizar" | Parcial | Campo editável, sem histórico nem motivo (G07) |
| "Precisamos pausar ou descartar uma Feature" | Não | G14 |
| "Precisamos corrigir o que a validação reprovou" | Parcial | Volta para Development; correção não se liga à reprovação (G15) |
| "Precisamos saber o que foi para produção" | Não | G18 |
| "Precisamos registrar uma pesquisa, documento ou diagrama" | Não | G01 |
| "Precisamos saber qual task implementa qual requisito" | Não | G06 |
| "Precisamos incluir uma pessoa ou um produto" | Não | G17 |
| "Precisamos saber o que mudou numa decisão" | Não | G07 |

---

## 18. Technical Debt

| ID | Débito |
|---|---|
| D01 | **Backend aceita o que a UI impede:** task sem origem, autodependência, dependência entre Features, selects sem validação de existência/enum (seção 13.2) |
| D02 | **ActivityLog com texto livre como única carga:** sem before/after estruturado. `entityId` inconsistente (requirement/criteria/validation apontam para a Feature). A UI precisa inferir significado pelo texto: o próprio microfix usa uma expressão regular sobre a descrição |
| D03 | **Eventos artificiais no seed:** 7 de tipos que o produto não emite + 4 com redação diferente. Demonstração e realidade misturadas |
| D04 | **Campos e valores sem uso:** `Task.reviewerId`, `parentTaskId`, `meetingId` (UI exibe, nada escreve), `ValidationResult.PENDING`, `Artifact.version` |
| D05 | **Sem suíte de testes versionada.** As validações das V0.2 (e desta auditoria) foram feitas com scripts Playwright ad hoc fora do repositório. O lint não cobre `.ts`/`.tsx` por causa do TypeScript 7 (61 "Parsing error" conhecidos) |
| D06 | **Identidade por cookie "atuando como",** sem autenticação: aceito por decisão, mas amplia G05 |
| D07 | **Exclusões físicas,** sem arquivamento/soft delete (base de G09 e G06) |
| D08 | **Fuso horário:** datas e horários interpretados e comparados no fuso do servidor (UTC na Vercel) em vez de America/Sao_Paulo (G24) |

---

## 19. Recommended Next Steps

### 19.1 Registro consolidado das lacunas

| ID | Lacuna | Classificação | Seções |
|---|---|---|---|
| G01 | Artifacts não podem ser registrados/vinculados; Descoberta e Arquitetura sem evidência no sistema | **BLOCKER** | 2, 3, 10, 12 |
| G02 | Estágios antes de Review são rótulos; Feature vai de criada a Done sem requisito, task, decisão ou owner | IMPORTANT | 2, 4 |
| G03 | Review (e aceite de especificação/arquitetura) não registra quem, o quê nem o resultado | IMPORTANT | 2, 3, 4 |
| G04 | Aprovação/Done com tasks abertas ou bloqueadas | IMPORTANT | 4, 6, 7 |
| G05 | Mover e aprovar sem usuário selecionado; validador nulo; eventos sem autor | IMPORTANT | 7, 8 |
| G06 | Requisitos soltos (sem vínculo com task, critério, decisão), status manual, editáveis/excluíveis depois de Done, fora do snapshot | IMPORTANT | 3, 7, 10 |
| G07 | Edições sem valor anterior (Feature, Decision, Requirement, Meeting, Task); decisão reescrevível depois de gerar trabalho | IMPORTANT | 5, 8 |
| G08 | Histórico da Feature incompleto: sem requisitos, decisões, tasks excluídas; limite de 30 | IMPORTANT | 8 |
| G09 | Exclusão física de task em qualquer estado apaga evidência e o desdobramento da decisão | IMPORTANT | 6, 13 |
| G10 | Decision sem ciclo de vida; consequências não-task invisíveis; falsos positivos permanentes em "Decisões sem task" | IMPORTANT | 3, 5, 9 |
| G11 | Ação de reunião sem decisão formal (follow-up) não existe na UI | IMPORTANT | 5, 6 |
| G12 | Pendências sem dono não aparecem para ninguém (Feature sem owner, task sem responsável, Development sem tasks, estágios iniciais) | IMPORTANT | 9 |
| G13 | Bloqueio sem motivo (botão e formulário); Feature parada sem motivo | IMPORTANT | 6, 17 |
| G14 | Não há como pausar/descartar/arquivar Feature | IMPORTANT | 4 |
| G15 | Reprovação não se liga às correções; reteste indistinguível (critérios pré-marcados) | IMPORTANT (ligação) / MINOR (pré-marcação) | 7 |
| G16 | "Aprovar" com critério pendente vira tentativa reprovada e regressão | MINOR | 4, 13 |
| G17 | Person, Product, Release, Company sem cadastro pela UI; demo não separável dos dados reais | IMPORTANT | 12 |
| G18 | Release isolado; Done ≠ produção | MINOR | 11 |
| G19 | Pauta sugerida parcial; próxima reunião sem a pauta registrada | MINOR | 9 |
| G20 | Task: dependência única e não impeditiva; status livre | MINOR | 6 |
| G22 | Listas sem filtro (tasks por pessoa/status); Activity global limitado a 200 | MINOR | 8 |
| G23 | Linguagem e duplicação no log ("foi editada", validation.started/completed, eventos agregados) | MINOR | 8 |
| G24 | Fuso: horário da reunião e "atrasada" calculados em UTC (3 h de diferença para São Paulo) | MINOR | 9 |
| — | Stepper compacto não distingue Backlog de Discovery | MINOR | 1 |
| D01–D08 | Débitos técnicos (seção 18) | DEBT | 18 |

(G21 foi incorporado a G07.)

### 19.2 Próximos passos (ordem de dependência, sem implementar)

1. **Decidir, com a equipe, as três lacunas estruturais abaixo** antes de novos módulos. São decisões de produto com impacto em modelo e processo: o que conta como evidência de cada etapa, o que o histórico precisa preservar, quem pode fazer o quê.
2. **Tornar o histórico confiável antes de ampliá-lo** (G05, G07, G08, G09). Qualquer funcionalidade nova construída sobre um log reescrevível herda o problema.
3. **Dar lugar à evidência das etapas iniciais** (G01, G03, G06). Esta é a parte do processo que ainda vive no Drive e na memória.
4. **Tratar ownership como dado obrigatório onde o Dashboard depende dele** (G12, G13, G10, G14).
5. **Deixar para depois:** Release (G18), estados novos no workflow além de pausar/descartar, permissões por papel, IA, notificações.
6. **Em paralelo, técnico:** suíte de testes versionada (D05) antes de mexer em regras de workflow.

### Pergunta final — se o HMP começar a usar o HMP OS amanhã para conduzir o desenvolvimento real do Nutria, quais partes do processo ainda precisarão acontecer fora do sistema?

1. **Guardar e referenciar pesquisa, especificação detalhada e diagramas.** Continuarão no Drive/Figma sem vínculo navegável a partir do sistema (G01). Isso é legítimo para o arquivo, não para a referência.
2. **Revisar e aceitar especificação, arquitetura e o resultado do desenvolvimento.** A conversa e o aceite acontecem fora; o sistema só registra que alguém clicou para mudar de estágio (G03).
3. **Lembrar por que e por quem algo mudou.** Repriorizações, trocas de responsável, reescritas de decisões e requisitos ficam na memória (G07).
4. **Ações de reunião sem decisão formal,** e o motivo de bloqueios e paradas. Tendem a ficar nas notas e no WhatsApp (G11, G13).
5. **Pausar ou descartar uma Feature,** e saber o que foi para produção (G14, G18).
6. **Incluir pessoas, produtos e ciclos, e separar a demonstração dos dados reais.** Exige um desenvolvedor (G17).

O que **já pode** acontecer dentro do sistema:

- registrar reuniões e decisões com o porquê;
- transformar decisões em tasks e acompanhar a execução;
- saber o que está com cada pessoa e o que está bloqueado ou atrasado;
- validar a Feature contra critérios, com histórico de tentativas.

### Pergunta final — quais são as 3 lacunas estruturais mais importantes a resolver antes de continuar expandindo o produto?

**1. Histórico confiável — o sistema ainda pode ser reescrito sem deixar rastro** (G05, G07, G08, G09, D02, D07).
- **Por que é estrutural:** a rastreabilidade é o requisito fundamental do HMP OS. É o critério de sucesso do MVP ("responder as perguntas de rastreabilidade usando apenas os dados registrados"). Hoje:
  - decisões, requisitos, prioridades e responsáveis mudam registrando só "foi editada";
  - tasks concluídas desaparecem;
  - requisitos mudam depois de Done;
  - aprovações podem não ter autor;
  - o Histórico da Feature omite parte do que aconteceu.
- **O risco:** toda funcionalidade futura (relatórios, contexto para IA, auditoria de decisões) fica construída sobre um registro em que não se pode confiar. Um sistema de rastreabilidade que permite reescrever o passado não é fonte da verdade.

**2. Evidência e vínculos da metade inicial do processo — o "por quê" e o "como" ainda vivem fora** (G01, G02, G03, G06).
- **Por que é estrutural:** Descoberta, Especificação, Arquitetura e Review são metade do fluxo da HMP. Hoje são rótulos:
  - não há onde anexar a pesquisa ou o diagrama;
  - nada registra aceite ou revisão;
  - requisitos não se ligam ao que os implementa nem ao que os comprova.
- **O efeito:** o sistema acompanha bem a execução, mas não consegue explicar por que uma solução foi escolhida nem provar que o que foi construído é o que foi especificado. Essa é exatamente a cadeia que motivou o projeto (necessidade → decisão → especificação → arquitetura → desenvolvimento → validação).

**3. Responsabilidade explícita nas pendências e transições — "quem precisa agir agora" depende de campos opcionais** (G05, G10, G12, G13, G14).
- **Por que é estrutural:** o cockpit da V0.2-D só é tão bom quanto os dados de responsabilidade. Hoje:
  - owner, responsável e motivo de bloqueio são opcionais;
  - estágios iniciais não têm quem faça a Feature andar;
  - revisão e aprovação não exigem uma pessoa;
  - decisões não têm estado nem dono do desdobramento;
  - Features não podem ser pausadas ou descartadas.
- **O resultado:** o sistema sabe que algo está pendente e não sabe de quem: exatamente os casos que voltam para o WhatsApp. Sem isso, "Precisa de você" e "Atenção do time" acumulam falsos negativos e ruído, e a equipe deixa de confiar no painel.

Nenhuma das três exige novos módulos. Todas são sobre **tornar confiável e completo o que já existe** antes de ampliar o escopo.
