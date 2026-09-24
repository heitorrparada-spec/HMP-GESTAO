// CA-28 — conferência de um banco migrado a partir da V0.2 (ensaio da DV-22).
// Somente leitura (a sessão do banco fica read-only e as páginas só são lidas): pode rodar contra uma branch
// do Neon criada a partir da produção, antes do deploy. Ver README ("Testes de aceite").

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { BASE_URL, connectDatabase } from "./support.mjs";

const MIGRATION = "20260924120000_history_auditability";
const ENTITIES = [
  ["Person", "person"],
  ["Product", "product"],
  ["Feature", "feature"],
  ["Requirement", "requirement"],
  ["AcceptanceCriteria", "criteria"],
  ["Task", "task"],
  ["Decision", "decision"],
  ["Meeting", "meeting"],
];
const APPEND_ONLY = ["ActivityLog", "ActivityChange", "ValidationRecord"];
const NO_DELETE = ["Feature", "Requirement", "AcceptanceCriteria", "Task", "Decision", "Meeting", "Person", "Product", "Company", "Release", "Artifact"];

let db;

before(async () => {
  db = await connectDatabase();
  await db.q("SET default_transaction_read_only = on");
});

after(async () => db?.close());

const page = async (path) => {
  const response = await fetch(BASE_URL + path);
  return { status: response.status, html: await response.text() };
};

test("a migration da V0.3-A está aplicada", async () => {
  const m = await db.one(`select finished_at, rolled_back_at from _prisma_migrations where migration_name = $1`, [MIGRATION]);
  assert.ok(m?.finished_at, `${MIGRATION} não aplicada`);
  assert.equal(m.rolled_back_at, null);
});

test("cada entidade existente tem um ponto de partida do histórico completo (baseline ou criação v2)", async () => {
  for (const [table, type] of ENTITIES) {
    const missing = await db.q(
      `select id from "${table}" t where not exists (
         select 1 from "ActivityLog" l
          where l."entityType" = $1 and l."entityId" = t.id and l."schemaVersion" = 2
            and l."eventType" in ($2, $3) and l.snapshot is not null)`,
      [type, `${type}.baseline`, `${type}.created`],
    );
    assert.deepEqual(missing, [], `${table} sem baseline`);
  }
});

test("eventos anteriores à V0.3 mantêm texto, autor e data, e só ganharam metadados", async () => {
  const legacy = await db.q(`select * from "ActivityLog" where "schemaVersion" = 1`);
  for (const e of legacy) {
    assert.ok(e.description, `evento ${e.id} sem texto`);
    assert.ok(["legacy", "seed"].includes(e.source), `evento ${e.id} com source ${e.source}`);
  }
  const unlabeled = await db.q(
    `select l.id, l.description from "ActivityLog" l
      where l."schemaVersion" = 1 and l."entityLabel" is null
        and exists (select 1 from "Task" t where t.id = l."entityId" union all select 1 from "Feature" f where f.id = l."entityId"
                    union all select 1 from "Decision" d where d.id = l."entityId" union all select 1 from "Meeting" m where m.id = l."entityId")`,
  );
  assert.deepEqual(unlabeled, [], "evento legado de entidade existente sem rótulo");
  // Sem escopo, só eventos de entidades que a V0.2 já tinha apagado (a relação se perdeu com elas — spec, seção 10).
  const unscoped = await db.q(
    `select l.id, l.description from "ActivityLog" l
      where l."schemaVersion" = 1
        and l."featureId" is null and l."decisionId" is null and l."meetingId" is null and l."productId" is null
        and exists (select 1 from "Task" t where t.id = l."entityId" union all select 1 from "Feature" f where f.id = l."entityId"
                    union all select 1 from "Decision" d where d.id = l."entityId" union all select 1 from "Meeting" m where m.id = l."entityId"
                    union all select 1 from "Product" p where p.id = l."entityId")`,
  );
  assert.deepEqual(unscoped, [], "evento legado de entidade existente sem escopo");
  const deletedTaskEvents = await db.q(
    `select id, description from "ActivityLog" l
      where l."schemaVersion" = 1 and l."entityType" = 'task' and l."entityLabel" is null
        and not exists (select 1 from "Task" t where t.id = l."entityId")`,
  );
  assert.deepEqual(deletedTaskEvents, [], "evento de task excluída sem o título extraído do texto");
});

test("imutabilidade instalada: histórico só acrescenta; entidades não são apagadas; FKs RESTRICT", async () => {
  const triggers = await db.q(
    `select c.relname as table, t.tgtype from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_proc p on p.oid = t.tgfoid where p.proname = 'hmp_forbid_mutation' and not t.tgisinternal`,
  );
  const tables = new Set(triggers.map((t) => t.table));
  for (const table of [...APPEND_ONLY, ...NO_DELETE]) assert.ok(tables.has(table), `trigger ausente em ${table}`);
  const setNull = await db.q(
    `select conrelid::regclass::text as table, conname from pg_constraint where contype = 'f' and confdeltype = 'n'`,
  );
  assert.deepEqual(setNull, [], "nenhuma FK com ON DELETE SET NULL");
});

test("dados da V0.2 continuam visíveis e navegáveis; histórico com selos de origem", async () => {
  const routes = ["/", "/activity", "/features", "/tasks", "/decisions", "/meetings", "/products", "/validations"];
  for (const [table, prefix] of [["Feature", "features"], ["Task", "tasks"], ["Decision", "decisions"], ["Meeting", "meetings"], ["Product", "products"]]) {
    for (const { id } of await db.q(`select id from "${table}"`)) routes.push(`/${prefix}/${id}`);
  }
  for (const r of routes) assert.equal((await page(r)).status, 200, r);

  const { html } = await page("/activity?historico=2000");
  const counts = await db.one(
    `select count(*) filter (where "schemaVersion" = 1 and source = 'legacy')::int as legacy,
            count(*) filter (where source = 'seed' and "eventType" not like '%.baseline')::int as seed
       from "ActivityLog"`,
  );
  if (counts.legacy > 0) assert.ok(html.includes("anterior à V0.3"), 'eventos antigos com o selo "anterior à V0.3"');
  if (counts.seed > 0) assert.ok(html.includes("demonstração"), 'eventos do seed com o selo "demonstração"');
  const links = [...new Set([...html.matchAll(/href="(\/(?:features|tasks|decisions|meetings|products|artifacts)\/[^"#?]+)/g)].map((m) => m[1]))];
  for (const href of links) assert.equal((await page(href)).status, 200, `link do histórico: ${href}`);
});

test("tentativas de validação anteriores à V0.3 aparecem com o aviso de legado", async () => {
  const old = await db.q(`select distinct "featureId" from "ValidationRecord" where "requirementsSnapshot" is null`);
  for (const { featureId } of old) {
    const { status, html } = await page(`/features/${featureId}`);
    assert.equal(status, 200);
    assert.ok(html.includes("Registrada antes da V0.3 — sem snapshot de requisitos e tasks."), `Feature ${featureId}`);
  }
});
