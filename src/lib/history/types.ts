import type { ActivityChange, ActivityLog, Prisma } from "@/generated/prisma/client";

/** Client ou transação: todo comando grava estado e histórico na mesma transação. */
export type Db = Prisma.TransactionClient;

export type HistoryEntityType =
  | "feature"
  | "requirement"
  | "criteria"
  | "validation"
  | "task"
  | "decision"
  | "meeting"
  | "product"
  | "person"
  | "artifact"
  | "release";

/** Em quais históricos o evento aparece (agregados), gravado no momento do evento. */
export type Scopes = {
  featureId?: string | null;
  decisionId?: string | null;
  meetingId?: string | null;
  productId?: string | null;
};

export type ChangeValue = string | number | boolean | null | ChangeValue[] | { [key: string]: ChangeValue };

/** Uma linha de mudança: um campo, o valor anterior e o novo (com rótulos legíveis no momento). */
export type Change = {
  field: string;
  from: ChangeValue;
  to: ChangeValue;
  fromLabel?: string | null;
  toLabel?: string | null;
};

export type EventInput = {
  eventType: string;
  entityType: HistoryEntityType;
  entityId: string;
  entityLabel: string;
  scopes: Scopes;
  description: string;
  changes?: Change[];
  reason?: string | null;
  context?: Record<string, ChangeValue>;
  snapshot?: Record<string, ChangeValue>;
};

export type EventSource = "app" | "seed" | "migration";

export type HistoryEvent = ActivityLog & { changes: ActivityChange[] };

/** Pessoa em listas de participantes: o nome fica no evento, para o histórico não depender do cadastro atual. */
export type PersonRef = { id: string; name: string };
