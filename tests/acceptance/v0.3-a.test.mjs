// Suíte de aceite da V0.3-A — History & Auditability (DV-23).
// Critérios: docs/hmp-os/spec-v0.3-a-history-auditability.md, seção 11 (CA-01 … CA-29).
//
// Roda contra um servidor já no ar (BASE_URL) e o mesmo banco (DATABASE_URL). Reseta o banco para os dados
// de demonstração no início. Os testes são sequenciais: cada um parte do estado deixado pelos anteriores.
// Como rodar: ver README ("Testes de aceite").

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  ACTOR_COOKIE,
  ACTOR_REQUIRED,
  BASE_URL,
  DOMAIN_TABLES,
  HISTORY_PAGE_SIZE,
  HISTORY_TABLES,
  act,
  addCriteria,
  addRequirement,
  assertDisposableDatabase,
  button,
  clickAndWait,
  connectDatabase,
  createDecision,
  createFeature,
  createMeeting,
  createTask,
  dropBrowserValidation,
  expectRefused,
  go,
  historyItems,
  injectField,
  isoDate,
  launchBrowser,
  moveTo,
  openReasonAction,
  openSession,
  reconstructAt,
  resetToDemoSeed,
  setCheckboxes,
  waitForPath,
} from "./support.mjs";

// Mensagens do backend (a UI mostra exatamente estas).
const reason = (what) => `Informe o motivo para ${what} — ele fica registrado no histórico.`;
const MSG = {
  reqLockValidation:
    "A Feature está em Validation — os requisitos ficam travados durante a validação. Para alterá-los, volte a Feature para Review.",
  critLockValidation:
    "Os critérios de aceite ficam travados enquanto a Feature está em Validation. Para alterá-los, volte a Feature para Review.",
  narrativeLockValidation:
    "A Feature está em Validation — título e narrativa ficam travados durante a validação. Para alterá-los, volte a Feature para Review.",
  planningLockDone: "A Feature está em Done — prioridade e responsáveis ficam como estavam na aprovação.",
  reqLockDone: "A Feature está em Done — os requisitos ficam como foram aprovados e não podem mais mudar.",
  critLockDone: "A Feature já está em Done — os critérios de aceite ficam travados e não podem mais ser alterados.",
  featureDoneStatus: "Esta Feature já está em Done — o status não muda mais.",
  featureDoneNoTasks:
    "A Feature já está em Done — ela não recebe novas tasks. Para trabalho adicional, registre uma nova Feature.",
  taskReopenFeatureDone: "A Feature desta task está em Done — uma task concluída não pode mais ser reaberta.",
  taskContentFeatureDone: "A Feature desta task está em Done — o conteúdo da task fica como estava.",
  taskDoneContent: "Esta task está concluída — para editá-la, reabra-a primeiro (com um motivo).",
  taskDoneArchive: "Tasks concluídas não podem ser arquivadas — elas são a evidência do trabalho feito.",
  decisionWindowLock:
    "A janela de correção desta decisão (24 h após o registro) terminou — o mérito não pode mais ser editado. Registre uma nova decisão que substitui esta, ou revogue-a com um motivo.",
  decisionTasksLock:
    "Esta decisão já gerou trabalho — o mérito não pode mais ser editado. Registre uma nova decisão que substitui esta, ou revogue-a com um motivo.",
  decisionSuperseded: "Esta decisão foi substituída — ela fica como estava e não pode mais ser alterada.",
  decisionRevoked: "Esta decisão foi revogada — ela fica como estava e não pode mais ser alterada.",
  decisionInactiveNoTasks:
    "Esta decisão foi substituída ou revogada — ela não gera mais tasks. Crie a task a partir da decisão vigente.",
  futureDecision: "A data da decisão não pode ser no futuro — registre a decisão quando ela for tomada.",
  taskFeatureMustMatchDecision: "A Task precisa ficar na Feature da decisão de origem.",
  validationNeedsReview: "A Feature não pode avançar para Validation porque precisa passar primeiro por Review.",
};

const TRUNCATE_ALL = `TRUNCATE "ActivityChange", "ActivityLog", "TaskDependency", "ValidationRecord", "AcceptanceCriteria",
  "Artifact", "DecisionParticipant", "Decision", "Task", "Requirement", "MeetingParticipant", "Meeting", "Feature",
  "Release", "Product", "Person", "Company" RESTART IDENTITY CASCADE`;

const ctx = { fx: {}, sessions: [] };
let lastCounts = null;

async function loadIds(db) {
  const byName = async (table, column) =>
    Object.fromEntries((await db.q(`select id, "${column}" as k from "${table}"`)).map((r) => [r.k, r.id]));
  const decision = async (prefix) => (await db.one(`select id from "Decision" where title like $1`, [`${prefix}%`])).id;
  const meeting = async (title) => (await db.one(`select id from "Meeting" where title = $1`, [title])).id;
  return {
    people: await byName("Person", "name"),
    product: await byName("Product", "name"),
    plano: (await db.one(`select id from "Feature" where title = 'Elaboração do Plano Alimentar'`)).id,
    decisionP0: await decision("Planejamento Alimentar será tratado"),
    decisionMacros: await decision("Plano Alimentar incluirá cálculo automático"),
    decisionExomia: await decision("Exomia entra em fase de Discovery"),
    meetingPast: await meeting("Reunião HMP — Planejamento Nutria"),
    meetingNext: await meeting("Reunião HMP — Acompanhamento semanal"),
  };
}

async function setupSessions() {
  for (const s of ctx.sessions) await s.close();
  ctx.ids = await loadIds(ctx.db);
  const { people } = ctx.ids;
  ctx.heitor = await openSession(ctx.browser, people.Heitor);
  ctx.linard = await openSession(ctx.browser, people.Linard);
  ctx.pedro = await openSession(ctx.browser, people.Pedro);
  ctx.anon = await openSession(ctx.browser, null);
  ctx.sessions = [ctx.heitor, ctx.linard, ctx.pedro, ctx.anon];
}

before(async () => {
  assertDisposableDatabase();
  resetToDemoSeed();
  ctx.db = await connectDatabase();
  ctx.browser = await launchBrowser();
  await setupSessions();
  await go(ctx.heitor.page, "/features");
  if ((await ctx.heitor.page.locator(`a[href="/features/${ctx.ids.plano}"]`).count()) === 0) {
    throw new Error(`O servidor em ${BASE_URL} não está usando o banco de DATABASE_URL — aponte os dois para o mesmo banco.`);
  }
});

after(async () => {
  for (const s of ctx.sessions) await s.close().catch(() => {});
  await ctx.browser?.close();
  await ctx.db?.close();
});

