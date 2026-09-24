// Apoio da suíte de aceite da V0.3-A (docs/hmp-os/spec-v0.3-a-history-auditability.md, seção 11).
// Os testes usam a UI de verdade (Playwright) e conferem o resultado no banco (pg).
import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";

export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");

export const ACTOR_COOKIE = "hmpos_actor";
export const HISTORY_PAGE_SIZE = 30;
export const ACTOR_REQUIRED =
  'Selecione quem você é em "Selecionar usuário" (canto inferior esquerdo) antes de registrar alterações — o histórico precisa saber quem fez.';

// ---------------------------------------------------------------- ambiente

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida — use o mesmo banco do servidor em BASE_URL (ver README).");
  return url;
}

/** A suíte reseta o banco (seed com TRUNCATE) e escreve nele: só roda em banco local, salvo liberação explícita. */
export function assertDisposableDatabase() {
  const host = new URL(databaseUrl()).hostname;
  if (!LOCAL_HOSTS.has(host) && process.env.HMP_ACCEPTANCE_ALLOW_REMOTE !== "1") {
    throw new Error(
      `Recusado: DATABASE_URL aponta para "${host}". A suíte de aceite apaga e recria os dados (seed). ` +
        "Use um banco local ou uma branch descartável do Neon com HMP_ACCEPTANCE_ALLOW_REMOTE=1 — nunca a produção.",
    );
  }
}

/** Mesmo caminho do `npm run db:seed`: TRUNCATE + dados de demonstração. */
export function resetToDemoSeed() {
  execFileSync(process.execPath, [TSX_CLI, "prisma/seed.ts"], { cwd: ROOT, env: process.env, stdio: "pipe" });
}

/** reconstructAt (src/lib/history/reconstruct.ts) roda em TypeScript: chamado por um script tsx. */
export function reconstructAt(entityType, entityId, moments) {
  const out = execFileSync(
    process.execPath,
    [TSX_CLI, "tests/acceptance/reconstruct-at.ts", entityType, entityId, ...moments.map((m) => new Date(m).toISOString())],
    { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(out.toString());
}

// ---------------------------------------------------------------- banco

// Tabelas de domínio: nenhuma linha some (V0.3-A). As de vínculo (participantes, dependência) são
// substituídas por inteiro na edição — o conjunto anterior fica na linha de mudança do evento.
export const DOMAIN_TABLES = [
  "Company",
  "Person",
  "Product",
  "Release",
  "Feature",
  "Requirement",
  "AcceptanceCriteria",
  "Task",
  "Meeting",
  "Decision",
  "Artifact",
];
export const HISTORY_TABLES = ["ActivityLog", "ActivityChange", "ValidationRecord"];
const LINK_TABLES = ["TaskDependency", "MeetingParticipant", "DecisionParticipant"];

// O Prisma grava DateTime como UTC em colunas sem fuso: lê do mesmo jeito (o padrão do pg é hora local).
pg.types.setTypeParser(1114, (value) => new Date(`${value.replace(" ", "T")}Z`));

export async function connectDatabase() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  const q = async (sql, params = []) => (await client.query(sql, params)).rows;
  const one = async (sql, params = []) => (await q(sql, params))[0];

  const fingerprintSql = [...DOMAIN_TABLES, ...HISTORY_TABLES, ...LINK_TABLES]
    .map((t) => `select '${t}' as t, md5(coalesce(string_agg(x::text, '|' order by x::text), '')) as h from "${t}" x`)
    .join(" union all ");

  return {
    client,
    q,
    one,
    close: () => client.end(),
    count: async (table, where = "true", params = []) =>
      (await one(`select count(*)::int as n from "${table}" where ${where}`, params)).n,
    /** Impressão digital de todo o conteúdo do banco: qualquer escrita, em qualquer tabela, muda o valor. */
    fingerprint: async () => (await q(fingerprintSql)).map((r) => `${r.t}:${r.h}`).join(","),
    counts: async (tables) => {
      const counts = {};
      for (const t of tables) counts[t] = (await one(`select count(*)::int as n from "${t}"`)).n;
      return counts;
    },
    maxSeq: async () => (await one(`select coalesce(max(seq), 0)::text as s from "ActivityLog"`)).s,
    /** Eventos com as linhas de mudança, em ordem de seq. */
    events: async (where = "true", params = []) =>
      q(
        `select l.*, l.seq::text as seq,
                coalesce(json_agg(c.* order by c.field) filter (where c.id is not null), '[]') as changes
           from "ActivityLog" l left join "ActivityChange" c on c."eventId" = l.id
          where ${where}
          group by l.id
          order by l.seq`,
        params,
      ),
  };
}

// ---------------------------------------------------------------- navegador

export async function launchBrowser() {
  // CHROMIUM_PATH: navegador já instalado (ex.: /opt/pw-browsers/chromium); sem ele, o do Playwright.
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
}

/** Sessão "atuando como" uma pessoa (cookie do seletor de usuário) — ou anônima, com personId nulo. */
export async function openSession(browser, personId) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if (personId) await context.addCookies([{ name: ACTOR_COOKIE, value: personId, url: BASE_URL }]);
  const pageErrors = [];
  const newPage = async () => {
    const page = await context.newPage();
    page.on("pageerror", (e) => pageErrors.push(e.message));
    return page;
  };
  return { context, pageErrors, newPage, page: await newPage(), close: () => context.close() };
}

