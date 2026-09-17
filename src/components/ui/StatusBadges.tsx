import { Badge } from "@/components/ui/Badge";
import {
  artifactTypeMeta,
  criteriaStatusMeta,
  featureStatusMeta,
  priorityMeta,
  productStatusMeta,
  releaseStatusMeta,
  requirementStatusMeta,
  roleMeta,
  taskStatusMeta,
  validationResultMeta,
} from "@/lib/labels";
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

export function FeatureStatusBadge({ status }: { status: FeatureStatus }) {
  const meta = featureStatusMeta[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = taskStatusMeta[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | null | undefined }) {
  if (!priority) return <Badge tone="gray">Sem prioridade</Badge>;
  const meta = priorityMeta[priority];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const meta = productStatusMeta[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function ReleaseStatusBadge({ status }: { status: ReleaseStatus }) {
  const meta = releaseStatusMeta[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ArtifactTypeBadge({ type }: { type: ArtifactType }) {
  const meta = artifactTypeMeta[type];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function RoleBadge({ role, short = false }: { role: RoleName; short?: boolean }) {
  const meta = roleMeta[role];
  return <Badge tone={meta.tone}>{short ? meta.short : meta.label}</Badge>;
}

export function ValidationResultBadge({ result }: { result: ValidationResult }) {
  const meta = validationResultMeta[result];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function CriteriaStatusBadge({ status }: { status: CriteriaStatus }) {
  const meta = criteriaStatusMeta[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  const meta = requirementStatusMeta[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