/** Um critério de aceite. Depois de cada um: nenhuma tabela de domínio ou de histórico perdeu linhas (CA-20). */
function ca(name, fn) {
  test(name, async () => {
    await fn(ctx);
    const counts = await ctx.db.counts([...DOMAIN_TABLES, ...HISTORY_TABLES]);
    if (ctx.trackCounts && lastCounts) {
      for (const [table, n] of Object.entries(counts)) {
        assert.ok(n >= lastCounts[table], `CA-20: a contagem de "${table}" diminuiu (${lastCounts[table]} → ${n})`);
      }
    }
    if (ctx.trackCounts) lastCounts = counts;
    assert.deepEqual(ctx.sessions.flatMap((s) => s.pageErrors), [], "sem erros de JavaScript nas páginas");
  });
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mainText = (page) => page.locator("main").innerText();
const changes = (event) => event.changes.map((c) => [c.field, c.fromValue, c.toValue]);
const row = (db, table, id, columns = "*") => db.one(`select ${columns} from "${table}" where id = $1`, [id]);
const eventsAfter = (db, seq) => db.events("l.seq > $1::bigint", [seq]);

/** Links para `href` no estado atual da página: fora dos históricos (que seguem apontando para o item) e dos arquivados. */
function currentStateLinks(page, href) {
  return page.evaluate(
    (href) =>
      [...document.querySelectorAll(`main a[href="${href}"]`)].filter(
        (a) => !a.closest("[data-activity-feed]") && !a.closest("[data-archived-list]"),
      ).length,
    href,
  );
}

/** Itens (fora dos históricos) que listam `href` com o selo "Arquivada" — ex.: as tasks geradas por uma decisão. */
function archivedEntries(page, href) {
  return page.evaluate(
    (href) =>
      [...document.querySelectorAll("main li")].filter(
        (li) => !li.closest("[data-activity-feed]") && li.querySelector(`a[href="${href}"]`) && /\bArquivada\b/.test(li.innerText),
      ).length,
    href,
  );
}

// =====================================================================================================
// Autoria e atomicidade
// =====================================================================================================

ca("CA-01 (exceção) — com o banco vazio, carregar a demonstração não exige autor", async ({ db, anon }) => {
  await db.q(TRUNCATE_ALL);
  await go(anon.page, "/");
  await anon.page.getByRole("button", { name: /Selecionar usuário/ }).click();
  const status = await clickAndWait(anon.page, button(anon.page, "Carregar dados de demonstração"));
  assert.equal(status, 200);
  assert.equal(await db.count("Person"), 3, "demonstração carregada");
  // Os eventos são a narrativa da demonstração (com os personagens da história), todos marcados como seed.
  const events = await db.events();
  assert.ok(events.length > 0);
  assert.ok(events.every((e) => e.source === "seed"), "eventos da demonstração marcados como seed");

  await setupSessions();
  ctx.trackCounts = true;
});

ca("CA-28 (demonstração) — cada entidade tem baseline e os eventos do seed aparecem marcados", async ({ db, heitor }) => {
  const types = [
    ["Person", "person"],
    ["Product", "product"],
    ["Feature", "feature"],
    ["Requirement", "requirement"],
    ["AcceptanceCriteria", "criteria"],
    ["Task", "task"],
    ["Decision", "decision"],
    ["Meeting", "meeting"],
  ];
  for (const [table, type] of types) {
    const missing = await db.count(
      table,
      `not exists (select 1 from "ActivityLog" l where l."entityType" = '${type}' and l."entityId" = "${table}".id and l."eventType" = '${type}.baseline')`,
    );
    assert.equal(missing, 0, `${table}: entidade sem evento baseline`);
  }
  await go(heitor.page, "/activity");
  const items = await historyItems(heitor.page, "main");
  assert.ok(items.length > 0);
  assert.ok(items.every((t) => /demonstração/iu.test(t)), "todo evento do seed tem o selo de demonstração");
  assert.ok(items.every((t) => !t.includes("Estado inicial")), "eventos baseline não aparecem nos históricos");
});

ca("CA-01 — sem usuário selecionado, toda escrita é recusada e nada muda no banco", async ({ db, anon, heitor, ids, fx }) => {
  const page = anon.page;
  const refuse = (trigger, scope) => expectRefused(page, db, { trigger, message: ACTOR_REQUIRED, scope });

  await go(page, "/");
  assert.match(await page.locator('[role="note"]').innerText(), /navegando sem usuário selecionado/);

  // Criar
  await go(page, "/meetings/new");
  await page.fill('input[name="title"]', "Reunião sem autor");
  await page.fill('input[name="date"]', `${isoDate(2)}T10:00`);
  await refuse(() => button(page, "Registrar reunião").click());

  await go(page, "/decisions/new");
  await page.fill('input[name="title"]', "Decisão sem autor");
  await page.fill('textarea[name="decision"]', "Texto da decisão sem autor.");
  await page.selectOption('select[name="authorId"]', ids.people.Pedro);
  await refuse(() => button(page, "Registrar decisão").click());

  await go(page, "/features/new");
  await page.fill('input[name="title"]', "Feature sem autor");
  await page.selectOption('select[name="productId"]', ids.product.Nutria);
  await refuse(() => button(page, "Criar Feature").click());

  await go(page, `/tasks/new?featureId=${ids.plano}`);
  await page.fill('input[name="title"]', "Task sem autor");
  await refuse(() => button(page, "Criar Task").click());

  // Editar
  await go(page, `/features/${ids.plano}/edit`);
  await page.selectOption('select[name="priority"]', "P1");
  await refuse(() => button(page, "Salvar alterações").click());

  const openTask = await db.one(
    `select id from "Task" where "featureId" = $1 and status = 'TODO' and "archivedAt" is null order by "createdAt" limit 1`,
    [ids.plano],
  );
  await go(page, `/tasks/${openTask.id}/edit`);
  await page.fill('input[name="title"]', "Título sem autor");
  await refuse(() => button(page, "Salvar alterações").click());

  await go(page, `/meetings/${ids.meetingNext}/edit`);
  await page.fill('textarea[name="notes"]', "Notas sem autor");
  await refuse(() => button(page, "Salvar alterações").click());

  await go(page, `/decisions/${ids.decisionP0}/edit`);
  await page.fill('input[name="title"]', "Título sem autor");
  await page.fill('textarea[name="changeReason"]', "Sem autor");
  await refuse(() => button(page, "Corrigir título").click());

  // Mudar status
  await go(page, `/features/${ids.plano}`);
  await refuse(() => page.locator('button[title="Mover para Review"]').click());
  await go(page, `/tasks/${openTask.id}`);
  await refuse(() => page.locator('button[title="Mover para In progress"]').click());

  // Requisito e critério
  await go(page, `/features/${ids.plano}`);
  const newReq = page.locator('form:has(input[placeholder="Descrição do novo requisito"])');
  await newReq.locator('input[name="description"]').fill("Requisito sem autor");
  await refuse(() => button(page, "+ Adicionar", newReq).click(), newReq);
  const newCrit = page.locator('form:has(input[placeholder="Descrição do novo critério de aceite"])');
  await newCrit.locator('input[name="description"]').fill("Critério sem autor");
  await refuse(() => button(page, "+ Adicionar", newCrit).click(), newCrit);

  // Arquivar
  await go(page, `/tasks/${openTask.id}/edit`);
  const archive = await openReasonAction(page, { label: "Arquivar esta task", reason: "Sem autor", confirm: "Arquivar task" });
  await refuse(() => archive.confirm.click(), archive.details);

  // Restaurar (preparação: Heitor arquiva um requisito)
  const req = await db.one(
    `select id, description from "Requirement" where "featureId" = $1 and "archivedAt" is null order by "createdAt" desc limit 1`,
    [ids.plano],
  );
  await go(heitor.page, `/features/${ids.plano}`);
  const archiveReq = await openReasonAction(heitor.page, {
    root: heitor.page.locator(`[data-requirement="${req.id}"]`),
    label: "Arquivar",
    reason: "Ideia ainda não aprofundada — fica para depois",
    confirm: "Arquivar requisito",
  });
  await clickAndWait(heitor.page, archiveReq.confirm);
  assert.ok((await row(db, "Requirement", req.id)).archivedAt, "requisito arquivado pelo Heitor");
  fx.archivedRequirement = req;

  await go(page, `/features/${ids.plano}`);
  await page.locator("[data-archived-list] > summary", { hasText: "Requisitos arquivados" }).click();
  const restore = await openReasonAction(page, {
    root: page.locator("[data-archived-list] li", { hasText: req.description }),
    label: "Restaurar",
    reason: "Sem autor",
    confirm: "Restaurar requisito",
  });
  await refuse(() => restore.confirm.click(), restore.details);

  // Substituir e revogar
  await go(page, `/decisions/new?supersedes=${ids.decisionExomia}`);
  await page.fill('textarea[name="supersedeReason"]', "Sem autor");
  await page.selectOption('select[name="authorId"]', ids.people.Heitor);
  await refuse(() => button(page, "Registrar e substituir").click());

  await go(page, `/decisions/${ids.decisionExomia}`);
  const revoke = await openReasonAction(page, { label: "Revogar decisão", reason: "Sem autor", confirm: "Revogar" });
  await refuse(() => revoke.confirm.click(), revoke.details);
  // Validar sem autor: CA-25 (a Feature precisa estar em Validation).
});

ca("CA-02 — escrita gera evento v2 com autor, entidade, rótulo, escopos e correlação", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  const seq = await db.maxSeq();
  const title = "Validar a fórmula de macros com a nutricionista";
  fx.t06 = await createTask(page, { decisionId: ids.decisionMacros, title, assigneeId: ids.people.Pedro });

  const events = await eventsAfter(db, seq);
  assert.equal(events.length, 1, "uma ação, um evento");
  const [e] = events;
  const decision = await row(db, "Decision", ids.decisionMacros, `"featureId", "meetingId"`);
  assert.equal(e.schemaVersion, 2);
  assert.equal(e.source, "app");
  assert.equal(e.eventType, "task.created");
  assert.equal(e.actorId, ids.people.Heitor);
  assert.equal(e.actorName, "Heitor");
  assert.equal(e.entityType, "task");
  assert.equal(e.entityId, fx.t06);
  assert.equal(e.entityLabel, title);
  assert.equal(e.featureId, decision.featureId);
  assert.equal(e.decisionId, ids.decisionMacros);
  assert.equal(e.meetingId, decision.meetingId);
  assert.equal(e.productId, ids.product.Nutria);
  assert.match(e.correlationId, /^[0-9a-f-]{36}$/);
  assert.equal(e.snapshot.title, title);
  assert.equal(e.snapshot.assigneeName, "Pedro");
  // Correlação: a mesma ação compartilha (CA-16, CA-25); ações diferentes não.
  const previous = await db.one(`select "correlationId" from "ActivityLog" where "correlationId" is not null and seq < $1::bigint order by seq desc limit 1`, [e.seq]);
  assert.notEqual(previous?.correlationId, e.correlationId);
});

ca("CA-03 — se o evento não puder ser gravado, a mudança de estado não acontece", async ({ db, heitor, ids }) => {
  const page = heitor.page;
  await db.q(`CREATE OR REPLACE FUNCTION hmp_test_fail_event() RETURNS trigger AS $$
    BEGIN
      IF NEW.description LIKE '%[falha-simulada]%' THEN RAISE EXCEPTION 'falha simulada ao gravar o evento'; END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql`);
  await db.q(`CREATE TRIGGER hmp_test_fail_event BEFORE INSERT ON "ActivityLog" FOR EACH ROW EXECUTE FUNCTION hmp_test_fail_event()`);
  try {
    // Criar: a task não pode nascer sem o evento.
    await go(page, `/tasks/new?featureId=${ids.plano}`);
    await page.fill('input[name="title"]', "Task [falha-simulada]");
    let before = await db.fingerprint();
    assert.equal(await act(page, () => button(page, "Criar Task").click()), 500, "o erro inesperado chega como falha");
    assert.equal(await db.count("Task", `title like '%[falha-simulada]%'`), 0, "a task não foi criada");
    assert.equal(await db.fingerprint(), before, "nada mudou no banco");

    // Editar: o título continua o anterior.
    const task = await db.one(
      `select id, title from "Task" where "featureId" = $1 and "archivedAt" is null and status <> 'DONE' order by "createdAt" limit 1`,
      [ids.plano],
    );
    await go(page, `/tasks/${task.id}/edit`);
    await page.fill('input[name="title"]', `${task.title} [falha-simulada]`);
    before = await db.fingerprint();
    assert.equal(await act(page, () => button(page, "Salvar alterações").click()), 500);
    assert.equal((await row(db, "Task", task.id)).title, task.title, "a edição foi desfeita junto com o evento");
    assert.equal(await db.fingerprint(), before);
  } finally {
    await db.q(`DROP TRIGGER IF EXISTS hmp_test_fail_event ON "ActivityLog"`);
    await db.q(`DROP FUNCTION IF EXISTS hmp_test_fail_event()`);
    heitor.pageErrors.length = 0; // o erro inesperado provocado aparece no navegador — é o esperado aqui
  }
});

ca("CA-04 — salvar um formulário sem alterar nada não gera evento", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  const task = await db.one(
    `select id from "Task" where "featureId" = $1 and "archivedAt" is null and status <> 'DONE' order by "createdAt" limit 1`,
    [ids.plano],
  );
  fx.windowDecision = await createDecision(page, {
    title: "Plano mostra substituições equivalentes",
    text: "O plano alimentar sugere substituições equivalentes para cada alimento, respeitando as calorias da refeição.",
    affects: `feature:${ids.plano}`,
  });
  const forms = [
    [`/tasks/${task.id}/edit`, `/tasks/${task.id}`],
    [`/features/${ids.plano}/edit`, `/features/${ids.plano}`],
    [`/meetings/${ids.meetingPast}/edit`, `/meetings/${ids.meetingPast}`],
    [`/decisions/${fx.windowDecision}/edit`, `/decisions/${fx.windowDecision}`],
  ];
  for (const [form, back] of forms) {
    await go(page, form);
    const before = await db.fingerprint();
    await clickAndWait(page, button(page, "Salvar alterações"));
    await waitForPath(page, new RegExp(`^${back}$`));
    assert.equal(await db.fingerprint(), before, `${form}: salvar sem mudança não escreve nada`);
  }
});

// =====================================================================================================
// O que mudou
// =====================================================================================================

ca("CA-05 — prioridade P2 → P0 aparece no histórico da Feature com de/para, autor e data", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  fx.shoppingFeature = await createFeature(page, { title: "Lista de compras do plano", productId: ids.product.Nutria, priority: "P2" });
  const seq = await db.maxSeq();
  await go(page, `/features/${fx.shoppingFeature}/edit`);
  await page.selectOption('select[name="priority"]', "P0");
  await clickAndWait(page, button(page, "Salvar alterações"));
  await waitForPath(page, new RegExp(`^/features/${fx.shoppingFeature}$`));

  const [e] = await eventsAfter(db, seq);
  assert.equal(e.eventType, "feature.updated");
  assert.deepEqual(changes(e), [["priority", "P2", "P0"]]);
  const [latest] = await historyItems(page);
  assert.match(latest, /Prioridade: P2 · Média → P0 · Urgente/);
  assert.match(latest, /Heitor · /);
});

