-- V0.3-A — History & Auditability (docs/hmp-os/spec-v0.3-a-history-auditability.md)
-- Aditiva e sem apagar dados. Ordem: DDL → FKs RESTRICT (DV-20) → enriquecimento único dos eventos
-- antigos (DV-21) → baseline de todas as entidades → triggers de imutabilidade (DV-19).

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'REVOKED');

-- DropForeignKey
ALTER TABLE "Artifact" DROP CONSTRAINT "Artifact_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Artifact" DROP CONSTRAINT "Artifact_decisionId_fkey";

-- DropForeignKey
ALTER TABLE "Artifact" DROP CONSTRAINT "Artifact_featureId_fkey";

-- DropForeignKey
ALTER TABLE "Artifact" DROP CONSTRAINT "Artifact_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "Decision" DROP CONSTRAINT "Decision_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Decision" DROP CONSTRAINT "Decision_featureId_fkey";

-- DropForeignKey
ALTER TABLE "Decision" DROP CONSTRAINT "Decision_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "Decision" DROP CONSTRAINT "Decision_productId_fkey";

-- DropForeignKey
ALTER TABLE "Feature" DROP CONSTRAINT "Feature_architectId_fkey";

-- DropForeignKey
ALTER TABLE "Feature" DROP CONSTRAINT "Feature_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Feature" DROP CONSTRAINT "Feature_releaseId_fkey";

-- DropForeignKey
ALTER TABLE "Feature" DROP CONSTRAINT "Feature_techLeadId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_decisionId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_featureId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_parentTaskId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_reviewerId_fkey";

-- DropForeignKey
ALTER TABLE "ValidationRecord" DROP CONSTRAINT "ValidationRecord_validatedById_fkey";

-- AlterTable
ALTER TABLE "AcceptanceCriteria" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT;

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "context" JSONB,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "decisionId" TEXT,
ADD COLUMN     "entityLabel" TEXT,
ADD COLUMN     "featureId" TEXT,
ADD COLUMN     "meetingId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "schemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "seq" BIGINT,
ADD COLUMN     "snapshot" JSONB,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'legacy';

-- Eventos antigos: "legacy" (texto original, sem detalhe); os novos nascem "app".
ALTER TABLE "ActivityLog" ALTER COLUMN "source" SET DEFAULT 'app';

-- seq = ordem total dos eventos. Os antigos são numerados em ordem cronológica (BIGSERIAL numeraria pela ordem física).
CREATE SEQUENCE "ActivityLog_seq_seq" AS BIGINT OWNED BY "ActivityLog"."seq";
UPDATE "ActivityLog" AS a SET "seq" = o.rn
FROM (SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS rn FROM "ActivityLog") AS o
WHERE o.id = a.id;
SELECT setval('"ActivityLog_seq_seq"', COALESCE((SELECT MAX("seq") FROM "ActivityLog"), 0) + 1, false);
ALTER TABLE "ActivityLog" ALTER COLUMN "seq" SET DEFAULT nextval('"ActivityLog_seq_seq"'),
                          ALTER COLUMN "seq" SET NOT NULL;

-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "revokeReason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedById" TEXT,
ADD COLUMN     "status" "DecisionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "supersedesId" TEXT;

-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT;

-- AlterTable
ALTER TABLE "ValidationRecord" ADD COLUMN     "featureSnapshot" JSONB,
ADD COLUMN     "requestedResult" "ValidationResult",
ADD COLUMN     "requirementsSnapshot" JSONB,
ADD COLUMN     "tasksSnapshot" JSONB,
ADD COLUMN     "validatedByName" TEXT;

-- CreateTable
CREATE TABLE "ActivityChange" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "fromValue" JSONB,
    "toValue" JSONB,
    "fromLabel" TEXT,
    "toLabel" TEXT,

    CONSTRAINT "ActivityChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityChange_eventId_idx" ON "ActivityChange"("eventId");

-- CreateIndex
CREATE INDEX "ActivityChange_field_idx" ON "ActivityChange"("field");

