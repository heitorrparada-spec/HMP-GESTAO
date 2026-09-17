import type {
  ArtifactType,
  CriteriaStatus,
  FeatureStatus,
  Priority,
  ProductStatus,
  ReleaseStatus,
  RequirementStatus,
  RoleName,
  TaskStatus,
  ValidationResult,
} from "@/generated/prisma/client";

export type Tone =
  | "gray"
  | "blue"
  | "violet"
  | "indigo"
  | "amber"
  | "orange"
  | "rose"
  | "red"
  | "green";

export const featureStatusMeta: Record<FeatureStatus, { label: string; tone: Tone }> = {
  BACKLOG: { label: "Backlog", tone: "gray" },
  DISCOVERY: { label: "Discovery", tone: "violet" },
  SPECIFICATION: { label: "Specification", tone: "blue" },
  ARCHITECTURE: { label: "Architecture", tone: "indigo" },
  DEVELOPMENT: { label: "Development", tone: "amber" },
  REVIEW: { label: "Review", tone: "orange" },
  VALIDATION: { label: "Validation", tone: "rose" },
  DONE: { label: "Done", tone: "green" },
};

export const featureStatusOrder: FeatureStatus[] = [
  "BACKLOG",
  "DISCOVERY",
  "SPECIFICATION",
  "ARCHITECTURE",
  "DEVELOPMENT",
  "REVIEW",
  "VALIDATION",
  "DONE",
];

export const taskStatusMeta: Record<TaskStatus, { label: string; tone: Tone }> = {
  TODO: { label: "To do", tone: "gray" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  BLOCKED: { label: "Blocked", tone: "red" },
  REVIEW: { label: "Review", tone: "amber" },
  DONE: { label: "Done", tone: "green" },
};

export const taskStatusOrder: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"];

export const priorityMeta: Record<Priority, { label: string; tone: Tone }> = {
  P0: { label: "P0 · Urgente", tone: "red" },
  P1: { label: "P1 · Alta", tone: "orange" },
  P2: { label: "P2 · Média", tone: "blue" },
  P3: { label: "P3 · Baixa", tone: "gray" },
};

export const productStatusMeta: Record<ProductStatus, { label: string; tone: Tone }> = {
  DISCOVERY: { label: "Discovery", tone: "violet" },
  DEVELOPMENT: { label: "Development", tone: "amber" },
  PAUSED: { label: "Paused", tone: "gray" },
  DISCONTINUED: { label: "Discontinued", tone: "red" },
};

export const releaseStatusMeta: Record<ReleaseStatus, { label: string; tone: Tone }> = {
  PLANNED: { label: "Planejado", tone: "gray" },
  IN_PROGRESS: { label: "Em andamento", tone: "amber" },
  SHIPPED: { label: "Lançado", tone: "green" },
};

export const artifactTypeMeta: Record<ArtifactType, { label: string; tone: Tone }> = {
  DOCUMENT: { label: "Document", tone: "gray" },
  C4: { label: "C4 Model", tone: "indigo" },
  CLASS_DIAGRAM: { label: "Class Diagram", tone: "indigo" },
  SEQUENCE_DIAGRAM: { label: "Sequence Diagram", tone: "indigo" },
  RESEARCH: { label: "Market Research", tone: "violet" },
  REFERENCE: { label: "Reference", tone: "blue" },
  SPECIFICATION: { label: "Specification", tone: "blue" },
};

export const roleMeta: Record<RoleName, { label: string; short: string; tone: Tone }> = {
  PRODUCT: { label: "Product / Business / Validation", short: "Product", tone: "blue" },
  ARCHITECTURE: { label: "Architecture / Systems", short: "Architecture", tone: "violet" },
  ENGINEERING: { label: "Engineering / Development", short: "Engineering", tone: "amber" },
};

export const validationResultMeta: Record<ValidationResult, { label: string; tone: Tone }> = {
  PENDING: { label: "Pendente", tone: "gray" },
  APPROVED: { label: "Aprovado", tone: "green" },
  REJECTED: { label: "Reprovado", tone: "red" },
};

export const criteriaStatusMeta: Record<CriteriaStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pendente", tone: "gray" },
  PASSED: { label: "Passou", tone: "green" },
  FAILED: { label: "Falhou", tone: "red" },
};

export const requirementStatusMeta: Record<RequirementStatus, { label: string; tone: Tone }> = {
  PROPOSED: { label: "Proposto", tone: "gray" },
  APPROVED: { label: "Aprovado", tone: "blue" },
  IMPLEMENTED: { label: "Implementado", tone: "amber" },
  TESTED: { label: "Testado", tone: "green" },
};