ca("CA-06 — trocar o responsável grava ids e nomes e aparece nos históricos da task, da Feature e da decisão", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  const seq = await db.maxSeq();
  await go(page, `/tasks/${fx.t06}/edit`);
  await page.selectOption('select[name="assigneeId"]', ids.people.Linard);
  await clickAndWait(page, button(page, "Salvar alterações"));
  await waitForPath(page, new RegExp(`^/tasks/${fx.t06}$`));

  const [e] = await eventsAfter(db, seq);
  assert.equal(e.changes.length, 1);
  const [c] = e.changes;
  assert.deepEqual(
    [c.field, c.fromValue, c.toValue, c.fromLabel, c.toLabel],
    ["assigneeId", ids.people.Pedro, ids.people.Linard, "Pedro", "Linard"],
  );
  for (const path of [`/tasks/${fx.t06}`, `/features/${ids.plano}`, `/decisions/${ids.decisionMacros}`]) {
    await go(page, path);
    assert.match(await mainText(page), /Responsável: Pedro → Linard/, `histórico de ${path}`);
  }
});

ca("CA-07 — o texto longo anterior fica recuperável no histórico (ver antes e depois)", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  const saveAndReturn = async (back) => {
    await clickAndWait(page, button(page, "Salvar alterações"));
    await waitForPath(page, new RegExp(`^${back}$`));
  };

  // Problema da Feature
  const problem =
    "O nutricionista monta a lista de compras à mão, a partir do plano, e erra as quantidades quando o paciente troca refeições ao longo da semana.";
  await go(page, `/features/${fx.shoppingFeature}/edit`);
  await page.fill('textarea[name="problem"]', problem);
  await saveAndReturn(`/features/${fx.shoppingFeature}`);
  let seq = await db.maxSeq();
  await go(page, `/features/${fx.shoppingFeature}/edit`);
  await page.fill('textarea[name="problem"]', "Lista de compras gerada a partir do plano.");
  await saveAndReturn(`/features/${fx.shoppingFeature}`);
  let [e] = await eventsAfter(db, seq);
  assert.deepEqual(changes(e), [["problem", problem, "Lista de compras gerada a partir do plano."]]);
  const item = page.locator("#historico ol > li").first();
  await item.locator("summary", { hasText: "ver antes e depois" }).click();
  assert.match(await item.innerText(), new RegExp(escapeRegExp(problem)), "texto anterior completo na tela");

  // Notas da reunião
  const notes = "Combinado: revisar o cálculo de macros com a nutricionista parceira antes de liberar o plano para pacientes.";
  await go(page, `/meetings/${ids.meetingNext}/edit`);
  await page.fill('textarea[name="notes"]', notes);
  await saveAndReturn(`/meetings/${ids.meetingNext}`);
  seq = await db.maxSeq();
  await go(page, `/meetings/${ids.meetingNext}/edit`);
  await page.fill('textarea[name="notes"]', "Revisão do cálculo marcada.");
  await saveAndReturn(`/meetings/${ids.meetingNext}`);
  [e] = await eventsAfter(db, seq);
  assert.deepEqual(changes(e), [["notes", notes, "Revisão do cálculo marcada."]]);

  // Texto da decisão, dentro da janela de correção
  const original = (await row(db, "Decision", fx.windowDecision)).decision;
  seq = await db.maxSeq();
  await go(page, `/decisions/${fx.windowDecision}/edit`);
  await page.fill('textarea[name="decision"]', "O plano sugere substituições equivalentes por grupo alimentar.");
  await saveAndReturn(`/decisions/${fx.windowDecision}`);
  [e] = await eventsAfter(db, seq);
  assert.deepEqual(changes(e), [["decision", original, "O plano sugere substituições equivalentes por grupo alimentar."]]);
  assert.match(await mainText(page), /Decisão: texto alterado/);
});

ca("CA-08 — adicionar e remover participantes registra os conjuntos e a tela mostra quem entrou e saiu", async ({ db, heitor, ids }) => {
  const page = heitor.page;
  const { Heitor, Linard, Pedro } = ids.people;
  const meetingId = await createMeeting(page, {
    title: "Refinamento do relatório de adesão",
    date: `${isoDate(5)}T15:00`,
    participantIds: [Heitor, Pedro],
  });
  const seq = await db.maxSeq();
  await go(page, `/meetings/${meetingId}/edit`);
  await setCheckboxes(page, "participantIds", [Heitor, Linard]);
  await clickAndWait(page, button(page, "Salvar alterações"));
  await waitForPath(page, new RegExp(`^/meetings/${meetingId}$`));

  const [e] = await eventsAfter(db, seq);
  const c = e.changes.find((x) => x.field === "participants");
  const people = (list) => list.map((p) => `${p.name}:${p.id}`).sort();
  assert.deepEqual(people(c.fromValue), [`Heitor:${Heitor}`, `Pedro:${Pedro}`]);
  assert.deepEqual(people(c.toValue), [`Heitor:${Heitor}`, `Linard:${Linard}`]);
  assert.match(await mainText(page), /Participantes: entraram Linard · saíram Pedro/);
});

ca("CA-09 — o motivo do bloqueio fica no evento da transição, mesmo depois de desbloquear ou trocar", async ({ db, heitor, ids }) => {
  const page = heitor.page;
  const taskId = await createTask(page, { featureId: ids.plano, title: "Importar a tabela TACO de alimentos", assigneeId: ids.people.Pedro });
  const block = async (why) => {
    await go(page, `/tasks/${taskId}/edit`);
    await page.selectOption('select[name="status"]', "BLOCKED");
    await page.fill('input[name="blockedReason"]', why);
    await clickAndWait(page, button(page, "Salvar alterações"));
    await waitForPath(page, new RegExp(`^/tasks/${taskId}$`));
  };

  let seq = await db.maxSeq();
  await block("Aguardando a licença da tabela TACO");
  const [blocked] = await eventsAfter(db, seq);
  assert.deepEqual(changes(blocked), [
    ["blockedReason", null, "Aguardando a licença da tabela TACO"],
    ["status", "TODO", "BLOCKED"],
  ]);

  seq = await db.maxSeq();
  await moveTo(page, "In progress");
  const [unblocked] = await eventsAfter(db, seq);
  assert.deepEqual(changes(unblocked), [
    ["blockedReason", "Aguardando a licença da tabela TACO", null],
    ["status", "BLOCKED", "IN_PROGRESS"],
  ]);

  await block("Aguardando revisão da nutricionista");
  const [again] = await db.events("l.id = $1", [blocked.id]);
  assert.deepEqual(changes(again), changes(blocked), "o evento do primeiro bloqueio não mudou");
  const text = await mainText(page);
  assert.match(text, /Aguardando a licença da tabela TACO/);
  assert.match(text, /Aguardando revisão da nutricionista/);
});

// =====================================================================================================
// Travas: contrato da Feature (Validation → Done)
// =====================================================================================================

ca("CA-10 — Feature em Validation: narrativa, requisitos e critérios travados, inclusive com formulário adulterado", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  fx.F = await createFeature(page, {
    title: "Relatório de adesão ao plano",
    productId: ids.product.Nutria,
    priority: "P1",
    ownerId: ids.people.Heitor,
    problem: "Nutricionistas não sabem se o paciente segue o plano.",
  });
  await addRequirement(page, "Mostrar a adesão semanal por refeição");
  await addCriteria(page, "Nutricionista vê a adesão da última semana");
  fx.R = (await db.one(`select id from "Requirement" where "featureId" = $1`, [fx.F])).id;
  fx.C = (await db.one(`select id from "AcceptanceCriteria" where "featureId" = $1`, [fx.F])).id;
  fx.fDecision = await createDecision(page, {
    title: "Relatório de adesão entra no MVP do Nutria",
    text: "O relatório de adesão faz parte do MVP do Nutria.",
    affects: `feature:${fx.F}`,
  });
  fx.tDone = await createTask(page, { featureId: fx.F, title: "Calcular a adesão semanal", assigneeId: ids.people.Pedro });
  await moveTo(page, "Done");
  fx.tOpen = await createTask(page, { featureId: fx.F, title: "Exportar o relatório em PDF", assigneeId: ids.people.Linard });
  await go(page, `/features/${fx.F}`);
  await moveTo(page, "Review");

  // Abas abertas ainda em Review (formulários liberados)
  const stale = await heitor.newPage();
  await go(stale, `/features/${fx.F}`);
  const staleEdit = await heitor.newPage();
  await go(staleEdit, `/features/${fx.F}/edit`);
  fx.staleReview = stale;

  await go(page, `/features/${fx.F}`);
  await moveTo(page, "Validation");
  assert.equal((await row(db, "Feature", fx.F)).status, "VALIDATION");

  // Requisito: editar, criar e arquivar pela aba antiga
  const reqBox = stale.locator(`[data-requirement="${fx.R}"]`);
  await reqBox.locator('input[name="description"]').fill("Mostrar a adesão diária por refeição");
  await expectRefused(stale, db, { trigger: () => button(stale, "Salvar", reqBox).click(), message: MSG.reqLockValidation, scope: reqBox });
  const newReq = stale.locator('form:has(input[placeholder="Descrição do novo requisito"])');
  await newReq.locator('input[name="description"]').fill("Alertar quando a adesão cair");
  await expectRefused(stale, db, { trigger: () => button(stale, "+ Adicionar", newReq).click(), message: MSG.reqLockValidation, scope: newReq });
  const archiveReq = await openReasonAction(stale, { root: reqBox, label: "Arquivar", reason: "Fora do escopo", confirm: "Arquivar requisito" });
  await expectRefused(stale, db, { trigger: () => archiveReq.confirm.click(), message: MSG.reqLockValidation, scope: archiveReq.details });

  // Critério: criar e arquivar pela aba antiga
  const newCrit = stale.locator('form:has(input[placeholder="Descrição do novo critério de aceite"])');
  await newCrit.locator('input[name="description"]').fill("O relatório abre em menos de 2 segundos");
  await expectRefused(stale, db, { trigger: () => button(stale, "+ Adicionar", newCrit).click(), message: MSG.critLockValidation, scope: newCrit });
  const archiveCrit = await openReasonAction(stale, {
    root: stale.locator(`[data-criteria="${fx.C}"]`),
    label: "Arquivar",
    reason: "Critério duplicado",
    confirm: "Arquivar critério",
  });
  await expectRefused(stale, db, { trigger: () => archiveCrit.confirm.click(), message: MSG.critLockValidation, scope: archiveCrit.details });

  // Narrativa: aba antiga e formulário adulterado
  await staleEdit.fill('textarea[name="problem"]', "Problema reescrito durante a validação");
  await expectRefused(staleEdit, db, { trigger: () => button(staleEdit, "Salvar alterações").click(), message: MSG.narrativeLockValidation });
  await staleEdit.close();

  await go(page, `/features/${fx.F}/edit`);
  assert.match(await page.locator("[data-lock-message]").innerText(), /título e narrativa ficam travados durante a validação/);
  assert.equal(await page.locator('main [name="problem"], main [name="title"]').count(), 0, "narrativa só leitura");
  await injectField(page, "main form", "problem", "Problema adulterado");
  await expectRefused(page, db, { trigger: () => button(page, "Salvar alterações").click(), message: MSG.narrativeLockValidation });

  // Planejamento continua livre até Done
  await go(page, `/features/${fx.F}/edit`);
  await page.selectOption('select[name="priority"]', "P0");
  await clickAndWait(page, button(page, "Salvar alterações"));
  await waitForPath(page, new RegExp(`^/features/${fx.F}$`));
  assert.equal((await row(db, "Feature", fx.F)).priority, "P0");

  // A tela mostra os travados com a explicação
  assert.equal(await page.locator("[data-requirement], [data-criteria] summary").count(), 0);
  assert.ok((await page.getByText(MSG.reqLockValidation).count()) >= 1);
  assert.ok((await page.getByText(MSG.critLockValidation).count()) >= 1);
});