-- CreateIndex
CREATE INDEX "AcceptanceCriteria_featureId_archivedAt_idx" ON "AcceptanceCriteria"("featureId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLog_seq_key" ON "ActivityLog"("seq");

-- CreateIndex
CREATE INDEX "ActivityLog_featureId_seq_idx" ON "ActivityLog"("featureId", "seq");

-- CreateIndex
CREATE INDEX "ActivityLog_decisionId_seq_idx" ON "ActivityLog"("decisionId", "seq");

-- CreateIndex
CREATE INDEX "ActivityLog_meetingId_seq_idx" ON "ActivityLog"("meetingId", "seq");

-- CreateIndex
CREATE INDEX "ActivityLog_productId_seq_idx" ON "ActivityLog"("productId", "seq");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_seq_idx" ON "ActivityLog"("actorId", "seq");

-- CreateIndex
CREATE INDEX "ActivityLog_correlationId_idx" ON "ActivityLog"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_supersedesId_key" ON "Decision"("supersedesId");

-- CreateIndex
CREATE INDEX "Requirement_featureId_archivedAt_idx" ON "Requirement"("featureId", "archivedAt");

-- CreateIndex
CREATE INDEX "Task_featureId_archivedAt_idx" ON "Task"("featureId", "archivedAt");

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_techLeadId_fkey" FOREIGN KEY ("techLeadId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Decision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceCriteria" ADD CONSTRAINT "AcceptanceCriteria_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRecord" ADD CONSTRAINT "ValidationRecord_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityChange" ADD CONSTRAINT "ActivityChange_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ActivityLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =====================================================================================
-- Enriquecimento único dos eventos antigos (DV-21): só metadados de indexação.
-- Texto, autor e data NÃO mudam. Feito antes de ativar a imutabilidade.
-- =====================================================================================

-- Tipos/redações que o produto nunca emitiu: narrativa do seed (demonstração).
UPDATE "ActivityLog" SET "source" = 'seed'
WHERE "eventType" IN ('artifact.linked', 'feature.field_changed', 'requirement.added')
   OR ("entityType" = 'feature' AND "eventType" = 'task.created')
   OR ("eventType" = 'task.created' AND "description" ~ '^[0-9]+ tasks criadas')
   OR ("eventType" = 'task.status_changed'
       AND ("description" ~ '^Task ".*" concluída$' OR "description" ~ '^Task ".*" foi bloqueada: '));

-- Escopos: em quais históricos o evento aparece.
UPDATE "ActivityLog" AS a SET "featureId" = f.id, "productId" = f."productId", "entityLabel" = f.title
FROM "Feature" AS f WHERE a."entityType" = 'feature' AND a."entityId" = f.id;

-- Legado: eventos de requisito/critério/validação guardavam a Feature como entityId — o rótulo é o da Feature.
UPDATE "ActivityLog" AS a SET "featureId" = f.id, "productId" = f."productId", "entityLabel" = f.title
FROM "Feature" AS f WHERE a."entityType" IN ('requirement', 'validation') AND a."entityId" = f.id;

UPDATE "ActivityLog" AS a
SET "featureId" = t."featureId", "decisionId" = t."decisionId",
    "meetingId" = COALESCE(t."meetingId", d."meetingId"),
    "productId" = COALESCE(f."productId", d."productId"),
    "entityLabel" = t.title
FROM "Task" AS t
LEFT JOIN "Feature" AS f ON f.id = t."featureId"
LEFT JOIN "Decision" AS d ON d.id = t."decisionId"
WHERE a."entityType" = 'task' AND a."entityId" = t.id;

-- Tasks já excluídas fisicamente (antes da V0.3-A): o título só existe no texto do evento.
UPDATE "ActivityLog" AS a
SET "entityLabel" = substring(a."description" from '^Task "(.*)" (?:criada|mudou de|foi editada|foi bloqueada|concluída|excluída)')
WHERE a."entityType" = 'task' AND a."entityLabel" IS NULL;

UPDATE "ActivityLog" AS a
SET "decisionId" = d.id, "featureId" = d."featureId", "meetingId" = d."meetingId", "productId" = d."productId",
    "entityLabel" = d.title
FROM "Decision" AS d WHERE a."entityType" = 'decision' AND a."entityId" = d.id;

UPDATE "ActivityLog" AS a SET "meetingId" = m.id, "entityLabel" = m.title
FROM "Meeting" AS m WHERE a."entityType" = 'meeting' AND a."entityId" = m.id;

UPDATE "ActivityLog" AS a
SET "featureId" = ar."featureId", "meetingId" = ar."meetingId", "decisionId" = ar."decisionId",
    "productId" = f."productId", "entityLabel" = ar.title
FROM "Artifact" AS ar LEFT JOIN "Feature" AS f ON f.id = ar."featureId"
WHERE a."entityType" = 'artifact' AND a."entityId" = ar.id;

UPDATE "ActivityLog" AS a SET "productId" = p.id, "entityLabel" = p.name
FROM "Product" AS p WHERE a."entityType" = 'product' AND a."entityId" = p.id;

-- Seed da V0.1 guardava a Feature como entityId também em eventos de artifact/task (links corrigidos na V0.2).
UPDATE "ActivityLog" AS a SET "featureId" = f.id, "productId" = f."productId", "entityLabel" = COALESCE(a."entityLabel", f.title)
FROM "Feature" AS f WHERE a."featureId" IS NULL AND a."entityId" = f.id;

-- Eventos de tasks já excluídas ficam sem escopo: a relação com a Feature se perdeu junto com a task
-- (limitação da V0.2, spec seção 10). Continuam no histórico geral, com o título tirado do texto.

-- Tentativas de validação existentes: nome do validador no momento.
UPDATE "ValidationRecord" AS v SET "validatedByName" = p.name
FROM "Person" AS p WHERE v."validatedById" = p.id;

-- =====================================================================================
-- Baseline: estado de cada entidade no momento da migração. É a âncora da reconstrução
-- ("a partir daqui, histórico completo"). Eventos *.baseline não aparecem nos feeds.
-- =====================================================================================

INSERT INTO "ActivityLog" ("id", "entityType", "entityId", "eventType", "description", "schemaVersion", "source",
                           "entityLabel", "snapshot", "featureId", "productId")
SELECT gen_random_uuid()::text, 'feature', f.id, 'feature.baseline',
       'Estado da Feature "' || f.title || '" no início do histórico completo (V0.3-A)', 2, 'migration', f.title,
       to_jsonb(f.*) || jsonb_build_object('ownerName', o.name, 'architectName', ar.name, 'techLeadName', tl.name),
       f.id, f."productId"
FROM "Feature" AS f
LEFT JOIN "Person" AS o ON o.id = f."ownerId"
LEFT JOIN "Person" AS ar ON ar.id = f."architectId"
LEFT JOIN "Person" AS tl ON tl.id = f."techLeadId";

INSERT INTO "ActivityLog" ("id", "entityType", "entityId", "eventType", "description", "schemaVersion", "source",
                           "entityLabel", "snapshot", "featureId", "productId")
SELECT gen_random_uuid()::text, 'requirement', r.id, 'requirement.baseline',
       'Estado do requisito no início do histórico completo (V0.3-A)', 2, 'migration', r.description,
       to_jsonb(r.*), r."featureId", f."productId"
FROM "Requirement" AS r JOIN "Feature" AS f ON f.id = r."featureId";

INSERT INTO "ActivityLog" ("id", "entityType", "entityId", "eventType", "description", "schemaVersion", "source",
                           "entityLabel", "snapshot", "featureId", "productId")
SELECT gen_random_uuid()::text, 'criteria', c.id, 'criteria.baseline',
       'Estado do critério de aceite no início do histórico completo (V0.3-A)', 2, 'migration', c.description,
       to_jsonb(c.*), c."featureId", f."productId"
FROM "AcceptanceCriteria" AS c JOIN "Feature" AS f ON f.id = c."featureId";

INSERT INTO "ActivityLog" ("id", "entityType", "entityId", "eventType", "description", "schemaVersion", "source",
                           "entityLabel", "snapshot", "featureId", "decisionId", "meetingId", "productId")
SELECT gen_random_uuid()::text, 'task', t.id, 'task.baseline',
       'Estado da task "' || t.title || '" no início do histórico completo (V0.3-A)', 2, 'migration', t.title,
       to_jsonb(t.*) || jsonb_build_object(
         'dueDate', to_char(t."dueDate", 'YYYY-MM-DD'),
         'assigneeName', p.name,
         'dependsOnId', dep.id,
         'dependsOnTitle', dep.title),
       t."featureId", t."decisionId", COALESCE(t."meetingId", d."meetingId"), COALESCE(f."productId", d."productId")
FROM "Task" AS t
LEFT JOIN "Person" AS p ON p.id = t."assigneeId"
LEFT JOIN "Feature" AS f ON f.id = t."featureId"
LEFT JOIN "Decision" AS d ON d.id = t."decisionId"
LEFT JOIN LATERAL (SELECT dt.id, dt.title FROM "TaskDependency" AS td JOIN "Task" AS dt ON dt.id = td."dependsOnId"
                   WHERE td."taskId" = t.id ORDER BY td.id LIMIT 1) AS dep ON true;

INSERT INTO "ActivityLog" ("id", "entityType", "entityId", "eventType", "description", "schemaVersion", "source",
                           "entityLabel", "snapshot", "featureId", "decisionId", "meetingId", "productId")
SELECT gen_random_uuid()::text, 'decision', d.id, 'decision.baseline',
       'Estado da decisão "' || d.title || '" no início do histórico completo (V0.3-A)', 2, 'migration', d.title,
       to_jsonb(d.*) || jsonb_build_object(
         'decidedAt', to_char(d."decidedAt", 'YYYY-MM-DD'),
         'authorName', au.name,
         'meetingTitle', mt.title,
         'affects', CASE WHEN d."featureId" IS NOT NULL THEN 'feature:' || d."featureId"
                         WHEN d."productId" IS NOT NULL THEN 'product:' || d."productId" END,
         'affectsLabel', CASE WHEN af.id IS NOT NULL THEN 'Feature "' || af.title || '"'
                              WHEN ap.id IS NOT NULL THEN 'Product "' || ap.name || '"' END,
         'participants', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', pp.id, 'name', pp.name) ORDER BY pp.id)
                                   FROM "DecisionParticipant" AS dp JOIN "Person" AS pp ON pp.id = dp."personId"
                                   WHERE dp."decisionId" = d.id), '[]'::jsonb)),
       d."featureId", d.id, d."meetingId", d."productId"
