/**
 * Tipos de entidade que aparecem no histórico. A gravação passou para src/lib/history (V0.3-A):
 * todo evento é registrado pelo pipeline de comandos, na mesma transação da mudança de estado.
 */
export type EntityType =
  | "product"
  | "release"
  | "feature"
  | "requirement"
  | "criteria"
  | "task"
  | "meeting"
  | "decision"
  | "artifact"
  | "validation"
  | "person";