ca("CA-25 — cada tentativa de validação guarda validador, resultados e o snapshot do que foi avaliado", async ({ db, heitor, anon, ids, fx }) => {
  const page = heitor.page;

  // CA-01 / R17: validar sem usuário selecionado é recusado.
  await go(anon.page, `/features/${fx.F}`);
  await anon.page.check(`input[name="criteria_${fx.C}"][value="PASSED"]`);
  await expectRefused(anon.page, db, { trigger: () => button(anon.page, "Aprovar").click(), message: ACTOR_REQUIRED });

  // Tentativa 1: aprovação pedida com critério pendente — bloqueada pelo gate, fica registrada como reprovada.
  await go(page, `/features/${fx.F}`);
  let seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Aprovar"));
  const v1 = await db.one(`select * from "ValidationRecord" where "featureId" = $1 and "attemptNumber" = 1`, [fx.F]);
  assert.equal(v1.requestedResult, "APPROVED");
  assert.equal(v1.overallResult, "REJECTED");
  assert.equal(v1.validatedById, ids.people.Heitor);
  assert.equal(v1.validatedByName, "Heitor");
  assert.deepEqual(v1.criteriaSnapshot, [{ id: fx.C, description: "Nutricionista vê a adesão da última semana", status: "PENDING" }]);
  assert.deepEqual(
    v1.requirementsSnapshot.map((r) => [r.id, r.description, r.status]),
    [[fx.R, "Mostrar a adesão semanal por refeição", "PROPOSED"]],
  );
  assert.deepEqual(v1.tasksSnapshot.map((t) => [t.id, t.status, t.assigneeName]), [
    [fx.tDone, "DONE", "Pedro"],
    [fx.tOpen, "TODO", "Linard"],
  ]);
  assert.equal(v1.featureSnapshot.title, "Relatório de adesão ao plano");
  assert.equal(v1.featureSnapshot.priority, "P0");
  let events = await eventsAfter(db, seq);
  assert.deepEqual(events.map((e) => e.eventType), ["validation.recorded", "feature.status_changed"]);
  assert.equal(events[0].correlationId, events[1].correlationId, "CA-02: uma ação, a mesma correlação");
  assert.equal(events[0].entityId, v1.id);
  assert.equal((await row(db, "Feature", fx.F)).status, "DEVELOPMENT");

  await go(page, `/features/${fx.F}`);
  const attempt1 = page.locator('[data-validation-attempt="1"]');
  assert.match(await attempt1.innerText(), /aprovação pedida, bloqueada pelo gate/);
  await attempt1.locator("[data-validation-snapshot] summary").click();
  const snapshot1 = await attempt1.locator("[data-validation-snapshot]").innerText();
  assert.match(snapshot1, /O que foi avaliado nesta tentativa/);
  assert.match(snapshot1, /Mostrar a adesão semanal por refeição/);
  assert.match(snapshot1, /Calcular a adesão semanal · Done · Pedro/);

  // De volta a Validation
  await moveTo(page, "Review");
  await moveTo(page, "Validation");

  // Abas abertas antes da aprovação (usadas no CA-11)
  const stale = {};
  for (const [key, path] of [
    ["feature", `/features/${fx.F}`],
    ["edit", `/features/${fx.F}/edit`],
    ["openTaskEdit", `/tasks/${fx.tOpen}/edit`],
    ["doneTask", `/tasks/${fx.tDone}`],
    ["newTask", `/tasks/new?featureId=${fx.F}`],
  ]) {
    stale[key] = await heitor.newPage();
    await go(stale[key], path);
  }
  fx.staleDone = stale;

  // Tentativa 2: critério aprovado → Done
  await go(page, `/features/${fx.F}`);
  await page.check(`input[name="criteria_${fx.C}"][value="PASSED"]`);
  seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Aprovar"));
  const v2 = await db.one(`select * from "ValidationRecord" where "featureId" = $1 and "attemptNumber" = 2`, [fx.F]);
  assert.equal(v2.requestedResult, "APPROVED");
  assert.equal(v2.overallResult, "APPROVED");
  assert.equal(v2.validatedByName, "Heitor");
  assert.deepEqual(v2.criteriaSnapshot, [{ id: fx.C, description: "Nutricionista vê a adesão da última semana", status: "PASSED" }]);
  events = await eventsAfter(db, seq);
  assert.deepEqual(events.map((e) => e.eventType), ["validation.recorded", "feature.status_changed"]);
  assert.equal(events[0].correlationId, events[1].correlationId);
  assert.deepEqual(changes(events[0]), [
    [`criteria:${fx.C}`, "PENDING", "PASSED"],
    ["result", null, "APPROVED"],
  ]);
  assert.deepEqual(changes(events[1]), [["status", "VALIDATION", "DONE"]]);
  assert.equal((await row(db, "Feature", fx.F)).status, "DONE");

  await go(page, `/features/${fx.F}`);
  const attempt2 = page.locator('[data-validation-attempt="2"]');
  await attempt2.locator("[data-validation-snapshot] summary").click();
  const snapshot2 = await attempt2.locator("[data-validation-snapshot]").innerText();
  assert.match(snapshot2, /O que foi aprovado nesta tentativa/);
  assert.match(snapshot2, /Exportar o relatório em PDF · To do · Linard/);
});

ca("CA-11 — Feature em Done: nada muda; tasks concluídas não reabrem; abertas só mudam de status ou são arquivadas", async ({ db, heitor, fx }) => {
  const page = heitor.page;
  const s = fx.staleDone;

  // A tela: sem edição, status travado
  await go(page, `/features/${fx.F}`);
  assert.equal(await page.locator(`a[href="/features/${fx.F}/edit"]`).count(), 0, "sem link Editar");
  assert.equal(await page.locator('button[title^="Mover para"]').count(), 0, "status travado");
  assert.equal(await page.locator("[data-requirement]").count(), 0, "requisitos só leitura");
  await go(page, `/features/${fx.F}/edit`);
  assert.match(await page.locator("[data-lock-message]").innerText(), /A Feature está em Done/);
  assert.equal(await page.locator("main form").count(), 0);

  // O backend recusa pelas abas antigas
  await s.edit.selectOption('select[name="priority"]', "P2");
  await expectRefused(s.edit, db, { trigger: () => button(s.edit, "Salvar alterações").click(), message: MSG.planningLockDone });
  await s.feature.locator('button[title="Mover para Development"]').click();
  await s.feature.locator('textarea[name="reason"]').fill("Reabrir para ajustes");
  await expectRefused(s.feature, db, { trigger: () => button(s.feature, "Confirmar: Development").click(), message: MSG.featureDoneStatus });
  const review = fx.staleReview;
  const reqBox = review.locator(`[data-requirement="${fx.R}"]`);
  await expectRefused(review, db, { trigger: () => button(review, "Salvar", reqBox).click(), message: MSG.reqLockDone, scope: reqBox });
  const newCrit = review.locator('form:has(input[placeholder="Descrição do novo critério de aceite"])');
  await expectRefused(review, db, { trigger: () => button(review, "+ Adicionar", newCrit).click(), message: MSG.critLockDone, scope: newCrit });

  // Task concluída: não reabre nem é arquivada
  await s.doneTask.locator('button[title="Mover para To do"]').click();
  await s.doneTask.locator('textarea[name="reason"]').fill("Faltou um caso");
  await expectRefused(s.doneTask, db, { trigger: () => button(s.doneTask, "Confirmar: To do").click(), message: MSG.taskReopenFeatureDone });
  await go(page, `/tasks/${fx.tDone}`);
  assert.equal(await page.locator('button[title^="Mover para"]').count(), 0, "status da task concluída travado");
  assert.equal(await page.locator(`a[href="/tasks/${fx.tDone}/edit"]`).count(), 0);
  await go(page, `/tasks/${fx.tDone}/edit`);
  assert.match(await mainText(page), new RegExp(escapeRegExp(MSG.taskDoneArchive)));
  assert.equal(await page.locator("summary", { hasText: "Arquivar esta task" }).count(), 0);

  // Task aberta: conteúdo travado
  await s.openTaskEdit.fill('input[name="title"]', "Exportar o relatório em PDF e CSV");
  await expectRefused(s.openTaskEdit, db, { trigger: () => button(s.openTaskEdit, "Salvar alterações").click(), message: MSG.taskContentFeatureDone });

  // Nenhuma task nova
  await s.newTask.fill('input[name="title"]', "Nova task depois do Done");
  await expectRefused(s.newTask, db, { trigger: () => button(s.newTask, "Criar Task").click(), message: MSG.featureDoneNoTasks });
  await go(page, "/tasks/new");
  assert.equal(await page.locator(`select[name="featureId"] option[value="${fx.F}"]`).count(), 0);

  // Task aberta: muda de status e pode ser arquivada com motivo (DV-13)
  await go(page, `/tasks/${fx.tOpen}`);
  await moveTo(page, "In progress");
  assert.equal((await row(db, "Task", fx.tOpen)).status, "IN_PROGRESS");
  await go(page, `/tasks/${fx.tOpen}/edit`);
  assert.match(await page.locator("[data-lock-message]").innerText(), /A Feature desta task está em Done/);
  const archive = await openReasonAction(page, {
    label: "Arquivar esta task",
    reason: "Exportação fica para a próxima Feature",
    confirm: "Arquivar task",
  });
  await clickAndWait(page, archive.confirm);
  await waitForPath(page, new RegExp(`^/features/${fx.F}$`));
  const archived = await row(db, "Task", fx.tOpen);
  assert.ok(archived.archivedAt);
  assert.equal(archived.archiveReason, "Exportação fica para a próxima Feature");
  await go(page, `/tasks/${fx.tOpen}`);
  assert.ok(await page.locator("[data-archived-banner]").isVisible());
  assert.equal(await page.locator("summary", { hasText: "Restaurar esta task" }).count(), 0, "não volta para uma Feature em Done");

  for (const p of [...Object.values(s), review]) await p.close();
});

