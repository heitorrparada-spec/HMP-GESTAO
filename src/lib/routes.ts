import type { EntityType } from "@/lib/activity";

/**
 * Convenção: para tipos sem página de detalhe própria (ex.: validation),
 * o entityId registrado no ActivityLog já aponta para a entidade "clicável"
 * mais próxima (a Feature), não para o id literal do registro.
 */
export function entityHref(type: EntityType | string, id: string): string | null {
  switch (type) {
    case "product":
      return `/products/${id}`;
    case "release":
      return `/releases`;
    case "feature":
      return `/features/${id}`;
    case "requirement":
      return `/features/${id}`;
    case "task":
      return `/tasks/${id}`;
    case "meeting":
      return `/meetings/${id}`;
    case "decision":
      return `/decisions/${id}`;
    case "artifact":
      return `/artifacts/${id}`;
    case "validation":
      return `/features/${id}`;
    case "criteria":
    case "person":
      return null;
    default:
      return null;
  }
}