FROM "Decision" AS d
LEFT JOIN "Person" AS au ON au.id = d."authorId"
LEFT JOIN "Meeting" AS mt ON mt.id = d."meetingId"
LEFT JOIN "Feature" AS af ON af.id = d."featureId"
LEFT JOIN "Product" AS ap ON ap.id = d."productId";

INSERT INTO "ActivityLog" ("id", "entityType", "entityId", "eventType", "description", "schemaVersion", "source",
                           "entityLabel", "snapshot", "meetingId")
SELECT gen_random_uuid()::text, 'meeting', m.id, 'meeting.baseline',
       'Estado da reunião "' || m.title || '" no início do histórico completo (V0.3-A)', 2, 'migration', m.title,
       to_jsonb(m.*) || jsonb_build_object(
         'date', to_char(m.date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
         'participants', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', pp.id, 'name', pp.name) ORDER BY pp.id)
                                   FROM "MeetingParticipant" AS mp JOIN "Person" AS pp ON pp.id = mp."personId"
                                   WHERE mp."meetingId" = m.id), '[]'::jsonb)),
       m.id
FROM "Meeting" AS m;

INSERT INTO "ActivityLog" ("id", "entityType", "entityId", "eventType", "description", "schemaVersion", "source",
                           "entityLabel", "snapshot")