// =====================================================================================================
// Travas: status, tasks e origem
// =====================================================================================================

ca("CA-12 — voltar o status de uma Feature exige motivo, que aparece no histórico", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  fx.hydration = await createFeature(page, { title: "Metas de hidratação", productId: ids.product.Nutria });
  await moveTo(page, "Development");
  await page.locator('button[title="Mover para Specification"]').click();
  assert.match(await mainText(page), /Voltar a Feature para Specification exige um motivo:/);
  await dropBrowserValidation(page);
  await expectRefused(page, db, {
    trigger: () => button(page, "Confirmar: Specification").click(),
    message: reason("voltar o status da Feature"),
  });

  await page.locator('textarea[name="reason"]').fill("Escopo mudou: incluir lembretes de água");
  const seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Confirmar: Specification"));
  const [e] = await eventsAfter(db, seq);
  assert.equal(e.eventType, "feature.status_changed");
  assert.equal(e.reason, "Escopo mudou: incluir lembretes de água");
  assert.deepEqual(changes(e), [["status", "DEVELOPMENT", "SPECIFICATION"]]);
  await go(page, `/features/${fx.hydration}`);
  const [latest] = await historyItems(page);
  assert.match(latest, /voltou de Development para Specification/);
  assert.match(latest, /Motivo: Escopo mudou: incluir lembretes de água/);
});

ca("CA-13 — task concluída: editar e arquivar são recusados; reabrir exige motivo e gera evento", async ({ db, heitor, ids }) => {
  const page = heitor.page;
  const taskId = await createTask(page, { featureId: ids.plano, title: "Revisar os textos do plano", assigneeId: ids.people.Pedro });
  const stale = await heitor.newPage();
  await go(stale, `/tasks/${taskId}/edit`);
  await go(page, `/tasks/${taskId}`);
  await moveTo(page, "Done");

  await stale.fill('input[name="title"]', "Revisar os textos e as imagens do plano");
  await expectRefused(stale, db, { trigger: () => button(stale, "Salvar alterações").click(), message: MSG.taskDoneContent });
  const archive = await openReasonAction(stale, { label: "Arquivar esta task", reason: "Não precisa mais", confirm: "Arquivar task" });
  await expectRefused(stale, db, { trigger: () => archive.confirm.click(), message: MSG.taskDoneArchive, scope: archive.details });
  await stale.close();

  await go(page, `/tasks/${taskId}/edit`);
  assert.match(await page.locator("[data-lock-message]").innerText(), new RegExp(escapeRegExp(MSG.taskDoneContent)));
  assert.match(await mainText(page), new RegExp(escapeRegExp(MSG.taskDoneArchive)));

  await go(page, `/tasks/${taskId}`);
  await page.locator('button[title="Mover para In progress"]').click();
  assert.match(await mainText(page), /Reabrir a task \(Done → In progress\) exige um motivo:/);
  await dropBrowserValidation(page);
  await expectRefused(page, db, { trigger: () => button(page, "Confirmar: In progress").click(), message: reason("reabrir uma task concluída") });
  await page.locator('textarea[name="reason"]').fill("A nutricionista pediu ajuste no texto");
  const seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Confirmar: In progress"));
  const [e] = await eventsAfter(db, seq);
  assert.equal(e.eventType, "task.status_changed");
  assert.equal(e.description, 'Task "Revisar os textos do plano" reaberta: Done → In progress');
  assert.equal(e.reason, "A nutricionista pediu ajuste no texto");
  assert.deepEqual(changes(e), [["status", "DONE", "IN_PROGRESS"]]);
});

ca("CA-14 — a origem da task (Feature, decisão, reunião, criador) não muda, nem com formulário adulterado", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  const origin = `"featureId", "decisionId", "meetingId", "createdById", "createdAt"`;
  const before = await row(db, "Task", fx.t06, origin);
  await go(page, `/tasks/${fx.t06}/edit`);
  for (const [name, value] of [
    ["featureId", fx.hydration],
    ["decisionId", ids.decisionP0],
    ["meetingId", ids.meetingNext],
    ["createdById", ids.people.Pedro],
    ["createdAt", "2020-01-01T00:00:00.000Z"],
  ]) {
    await injectField(page, "main form", name, value);
  }
  await page.selectOption('select[name="priority"]', "P1");
  const seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Salvar alterações"));
  await waitForPath(page, new RegExp(`^/tasks/${fx.t06}$`));
  assert.deepEqual(await row(db, "Task", fx.t06, origin), before, "origem intacta");
  const [e] = await eventsAfter(db, seq);
  assert.deepEqual(e.changes.map((c) => c.field), ["priority"], "só a prioridade mudou");

  // Nascida de uma decisão, a task fica na Feature da decisão.
  await go(page, `/tasks/new?decisionId=${ids.decisionMacros}`);
  await page.fill('input[name="title"]', "Task em outra Feature");
  await page.evaluate((id) => {
    document.querySelector('main form input[name="featureId"]').value = id;
  }, fx.hydration);
  await expectRefused(page, db, { trigger: () => button(page, "Criar Task").click(), message: MSG.taskFeatureMustMatchDecision });
});

// =====================================================================================================
// Travas: decisões e reuniões
// =====================================================================================================

ca("CA-15 — decisão travada: mérito recusado; corrigir o título exige motivo e mantém o anterior", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  const originalTitle = "Planejamento Alimentar será tratado como Feature P0 do Nutria";
  fx.p0NewTitle = "Planejamento Alimentar é a Feature P0 do Nutria";

  // Travada pela janela de 24 h
  await go(page, `/decisions/${ids.decisionP0}`);
  assert.match(await page.locator("[data-decision-state]").innerText(), /Decisão travada — a janela de correção terminou/);
  assert.ok(await page.getByRole("link", { name: "Corrigir título" }).isVisible());
  assert.ok(await page.getByRole("link", { name: "Substituir por nova decisão" }).isVisible());

  await go(page, `/decisions/${ids.decisionP0}/edit`);
  assert.equal(await page.locator('main [name="decision"]').count(), 0, "o mérito não aparece para edição");
  await injectField(page, "main form", "decision", "Mérito adulterado");
  await page.fill('textarea[name="changeReason"]', "Tentativa de mudar o mérito");
  await expectRefused(page, db, { trigger: () => button(page, "Corrigir título").click(), message: MSG.decisionWindowLock });

  await go(page, `/decisions/${ids.decisionP0}/edit`);
  await page.fill('input[name="title"]', fx.p0NewTitle);
  await dropBrowserValidation(page);
  await expectRefused(page, db, {
    trigger: () => button(page, "Corrigir título").click(),
    message: reason("corrigir o título de uma decisão travada"),
  });
  await page.fill('textarea[name="changeReason"]', "Erro de digitação no título");
  const seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Corrigir título"));
  await waitForPath(page, new RegExp(`^/decisions/${ids.decisionP0}$`));
  const [e] = await eventsAfter(db, seq);
  assert.equal(e.eventType, "decision.updated");
  assert.equal(e.reason, "Erro de digitação no título");
  assert.deepEqual(changes(e), [["title", originalTitle, fx.p0NewTitle]]);
  assert.equal((await row(db, "Decision", ids.decisionP0)).title, fx.p0NewTitle);
  await page.locator("[data-original-version] summary").click();
  assert.match(await page.locator("[data-original-version]").innerText(), new RegExp(escapeRegExp(originalTitle)));
  assert.match(await mainText(page), /Motivo: Erro de digitação no título/);

  // Travada por ter gerado trabalho (aba de edição aberta antes da task)
  fx.reminders = await createDecision(page, {
    title: "Lembretes por WhatsApp ficam fora do MVP",
    text: "Os lembretes de refeição por WhatsApp não entram no MVP do Nutria.",
    affects: `feature:${ids.plano}`,
  });
  assert.match(await page.locator("[data-decision-state]").innerText(), /Em janela de correção até/);
  const stale = await heitor.newPage();
  await go(stale, `/decisions/${fx.reminders}/edit`);
  fx.remindersTask = await createTask(page, { decisionId: fx.reminders, title: "Registrar lembretes no backlog de versões futuras" });
  await stale.fill('textarea[name="decision"]', "Os lembretes por WhatsApp entram no MVP.");
  await expectRefused(stale, db, { trigger: () => button(stale, "Salvar alterações").click(), message: MSG.decisionTasksLock });
  await stale.close();
  await go(page, `/decisions/${fx.reminders}`);
  assert.match(await page.locator("[data-decision-state]").innerText(), /Decisão travada — ela já gerou trabalho/);
});

