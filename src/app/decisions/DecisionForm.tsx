import { Card } from "@/components/ui/Card";
import { ActionForm, type FormAction } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { toDateInputValue } from "@/lib/format";

export type DecisionFormDefaults = {
  title: string;
  context: string | null;
  decision: string;
  reason: string | null;
  alternatives: string | null;
  authorId: string;
  decidedAt: Date;
  meetingId: string;
  affects: string;
  participantIds: string[];
};

export function DecisionForm({
  action,
  people,
  meetings,
  features,
  products,
  defaults,
  lockedAffectsLabel,
  submitLabel,
  supersede,
  changeReason,
}: {
  action: FormAction;
  people: Array<{ id: string; name: string }>;
  meetings: Array<{ id: string; title: string }>;
  features: Array<{ id: string; title: string; product: { name: string } }>;
  products: Array<{ id: string; name: string }>;
  defaults: DecisionFormDefaults;
  lockedAffectsLabel?: string;
  submitLabel: string;
  /** Nova decisão que substitui uma vigente (a anterior passa a "Substituída"). */
  supersede?: { id: string; title: string };
  /** Motivo opcional da correção, na janela de correção. */
  changeReason?: boolean;
}) {
  return (
    <Card>
      <ActionForm action={action} className="space-y-4">
        {supersede && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input type="hidden" name="supersedesId" value={supersede.id} />
            <p>
              Esta nova decisão vai <strong>substituir</strong> &ldquo;{supersede.title}&rdquo;, que continua visível como
              substituída, com as tasks que gerou.
            </p>
            <label className="mb-1 mt-2 block text-xs font-medium">
              Motivo da substituição <span className="text-red-500">*</span>
            </label>
            <textarea
              name="supersedeReason"
              required
              rows={2}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="O que mudou para a decisão anterior deixar de valer?"
            />
          </div>
        )}
        <Field label="Título" required>
          <input
            name="title"
            required
            defaultValue={defaults.title}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder='Ex.: "Plano Alimentar terá montagem por refeições"'
          />
        </Field>

        <Field label="Decisão" required>
          <textarea
            name="decision"
            required
            rows={2}
            defaultValue={defaults.decision}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="A escolha feita, em uma frase clara"
          />
        </Field>

        <Field label="Contexto">
          <textarea
            name="context"
            rows={2}
            defaultValue={defaults.context ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="Situação que motivou a decisão"
          />
        </Field>

        <Field label="Motivo / justificativa">
          <textarea
            name="reason"
            rows={2}
            defaultValue={defaults.reason ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Alternativas consideradas">
          <textarea
            name="alternatives"
            rows={2}
            defaultValue={defaults.alternatives ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Autor" required>
            <select
              name="authorId"
              required
              defaultValue={defaults.authorId}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecionar…
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data">
            <input
              type="date"
              name="decidedAt"
              max={toDateInputValue(new Date())}
              defaultValue={toDateInputValue(defaults.decidedAt)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Participantes">
          <div className="flex flex-wrap gap-3">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="participantIds"
                  value={p.id}
                  defaultChecked={defaults.participantIds.includes(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Reunião de origem">
            <select
              name="meetingId"
              defaultValue={defaults.meetingId}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">Nenhuma</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Afeta">
            {lockedAffectsLabel ? (
              <>
                <input type="hidden" name="affects" value={defaults.affects} />
                <p className="rounded-md border border-border bg-slate-50 px-3 py-2 text-sm text-ink">
                  {lockedAffectsLabel}
                </p>
                <p className="mt-1 text-xs text-ink-faint">Travado: esta decisão já gerou tasks.</p>
              </>
            ) : (
              <select
                name="affects"
                defaultValue={defaults.affects}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              >
                <option value="">Nenhum</option>
                <optgroup label="Feature (já implica o Product)">
                  {features.map((f) => (
                    <option key={f.id} value={`feature:${f.id}`}>
                      {f.product.name} — {f.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Product (sem Feature específica)">
                  {products.map((p) => (
                    <option key={p.id} value={`product:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </Field>
        </div>

        {changeReason && (
          <Field label="Motivo da correção (opcional)">
            <textarea
              name="changeReason"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="Ex.: erro de digitação, participante esquecido — fica no histórico junto com a versão anterior"
            />
          </Field>
        )}

        <div className="pt-2">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-faint">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