SELECT gen_random_uuid()::text, 'person', p.id, 'person.baseline',
       'Estado de "' || p.name || '" no início do histórico completo (V0.3-A)', 2, 'migration', p.name, to_jsonb(p.*)
FROM "Person" AS p;

INSERT INTO "ActivityLog" ("id", "entityType", "entityId", "eventType", "description", "schemaVersion", "source",
                           "entityLabel", "snapshot", "productId")
SELECT gen_random_uuid()::text, 'product', p.id, 'product.baseline',
       'Estado do Product "' || p.name || '" no início do histórico completo (V0.3-A)', 2, 'migration', p.name,
       to_jsonb(p.*), p.id
FROM "Product" AS p;

-- =====================================================================================
-- Imutabilidade no banco (DV-19). Triggers por linha não disparam em TRUNCATE, que fica
-- reservado ao reset de desenvolvimento/demonstração.
-- =====================================================================================

CREATE OR REPLACE FUNCTION hmp_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'HMP OS: % em "%" não é permitido — o histórico é preservado (V0.3-A)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

-- Histórico: somente inserção.
CREATE TRIGGER "ActivityLog_append_only" BEFORE UPDATE OR DELETE ON "ActivityLog"
  FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "ActivityChange_append_only" BEFORE UPDATE OR DELETE ON "ActivityChange"
  FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "ValidationRecord_append_only" BEFORE UPDATE OR DELETE ON "ValidationRecord"
  FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();

-- Domínio: sem exclusão física ("excluir" virou arquivar).
CREATE TRIGGER "Feature_no_delete" BEFORE DELETE ON "Feature" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "Requirement_no_delete" BEFORE DELETE ON "Requirement" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "AcceptanceCriteria_no_delete" BEFORE DELETE ON "AcceptanceCriteria" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "Task_no_delete" BEFORE DELETE ON "Task" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "Decision_no_delete" BEFORE DELETE ON "Decision" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "Meeting_no_delete" BEFORE DELETE ON "Meeting" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "Person_no_delete" BEFORE DELETE ON "Person" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "Product_no_delete" BEFORE DELETE ON "Product" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "Company_no_delete" BEFORE DELETE ON "Company" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "Release_no_delete" BEFORE DELETE ON "Release" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
CREATE TRIGGER "Artifact_no_delete" BEFORE DELETE ON "Artifact" FOR EACH ROW EXECUTE FUNCTION hmp_forbid_mutation();