ca("CA-16 — substituir cria a nova decisão com vínculo; a anterior e a revogada param de gerar trabalho", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;

  // Substituir: abas antigas de "criar task" e "corrigir título" da decisão que será substituída
  const staleNewTask = await heitor.newPage();
  await go(staleNewTask, `/tasks/new?decisionId=${ids.decisionMacros}`);
  const staleEdit = await heitor.newPage();
  await go(staleEdit, `/decisions/${ids.decisionMacros}/edit`);

  await go(page, `/decisions/${ids.decisionMacros}`);
  await page.getByRole("link", { name: "Substituir por nova decisão" }).click();
  await waitForPath(page, /^\/decisions\/new$/);
  assert.match(await mainText(page), /Esta nova decisão vai substituir/);
  await page.fill('input[name="title"]', "Plano Alimentar calcula macros e micronutrientes");
  await dropBrowserValidation(page);
  await expectRefused(page, db, { trigger: () => button(page, "Registrar e substituir").click(), message: reason("substituir a decisão anterior") });
  await page.fill('textarea[name="supersedeReason"]', "Nutricionistas pediram micronutrientes");
  const seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Registrar e substituir"));
  await waitForPath(page, /^\/decisions\/(?!new)[^/]+$/);
  const newId = new URL(page.url()).pathname.split("/").pop();
  fx.supersedingDecision = newId;

  assert.equal((await row(db, "Decision", newId)).supersedesId, ids.decisionMacros);
  assert.equal((await row(db, "Decision", ids.decisionMacros)).status, "SUPERSEDED");
  const events = await eventsAfter(db, seq);
  assert.deepEqual(events.map((e) => [e.eventType, e.entityId]), [
    ["decision.created", newId],
    ["decision.superseded", ids.decisionMacros],
  ]);
  assert.equal(events[0].correlationId, events[1].correlationId, "CA-02: uma ação, a mesma correlação");
  assert.equal(events[1].reason, "Nutricionistas pediram micronutrientes");
  assert.match(await mainText(page), /Substitui a decisão/);

  await go(page, `/decisions/${ids.decisionMacros}`);
  const text = await mainText(page);
  assert.match(text, /Substituída por/);
  assert.match(text, /motivo: Nutricionistas pediram micronutrientes/);
  assert.ok((await page.locator(`main a[href="/tasks/${fx.t06}"]`).count()) > 0, "as tasks da decisão anterior continuam visíveis");
  assert.equal(await page.locator(`a[href="/tasks/new?decisionId=${ids.decisionMacros}"]`).count(), 0, "sem + Criar Task");
  assert.equal(await page.getByRole("link", { name: "Corrigir título" }).count(), 0);

  await staleNewTask.fill('input[name="title"]', "Task de decisão substituída");
  await expectRefused(staleNewTask, db, { trigger: () => button(staleNewTask, "Criar Task").click(), message: MSG.decisionInactiveNoTasks });
  await staleEdit.fill('input[name="title"]', "Título de decisão substituída");
  await staleEdit.fill('textarea[name="changeReason"]', "Correção tardia");
  await expectRefused(staleEdit, db, { trigger: () => button(staleEdit, "Corrigir título").click(), message: MSG.decisionSuperseded });
  for (const path of [`/tasks/new?decisionId=${ids.decisionMacros}`, `/decisions/${ids.decisionMacros}/edit`, `/decisions/new?supersedes=${ids.decisionMacros}`]) {
    await go(page, path);
    assert.ok(await page.locator("[data-lock-message]").isVisible(), `${path}: aviso no lugar do formulário`);
  }

  // Revogar
  await go(staleNewTask, `/tasks/new?decisionId=${fx.reminders}`);
  await go(staleEdit, `/decisions/${fx.reminders}/edit`);
  await go(page, `/decisions/${fx.reminders}`);
  let revoke = await openReasonAction(page, { label: "Revogar decisão", reason: null, confirm: "Revogar" });
  await dropBrowserValidation(page);
  await expectRefused(page, db, { trigger: () => revoke.confirm.click(), message: reason("revogar a decisão"), scope: revoke.details });
  await revoke.details.locator("textarea").fill("Lembretes voltaram para o escopo do MVP");
  const seqRevoke = await db.maxSeq();
  await clickAndWait(page, revoke.confirm);
  const revoked = await row(db, "Decision", fx.reminders);
  assert.equal(revoked.status, "REVOKED");
  assert.ok(revoked.revokedAt);
  assert.equal(revoked.revokedById, ids.people.Heitor);
  assert.equal(revoked.revokeReason, "Lembretes voltaram para o escopo do MVP");
  const [revokeEvent] = await eventsAfter(db, seqRevoke);
  assert.equal(revokeEvent.eventType, "decision.revoked");
  assert.equal(revokeEvent.reason, "Lembretes voltaram para o escopo do MVP");

  await staleNewTask.fill('input[name="title"]', "Task de decisão revogada");
  await expectRefused(staleNewTask, db, { trigger: () => button(staleNewTask, "Criar Task").click(), message: MSG.decisionInactiveNoTasks });
  await staleEdit.fill('input[name="title"]', "Título de decisão revogada");
  await staleEdit.fill('textarea[name="changeReason"]', "Correção tardia");
  await expectRefused(staleEdit, db, { trigger: () => button(staleEdit, "Corrigir título").click(), message: MSG.decisionRevoked });
  await go(page, `/decisions/${fx.reminders}`);
  assert.match(await page.locator("[data-decision-state]").innerText(), /Revogada[\s\S]*motivo: Lembretes voltaram para o escopo do MVP/);
  assert.ok((await page.locator(`main a[href="/tasks/${fx.remindersTask}"]`).count()) > 0, "a task gerada continua visível");
  await staleNewTask.close();
  await staleEdit.close();
});

ca("CA-17 — reunião realizada: data e participantes exigem motivo; pauta e notas seguem editáveis", async ({ db, heitor, ids }) => {
  const page = heitor.page;
  const refusal = reason("remarcar ou mudar os participantes de uma reunião que já aconteceu");
  const edit = async () => {
    await go(page, `/meetings/${ids.meetingPast}/edit`);
    assert.ok(await page.locator('textarea[name="changeReason"]').isVisible(), "campo de motivo na reunião realizada");
  };
  const laterHour = (value) => value.replace(/T(\d\d)/, (_, h) => `T${String((Number(h) + 1) % 24).padStart(2, "0")}`);

  await edit();
  await page.fill('input[name="date"]', laterHour(await page.inputValue('input[name="date"]')));
  await expectRefused(page, db, { trigger: () => button(page, "Salvar alterações").click(), message: refusal });

  await edit();
  await setCheckboxes(page, "participantIds", [ids.people.Heitor, ids.people.Pedro]);
  await expectRefused(page, db, { trigger: () => button(page, "Salvar alterações").click(), message: refusal });

  await edit();
  await page.fill('textarea[name="notes"]', "Nota acrescentada depois da reunião.");
  let seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Salvar alterações"));
  await waitForPath(page, new RegExp(`^/meetings/${ids.meetingPast}$`));
  let [e] = await eventsAfter(db, seq);
  assert.deepEqual(e.changes.map((c) => c.field), ["notes"]);
  assert.equal(e.reason, null);

  await edit();
  await page.fill('input[name="date"]', laterHour(await page.inputValue('input[name="date"]')));
  await page.fill('textarea[name="changeReason"]', "O horário foi registrado errado");
  seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Salvar alterações"));
  await waitForPath(page, new RegExp(`^/meetings/${ids.meetingPast}$`));
  [e] = await eventsAfter(db, seq);
  assert.deepEqual(e.changes.map((c) => c.field), ["date"]);
  assert.equal(e.reason, "O horário foi registrado errado");

  // Reunião futura, sem decisões: remarcar não exige motivo.
  await go(page, `/meetings/${ids.meetingNext}/edit`);
  await page.fill('input[name="date"]', laterHour(await page.inputValue('input[name="date"]')));
  seq = await db.maxSeq();
  await clickAndWait(page, button(page, "Salvar alterações"));
  await waitForPath(page, new RegExp(`^/meetings/${ids.meetingNext}$`));
  [e] = await eventsAfter(db, seq);
  assert.deepEqual(e.changes.map((c) => c.field), ["date"]);
});

ca("CA-18 — decisão com data futura é recusada; a página mostra decidida em e registrada em", async ({ db, heitor, ids }) => {
  const page = heitor.page;
  await go(page, "/decisions/new");
  await page.fill('input[name="title"]', "Decisão com data futura");
  await page.fill('textarea[name="decision"]', "Esta decisão ainda não foi tomada.");
  await dropBrowserValidation(page);
  await page.fill('input[name="decidedAt"]', isoDate(1));
  await expectRefused(page, db, { trigger: () => button(page, "Registrar decisão").click(), message: MSG.futureDecision });

  await go(page, `/decisions/${ids.decisionExomia}`);
  const text = await mainText(page);
  assert.match(text, /decidida em .+ · registrada em/);
  assert.match(text, /Decidida em/);
  assert.match(text, /Registrada em/);
});

// =====================================================================================================
// Exclusões
// =====================================================================================================

ca("CA-19 — arquivar exige motivo; o item continua no banco, sai do estado atual e fica no histórico", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  const title = "Montar a lista de substituições";
  const taskId = await createTask(page, {
    decisionId: ids.decisionP0,
    title,
    assigneeId: ids.people.Heitor,
    dueDate: isoDate(-1),
  });
  fx.archivedTask = taskId;
  const href = `/tasks/${taskId}`;
  const planoCounter = async () => {
    await go(page, "/features");
    return /(\d+)\/(\d+) tasks/.exec(await page.locator(`a[href="/features/${ids.plano}"]`).innerText()).slice(1).map(Number);
  };

  // Antes: no Dashboard (precisa de você, atrasadas, pauta), no quadro, na Feature e no contador
  await go(page, "/");
  assert.ok((await currentStateLinks(page, href)) > 0, "a task aparece no Dashboard");
  await go(page, "/tasks");
  assert.ok((await currentStateLinks(page, href)) > 0);
  const [, totalBefore] = await planoCounter();

  await go(page, `/tasks/${taskId}/edit`);
  const archive = await openReasonAction(page, { label: "Arquivar esta task", reason: null, confirm: "Arquivar task" });
  await dropBrowserValidation(page);
  await expectRefused(page, db, { trigger: () => archive.confirm.click(), message: reason("arquivar a task"), scope: archive.details });
  await archive.details.locator("textarea").fill("Substituições entram na próxima versão");
  await clickAndWait(page, archive.confirm);
  await waitForPath(page, new RegExp(`^/features/${ids.plano}$`));

  const task = await row(db, "Task", taskId);
  assert.ok(task, "a linha continua no banco");
  assert.ok(task.archivedAt);
  assert.equal(task.archivedById, ids.people.Heitor);
  assert.equal(task.archiveReason, "Substituições entram na próxima versão");

  // Some do estado atual
  assert.equal(await currentStateLinks(page, href), 0, "fora da lista de tasks da Feature");
  const archivedTasks = page.locator("[data-archived-list]", { has: page.locator("summary", { hasText: "Tasks arquivadas" }) });
  await archivedTasks.locator("summary").click();
  assert.match(await archivedTasks.innerText(), /Substituições entram na próxima versão/, "na lista de arquivadas, com o motivo");
  await go(page, "/");
  assert.equal(await currentStateLinks(page, href), 0, "fora do Dashboard e da pauta");
  await go(page, "/tasks");
  assert.equal(await currentStateLinks(page, href), 0, "fora do quadro de tasks");
  const [, totalAfter] = await planoCounter();
  assert.equal(totalAfter, totalBefore - 1, "fora do contador da Feature");

  // Fica no histórico e na origem, com página própria somente leitura
  await go(page, href);
  assert.match(await page.locator("[data-archived-banner]").innerText(), /Task arquivada[\s\S]*Substituições entram na próxima versão/);
  assert.equal(await page.locator('button[title^="Mover para"]').count(), 0, "somente leitura");
  assert.equal(await page.locator(`a[href="${href}/edit"]`).count(), 0);
  for (const path of [`/features/${ids.plano}`, `/decisions/${ids.decisionP0}`, `/meetings/${ids.meetingPast}`]) {
    await go(page, path);
    const text = await mainText(page);
    assert.match(text, new RegExp(`Task "${escapeRegExp(title)}" arquivada`), `histórico de ${path}`);
    assert.match(text, /Motivo: Substituições entram na próxima versão/);
  }
  await go(page, `/decisions/${ids.decisionP0}`);
  assert.equal(await archivedEntries(page, href), 1, "na origem, marcada como arquivada");

  // Requisito e critério
  const req = await db.one(`select id, description from "Requirement" where "featureId" = $1 and "archivedAt" is null order by "createdAt" limit 1`, [ids.plano]);
  await go(page, `/features/${ids.plano}`);
  let action = await openReasonAction(page, { root: page.locator(`[data-requirement="${req.id}"]`), label: "Arquivar", reason: null, confirm: "Arquivar requisito" });
  await dropBrowserValidation(page);
  await expectRefused(page, db, { trigger: () => action.confirm.click(), message: reason("arquivar o requisito"), scope: action.details });
  await action.details.locator("textarea").fill("Coberto por outro requisito");
  await clickAndWait(page, action.confirm);
  assert.ok((await row(db, "Requirement", req.id)).archivedAt);
  await go(page, `/features/${ids.plano}`);
  assert.equal(await page.locator(`[data-requirement="${req.id}"]`).count(), 0, "fora da lista de requisitos");
  assert.match(await mainText(page), new RegExp(`Requisito "${escapeRegExp(req.description)}" arquivado`));

  const crit = await db.one(`select id, description from "AcceptanceCriteria" where "featureId" = $1 and "archivedAt" is null order by "createdAt" limit 1`, [ids.plano]);
  action = await openReasonAction(page, { root: page.locator(`[data-criteria="${crit.id}"]`), label: "Arquivar", reason: "Critério reescrito em outro", confirm: "Arquivar critério" });
  await clickAndWait(page, action.confirm);
  assert.ok((await row(db, "AcceptanceCriteria", crit.id)).archivedAt);
  await go(page, `/features/${ids.plano}`);
  assert.equal(await page.locator(`[data-criteria="${crit.id}"]`).count(), 0, "fora da lista de critérios");
  assert.match(await mainText(page), new RegExp(`Critério de aceite "${escapeRegExp(crit.description)}" arquivado`));
  fx.archivedCriteria = crit;
});