export async function go(page, path) {
  const response = await page.goto(BASE_URL + path, { waitUntil: "networkidle", timeout: 90_000 });
  return response?.status() ?? 0;
}

export async function waitForPath(page, re) {
  await page.waitForFunction((src) => new RegExp(src).test(location.pathname), re.source, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
}

export function idFromUrl(page, segment) {
  const match = new RegExp(`/${segment}/([^/?#]+)`).exec(new URL(page.url()).pathname);
  assert.ok(match, `URL inesperada: ${page.url()}`);
  return match[1];
}

/** Dispara o envio de uma Server Action e espera a resposta — quando ela chega, a transação já terminou. */
export async function act(page, trigger) {
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await trigger();
  const status = (await response).status();
  await page.waitForTimeout(150);
  return status;
}

export async function clickAndWait(page, locator) {
  return act(page, () => locator.click());
}

export function button(page, name, root = page) {
  return root.getByRole("button", { name, exact: true });
}

/** Mensagem de erro esperado mostrada no formulário (role="alert"). */
export async function alertIn(scope, message, timeout = 15_000) {
  const alert = scope.locator('[role="alert"]', { hasText: message }).first();
  await alert.waitFor({ timeout });
  return (await alert.innerText()).trim();
}

/**
 * Recusa pelo backend: mensagem na própria tela, usuário na mesma página e o banco intacto — nem estado,
 * nem histórico (impressão digital de todas as tabelas).
 */
export async function expectRefused(page, db, { trigger, message, scope }) {
  const before = await db.fingerprint();
  const url = page.url();
  const status = await act(page, trigger);
  assert.equal(status, 200, "a recusa volta como resposta normal da action, não como erro do servidor");
  assert.equal(await alertIn(scope ?? page.locator("main"), message), message);
  assert.equal(page.url(), url, "o usuário continua na mesma página");
  assert.equal(await db.fingerprint(), before, "nada mudou no banco — nem estado, nem histórico");
}

/** Remove validações do navegador (required/max…) — simula um formulário adulterado ou um cliente sem JS. */
export async function dropBrowserValidation(page, selector = "form") {
  await page.evaluate((sel) => {
    for (const form of document.querySelectorAll(sel)) {
      form.noValidate = true;
      for (const el of form.querySelectorAll("[required],[min],[max]")) {
        el.removeAttribute("required");
        el.removeAttribute("min");
        el.removeAttribute("max");
      }
    }
  }, selector);
}

/** Acrescenta um campo escondido a um formulário (formulário adulterado). */
export async function injectField(page, formSelector, name, value) {
  await page.evaluate(
    ({ formSelector, name, value }) => {
      const form = document.querySelector(formSelector);
      if (!form) throw new Error(`form não encontrado: ${formSelector}`);
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    },
    { formSelector, name, value },
  );
}

export async function setCheckboxes(page, name, values) {
  for (const box of await page.locator(`input[type="checkbox"][name="${name}"]`).all()) {
    const want = values.includes(await box.getAttribute("value"));
    if ((await box.isChecked()) !== want) await box.setChecked(want);
  }
}

/** Texto do histórico (ActivityFeed) da seção indicada, um item por linha. */
export async function historyItems(page, container = "#historico") {
  return page.locator(`${container} ol > li`).allInnerTexts();
}

export function isoDate(daysFromToday = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------- fluxos da UI

export async function createFeature(page, { title, productId, priority, ownerId, problem }) {
  await go(page, "/features/new");
  await page.fill('input[name="title"]', title);
  await page.selectOption('select[name="productId"]', productId);
  if (priority) await page.selectOption('select[name="priority"]', priority);
  if (ownerId) await page.selectOption('select[name="ownerId"]', ownerId);
  if (problem) await page.fill('textarea[name="problem"]', problem);
  await clickAndWait(page, button(page, "Criar Feature"));
  await waitForPath(page, /^\/features\/(?!new)[^/]+$/);
  return idFromUrl(page, "features");
}

export async function createTask(page, { featureId, decisionId, title, assigneeId, priority, dueDate, description }) {
  await go(page, decisionId ? `/tasks/new?decisionId=${decisionId}` : `/tasks/new?featureId=${featureId}`);
  await page.fill('input[name="title"]', title);
  if (description) await page.fill('textarea[name="description"]', description);
  if (assigneeId) await page.selectOption('select[name="assigneeId"]', assigneeId);
  if (priority) await page.selectOption('select[name="priority"]', priority);
  if (dueDate) await page.fill('input[name="dueDate"]', dueDate);
  await clickAndWait(page, button(page, "Criar Task"));
  await waitForPath(page, /^\/tasks\/(?!new)[^/]+$/);
  return idFromUrl(page, "tasks");
}

export async function createMeeting(page, { title, date, participantIds = [], agenda, notes }) {
  await go(page, "/meetings/new");
  await page.fill('input[name="title"]', title);
  await page.fill('input[name="date"]', date);
  await setCheckboxes(page, "participantIds", participantIds);
  if (agenda) await page.fill('textarea[name="agenda"]', agenda);
  if (notes) await page.fill('textarea[name="notes"]', notes);
  await clickAndWait(page, button(page, "Registrar reunião"));
  await waitForPath(page, /^\/meetings\/(?!new)[^/]+$/);
  return idFromUrl(page, "meetings");
}

export async function createDecision(page, { title, text, affects, meetingId, participantIds, authorId, reason }) {
  await go(page, "/decisions/new");
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="decision"]', text);
  if (reason) await page.fill('textarea[name="reason"]', reason);
  if (authorId) await page.selectOption('select[name="authorId"]', authorId);
  if (meetingId) await page.selectOption('select[name="meetingId"]', meetingId);
  if (affects) await page.selectOption('select[name="affects"]', affects);
  if (participantIds) await setCheckboxes(page, "participantIds", participantIds);
  await clickAndWait(page, button(page, "Registrar decisão"));
  await waitForPath(page, /^\/decisions\/(?!new)[^/]+$/);
  return idFromUrl(page, "decisions");
}

/** Clica num estado do StatusTracker; se o passo pedir motivo, preenche o painel e confirma. */
export async function moveTo(page, label, reason) {
  const step = page.locator(`button[title="Mover para ${label}"]`);
  if (reason === undefined) return clickAndWait(page, step);
  await step.click();
  await page.locator('textarea[name="reason"]').fill(reason);
  return clickAndWait(page, button(page, `Confirmar: ${label}`));
}

export async function addRequirement(page, description) {
  const form = page.locator('form:has(input[placeholder="Descrição do novo requisito"])');
  await form.locator('input[name="description"]').fill(description);
  await clickAndWait(page, button(page, "+ Adicionar", form));
}

export async function addCriteria(page, description) {
  const form = page.locator('form:has(input[placeholder="Descrição do novo critério de aceite"])');
  await form.locator('input[name="description"]').fill(description);
  await clickAndWait(page, button(page, "+ Adicionar", form));
}

/**
 * Ação com motivo (ReasonAction): abre o <details> pelo texto exato do resumo e, se `reason` vier, preenche.
 * Devolve o <details> e o botão de confirmar (o envio fica com quem chama: sucesso ou recusa esperada).
 */
export async function openReasonAction(page, { root, label, reason, confirm }) {
  const scope = root ?? page.locator("main");
  const exact = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  const summary = scope.locator("summary").filter({ hasText: exact }).first();
  await summary.click();
  const details = summary.locator("xpath=..");
  if (reason) await details.locator("textarea").fill(reason);
  return { details, confirm: details.getByRole("button", { name: confirm, exact: true }) };
}
