import clsx from "clsx";
import type { FeatureStatus } from "@/generated/prisma/client";

const stageOrder = ["SPECIFICATION", "ARCHITECTURE", "DEVELOPMENT", "VALIDATION"] as const satisfies readonly FeatureStatus[];
const stageLabels: Record<(typeof stageOrder)[number], string> = {
  SPECIFICATION: "Specification",
  ARCHITECTURE: "Architecture",
  DEVELOPMENT: "Development",
  VALIDATION: "Validation",
};

function stageIndex(status: FeatureStatus): number {
  if (status === "BACKLOG" || status === "DISCOVERY") return -1;
  if (status === "REVIEW") return stageOrder.indexOf("DEVELOPMENT");
  if (status === "DONE") return stageOrder.length;
  return stageOrder.indexOf(status);
}

export function FeatureStepper({ status }: { status: FeatureStatus }) {
  const current = stageIndex(status);

  return (
    <div className="flex items-center gap-1">
      {stageOrder.map((stage, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <div key={stage} className="flex items-center gap-1">
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                state === "current" && "bg-brand text-white",
                state === "done" && "bg-emerald-50 text-emerald-700",
                state === "upcoming" && "bg-slate-100 text-ink-faint",
              )}
            >
              {stageLabels[stage]}
            </span>
            {i < stageOrder.length - 1 && <span className="h-px w-3 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