ca("CA-21 — decisão cuja única task foi arquivada continua mostrando que gerou trabalho", async ({ db, heitor, ids }) => {
  const page = heitor.page;
  const decisionId = await createDecision(page, {
    title: "Adesão calculada por refeição registrada",
    text: "A adesão ao plano é calculada a partir das refeições que o paciente registra.",
    affects: `feature:${ids.plano}`,
    meetingId: ids.meetingPast,
  });
  const taskId = await createTask(page, { decisionId, title: "Definir a regra de adesão por refeição" });
  await go(page, `/tasks/${taskId}/edit`);
  const archive = await openReasonAction(page, { label: "Arquivar esta task", reason: "Coberta pela task de cálculo semanal", confirm: "Arquivar task" });
  await clickAndWait(page, archive.confirm);

  await go(page, `/decisions/${decisionId}`);
  assert.equal(await archivedEntries(page, `/tasks/${taskId}`), 1, "a decisão lista a task como arquivada");
  assert.match(await page.locator("[data-decision-state]").innerText(), /ela já gerou trabalho/);
  const created = page.locator("[data-activity-feed] a", { hasText: /criada a partir da decisão/ }).first();
  await created.click();
  await waitForPath(page, new RegExp(`^/tasks/${taskId}$`));
  assert.ok(await page.locator("[data-archived-banner]").isVisible(), "o evento de criação continua navegável");

  await go(page, "/");
  assert.equal(await page.locator(`main a[href="/tasks/new?decisionId=${decisionId}"]`).count(), 0, "não aparece como decisão sem task");
  assert.ok(await db.count("Decision", "id = $1", [decisionId]));
});

ca("CA-22 — restaurar exige motivo e gera evento", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;

  await go(page, `/tasks/${fx.archivedTask}`);
  const restore = await openReasonAction(page, { root: page.locator("[data-archived-banner]"), label: "Restaurar esta task", reason: null, confirm: "Restaurar task" });
  await dropBrowserValidation(page);
  await expectRefused(page, db, { trigger: () => restore.confirm.click(), message: reason("restaurar a task"), scope: restore.details });
  await restore.details.locator("textarea").fill("Substituições voltaram para esta versão");
  let seq = await db.maxSeq();
  await clickAndWait(page, restore.confirm);
  const task = await row(db, "Task", fx.archivedTask);
  assert.deepEqual([task.archivedAt, task.archivedById, task.archiveReason], [null, null, null]);
  let [e] = await eventsAfter(db, seq);
  assert.equal(e.eventType, "task.restored");
  assert.equal(e.reason, "Substituições voltaram para esta versão");
  await go(page, `/tasks/${fx.archivedTask}`);
  assert.equal(await page.locator("[data-archived-banner]").count(), 0);
  assert.ok((await page.locator('button[title^="Mover para"]').count()) > 0, "volta a ter status editável");

  // Requisito arquivado no CA-01 e critério arquivado no CA-19
  for (const [listLabel, item, confirm, table, eventType] of [
    ["Requisitos arquivados", fx.archivedRequirement, "Restaurar requisito", "Requirement", "requirement.restored"],
    ["Critérios arquivados", fx.archivedCriteria, "Restaurar critério", "AcceptanceCriteria", "criteria.restored"],
  ]) {
    await go(page, `/features/${ids.plano}`);
    await page.locator("[data-archived-list] > summary", { hasText: listLabel }).click();
    const action = await openReasonAction(page, {
      root: page.locator("[data-archived-list] li", { hasText: item.description }),
      label: "Restaurar",
      reason: "Voltou para o escopo",
      confirm,
    });
    seq = await db.maxSeq();
    await clickAndWait(page, action.confirm);
    assert.equal((await row(db, table, item.id)).archivedAt, null);
    [e] = await eventsAfter(db, seq);
    assert.deepEqual([e.eventType, e.reason], [eventType, "Voltou para o escopo"]);
  }
});

// =====================================================================================================
// Histórico completo por agregado
// =====================================================================================================

ca("CA-23 — o histórico da Feature reúne tudo com escopo nela e é paginado, sem limite fixo", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  await go(page, `/features/${fx.F}`);
  const text = (await historyItems(page)).join("\n");
  for (const expected of [
    'Feature "Relatório de adesão ao plano" criada',
    'Requisito adicionado à Feature "Relatório de adesão ao plano"',
    'Critério de aceite adicionado à Feature "Relatório de adesão ao plano"',
    'Decisão registrada: "Relatório de adesão entra no MVP do Nutria"',
    'Task "Calcular a adesão semanal" criada',
    'Task "Exportar o relatório em PDF" arquivada',
    "Tentativa de aprovar a Feature",
    'Validação da Feature "Relatório de adesão ao plano" (tentativa 2) aprovada',
  ]) {
    assert.ok(text.includes(expected), `histórico da Feature inclui: ${expected}`);
  }

  // Paginação: gera eventos na Feature do seed até passar de uma página
  const visible = () => db.count("ActivityLog", `"featureId" = $1 and "eventType" not like '%.baseline'`, [ids.plano]);
  const req = await db.one(`select id from "Requirement" where "featureId" = $1 and "archivedAt" is null order by "createdAt" limit 1`, [ids.plano]);
  let priority = "P1";
  while ((await visible()) <= HISTORY_PAGE_SIZE + 2) {
    await go(page, `/features/${ids.plano}`);
    const box = page.locator(`[data-requirement="${req.id}"]`);
    await box.locator('select[name="priority"]').selectOption(priority);
    await clickAndWait(page, button(page, "Salvar", box));
    priority = priority === "P1" ? "P2" : "P1";
  }
  const total = await visible();
  await go(page, `/features/${ids.plano}`);
  assert.equal((await historyItems(page)).length, HISTORY_PAGE_SIZE, "primeira página");
  await page.getByRole("link", { name: "Mostrar eventos mais antigos" }).click();
  await page.waitForFunction(() => new URLSearchParams(location.search).has("historico"));
  await page.waitForLoadState("networkidle");
  assert.equal((await historyItems(page)).length, Math.min(total, 2 * HISTORY_PAGE_SIZE), "página seguinte");
});

ca("CA-24 — os históricos da decisão, da reunião e do Product seguem a mesma regra por escopo", async ({ heitor, ids }) => {
  const page = heitor.page;
  // Histórico inteiro (?historico=…): a paginação é conferida no fim.
  const expectIn = async (path, expected) => {
    await go(page, `${path}${path.includes("?") ? "&" : "?"}historico=2000`);
    const text = await mainText(page);
    for (const e of expected) assert.ok(text.includes(e), `${path} inclui: ${e}`);
  };
  await expectIn(`/decisions/${ids.decisionMacros}`, [
    'Task "Validar a fórmula de macros com a nutricionista" alterada — Responsável',
    "substituída por",
  ]);
  await expectIn(`/meetings/${ids.meetingPast}`, [
    'Decisão registrada: "Adesão calculada por refeição registrada"',
    'Task "Definir a regra de adesão por refeição" arquivada',
    "Reunião HMP — Planejamento Nutria\" alterada",
  ]);
  await expectIn(`/products/${ids.product.Nutria}?tab=activity`, [
    'Feature "Relatório de adesão ao plano" criada',
    'Task "Montar a lista de substituições" restaurada',
    'Decisão registrada: "Adesão calculada por refeição registrada"',
    "Validação da Feature",
  ]);
  await go(page, `/products/${ids.product.Nutria}?tab=activity`);
  assert.equal((await historyItems(page, "main")).length, HISTORY_PAGE_SIZE, "Product também paginado");
  assert.equal(await page.getByRole("link", { name: "Mostrar eventos mais antigos" }).count(), 1);
});

// =====================================================================================================
// Relações, imutabilidade e reconstrução
// =====================================================================================================

