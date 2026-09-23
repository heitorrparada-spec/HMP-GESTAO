import type { FeatureStatus } from "@/generated/prisma/client";

/** O que ainda falta para a Feature concluir — a mesma leitura na página da Feature e no Dashboard. */
export function NextStepHint({
  feature,
}: {
  feature: {
    status: FeatureStatus;
    tasks: Array<{ status: string }>;
    acceptanceCriteria: Array<{ status: string }>;
  };
}) {
  const openTasks = feature.tasks.filter((t) => t.status !== "DONE").length;
  const blockedTasks = feature.tasks.filter((t) => t.status === "BLOCKED").length;
  const pendingCriteria = feature.acceptanceCriteria.filter((c) => c.status !== "PASSED").length;

  const pendencies: string[] = [];
  if (blockedTasks > 0) {
    pendencies.push(`${blockedTasks} task${blockedTasks !== 1 ? "s" : ""} bloqueada${blockedTasks !== 1 ? "s" : ""}`);
  }
  if (openTasks > 0) {
    pendencies.push(`${openTasks} task${openTasks !== 1 ? "s" : ""} aberta${openTasks !== 1 ? "s" : ""}`);
  }
  if (feature.acceptanceCriteria.length === 0) {
    pendencies.push("nenhum critério de aceite cadastrado");
  } else if (pendingCriteria > 0) {
    pendencies.push(`${pendingCriteria}/${feature.acceptanceCriteria.length} critérios de aceite ainda não passaram`);
  }
  const pendencyText = pendencies.length > 0 ? pendencies.join(" · ") : null;

  if (feature.status === "VALIDATION") {
    return (
      <p className="mt-2 text-xs font-medium text-rose-700">
        Aguardando validação — registre o resultado na seção Validation.
        {pendencyText && <span className="font-normal"> Pendências: {pendencyText}.</span>}
      </p>
    );
  }
  if (feature.status === "REVIEW") {
    return (
      <p className="mt-2 text-xs font-medium text-orange-700">
        Em revisão — próximo passo: Validation.
        {pendencyText && <span className="font-normal"> Pendências: {pendencyText}.</span>}
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-ink-faint">
      {pendencyText ? `Pendências para concluir: ${pendencyText}.` : "Sem pendências conhecidas para concluir."}
    </p>
  );
}