ca("CA-27 — a task criada de uma decisão guarda a decisão e a reunião daquele momento", async ({ db, heitor, ids, fx }) => {
  const page = heitor.page;
  const meeting = await row(db, "Meeting", ids.meetingPast);
  fx.d27 = await createDecision(page, {
    title: "Relatório de adesão exporta CSV",
    text: "O relatório de adesão exporta um CSV para a clínica.",
    affects: `feature:${ids.plano}`,
    meetingId: ids.meetingPast,
  });
  fx.t27 = await createTask(page, { decisionId: fx.d27, title: "Exportar a adesão em CSV" });
  const [created] = await db.events(`l."entityId" = $1 and l."eventType" = 'task.created'`, [fx.t27]);
  const expected = {
    feature: { id: ids.plano, title: "Elaboração do Plano Alimentar" },
    decision: { id: fx.d27, title: "Relatório de adesão exporta CSV", decision: "O relatório de adesão exporta um CSV para a clínica." },
    meeting: { id: ids.meetingPast, title: meeting.title, date: meeting.date.toISOString() },
  };
  assert.deepEqual(created.context.origin, expected);

  // Mudanças posteriores (permitidas) na decisão e na reunião não alteram esse contexto.
  await go(page, `/decisions/${fx.d27}/edit`);
  await page.fill('input[name="title"]', "Relatório de adesão exporta CSV e PDF");
  await page.fill('textarea[name="changeReason"]', "O PDF também foi pedido");
  await clickAndWait(page, button(page, "Corrigir título"));
  await waitForPath(page, new RegExp(`^/decisions/${fx.d27}$`));
  await go(page, `/meetings/${ids.meetingPast}/edit`);
  await page.fill('input[name="title"]', "Reunião HMP — Planejamento do Nutria");
  await clickAndWait(page, button(page, "Salvar alterações"));
  await waitForPath(page, new RegExp(`^/meetings/${ids.meetingPast}$`));
  const [again] = await db.events("l.id = $1", [created.id]);
  assert.deepEqual(again.context.origin, expected);
});

ca("CA-20 · CA-26 — o banco recusa apagar entidades e alterar ou apagar o histórico", async ({ db }) => {
  const forbidden = /não é permitido — o histórico é preservado/;
  const anyId = async (table) => (await db.one(`select id from "${table}" limit 1`))?.id;
  for (const table of HISTORY_TABLES) {
    const id = await anyId(table);
    assert.ok(id, `${table} tem registros`);
    await assert.rejects(db.q(`update "${table}" set id = id where id = $1`, [id]), forbidden, `UPDATE em ${table}`);
    await assert.rejects(db.q(`delete from "${table}" where id = $1`, [id]), forbidden, `DELETE em ${table}`);
    assert.equal(await db.count(table, "id = $1", [id]), 1);
  }
  for (const table of DOMAIN_TABLES) {
    const id = await anyId(table);
    if (!id) continue;
    await assert.rejects(db.q(`delete from "${table}" where id = $1`, [id]), forbidden, `DELETE em ${table}`);
    assert.equal(await db.count(table, "id = $1", [id]), 1);
  }
});

ca("DV-15 — reconstructAt devolve o estado de uma entidade em qualquer momento do histórico", async ({ db, ids, fx }) => {
  const events = await db.events(`l."entityType" = 'task' and l."entityId" = $1`, [fx.t06]);
  const created = events.find((e) => e.eventType === "task.created");
  const assigned = events.find((e) => e.changes.some((c) => c.field === "assigneeId"));
  const prioritized = events.find((e) => e.changes.some((c) => c.field === "priority"));
  const [beforeCreation, atCreation, afterAssign, afterPriority] = reconstructAt("task", fx.t06, [
    new Date(created.createdAt.getTime() - 1),
    created.createdAt,
    assigned.createdAt,
    prioritized.createdAt,
  ]);
  assert.equal(beforeCreation, null, "antes de existir");
  assert.deepEqual([atCreation.assigneeId, atCreation.assigneeName, atCreation.priority], [ids.people.Pedro, "Pedro", "P2"]);
  assert.deepEqual([afterAssign.assigneeId, afterAssign.assigneeName, afterAssign.priority], [ids.people.Linard, "Linard", "P2"]);
  assert.equal(afterPriority.priority, "P1");
  const current = await row(db, "Task", fx.t06);
  assert.deepEqual(
    [afterPriority.title, afterPriority.status, afterPriority.priority, afterPriority.assigneeId],
    [current.title, current.status, current.priority, current.assigneeId],
    "o último estado reconstruído é o estado atual",
  );

  // Decisão do seed: parte do baseline e aplica a correção de título do CA-15.
  const decisionEvents = await db.events(`l."entityType" = 'decision' and l."entityId" = $1`, [ids.decisionP0]);
  const correction = decisionEvents.find((e) => e.eventType === "decision.updated");
  const [beforeFix, afterFix] = reconstructAt("decision", ids.decisionP0, [
    new Date(correction.createdAt.getTime() - 1),
    correction.createdAt,
  ]);
  assert.equal(beforeFix.title, "Planejamento Alimentar será tratado como Feature P0 do Nutria");
  assert.equal(afterFix.title, fx.p0NewTitle);
});

ca("R20 — todo evento registrado pelo app tem autor, rótulo, correlação e os escopos do seu tipo", async ({ db }) => {
  const required = {
    feature: ["featureId", "productId"],
    requirement: ["featureId", "productId"],
    criteria: ["featureId", "productId"],
    validation: ["featureId", "productId"],
    decision: ["decisionId"],
    meeting: ["meetingId"],
    task: [],
  };
  const events = await db.events(`l.source = 'app'`);
  assert.ok(events.length > 50);
  for (const e of events) {
    assert.equal(e.schemaVersion, 2, e.description);
    assert.ok(e.actorId && e.actorName, `sem autor: ${e.description}`);
    assert.ok(e.entityLabel, `sem rótulo: ${e.description}`);
    assert.ok(e.correlationId, `sem correlação: ${e.description}`);
    assert.ok(required[e.entityType], `tipo inesperado: ${e.entityType}`);
    for (const scope of required[e.entityType]) assert.ok(e[scope], `${e.description}: falta o escopo ${scope}`);
    if (e.entityType === "task") assert.ok(e.featureId || e.decisionId, `${e.description}: task sem escopo de origem`);
    const own = { feature: "featureId", decision: "decisionId", meeting: "meetingId" }[e.entityType];
    if (own) assert.equal(e[own], e.entityId, `${e.description}: escopo da própria entidade`);
  }
});

// =====================================================================================================
// CA-29 — regressões da V0.2
// =====================================================================================================

ca("CA-29 — regressões da V0.2: rotas, histórico navegável, fluxo Meeting → Decision → Task, gates, erros e Dashboard", async ({ db, heitor, linard, pedro, ids, fx }) => {
  const page = heitor.page;
  const cookie = `${ACTOR_COOKIE}=${ids.people.Heitor}`;
  const status = async (path) => (await fetch(BASE_URL + path, { headers: { cookie } })).status;

  // Rotas: estáticas e todas as páginas de cada entidade
  const routes = ["/", "/activity", "/artifacts", "/decisions", "/decisions/new", "/features", "/features/new", "/meetings", "/meetings/new", "/products", "/releases", "/settings", "/tasks", "/tasks/new", "/validations"];
  const ids_ = async (table) => (await db.q(`select id from "${table}"`)).map((r) => r.id);
  for (const id of await ids_("Feature")) routes.push(`/features/${id}`, `/features/${id}/edit`);
  for (const id of await ids_("Task")) routes.push(`/tasks/${id}`, `/tasks/${id}/edit`);
  for (const id of await ids_("Decision")) routes.push(`/decisions/${id}`, `/decisions/${id}/edit`, `/tasks/new?decisionId=${id}`);
  for (const id of await ids_("Meeting")) routes.push(`/meetings/${id}`, `/meetings/${id}/edit`, `/decisions/new?meetingId=${id}`);
  for (const id of await ids_("Product")) routes.push(`/products/${id}`, `/products/${id}?tab=activity`);
  for (const id of await ids_("Artifact")) routes.push(`/artifacts/${id}`);
  for (const r of routes) assert.equal(await status(r), 200, r);
  assert.equal(await status("/tasks/nao-existe"), 404);

  // Todo link do histórico global abre
  await go(page, "/activity?historico=2000");
  const links = [...new Set(await page.locator("main ol > li a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))))];
  assert.ok(links.length > 20);
  for (const href of links) assert.equal(await status(href.split("#")[0]), 200, `link do histórico: ${href}`);

  // Rastreabilidade Meeting → Decision → Task → Feature → Product
  await go(page, `/tasks/${fx.t27}`);
  for (const href of [`/decisions/${fx.d27}`, `/meetings/${ids.meetingPast}`, `/features/${ids.plano}`]) {
    assert.ok((await page.locator(`main a[href="${href}"]`).count()) > 0, `task → ${href}`);
  }
  await go(page, `/decisions/${fx.d27}`);
  for (const href of [`/tasks/${fx.t27}`, `/meetings/${ids.meetingPast}`, `/features/${ids.plano}`]) {
    assert.ok((await page.locator(`main a[href="${href}"]`).count()) > 0, `decisão → ${href}`);
  }
  await go(page, `/meetings/${ids.meetingPast}`);
  assert.ok((await page.locator(`main a[href="/decisions/${fx.d27}"]`).count()) > 0, "reunião → decisão");
  await go(page, `/features/${ids.plano}`);
  for (const href of [`/products/${ids.product.Nutria}`, `/decisions/${fx.d27}`, `/tasks/${fx.t27}`]) {
    assert.ok((await page.locator(`main a[href="${href}"]`).count()) > 0, `Feature → ${href}`);
  }

  // Gates: Validation só a partir de Review; Done só pela validação
  const gated = await createFeature(page, { title: "Plano para gestantes", productId: ids.product.Nutria });
  assert.equal(await page.locator("button", { hasText: /^Validation$/ }).getAttribute("title"), 'Só é possível entrar em "Validation" a partir de "Review".');
  assert.equal(await page.locator("button", { hasText: /^Done$/ }).getAttribute("title"), 'Só se chega aqui aprovando a Feature em "Validation".');
  await moveTo(page, "Review");
  const stale = await heitor.newPage();
  await go(stale, `/features/${gated}`);
  await moveTo(page, "Development", "Voltou para ajustes de escopo");
  await expectRefused(stale, db, { trigger: () => stale.locator('button[title="Mover para Validation"]').click(), message: MSG.validationNeedsReview });
  await stale.close();

  // Erros de formulário na própria tela
  await go(page, "/meetings/new");
  await page.fill('input[name="title"]', "   ");
  await page.fill('input[name="date"]', `${isoDate(3)}T10:00`);
  await expectRefused(page, db, { trigger: () => button(page, "Registrar reunião").click(), message: "Informe o título da reunião." });
  await go(page, `/tasks/new?featureId=${ids.plano}`);
  await page.fill('input[name="title"]', "   ");
  await expectRefused(page, db, { trigger: () => button(page, "Criar Task").click(), message: "Informe o título da task." });

  // Dashboard para cada papel
  for (const [name, session] of [["Heitor", heitor], ["Linard", linard], ["Pedro", pedro]]) {
    await go(session.page, "/");
    const text = await mainText(session.page);
    assert.match(text, new RegExp(`Precisa de você — ${name}`));
    assert.match(text, /Atenção do time/);
    assert.match(text, /Próxima reunião/);
  }
});
