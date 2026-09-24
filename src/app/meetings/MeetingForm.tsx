import { Card } from "@/components/ui/Card";
import { ActionForm, type FormAction } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { toDateTimeInputValue } from "@/lib/format";

export function MeetingForm({
  action,
  people,
  meeting,
  submitLabel,
  sensitive,
}: {
  action: FormAction;
  people: Array<{ id: string; name: string }>;
  meeting?: {
    title: string;
    date: Date;
    agenda: string | null;
    notes: string | null;
    participantIds: string[];
  };
  submitLabel: string;
  /** Reunião que já aconteceu (ou tem decisões): remarcar/mudar participantes pede motivo. */
  sensitive?: boolean;
}) {
  return (
    <Card>
      <ActionForm action={action} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="Título" required>
              <input
                name="title"
                required
                defaultValue={meeting?.title}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                placeholder='Ex.: "Reunião de Produto — Nutria"'
              />
            </Field>
          </div>
          <Field label="Data e hora" required>
            <input
              type="datetime-local"
              name="date"
              required
              defaultValue={toDateTimeInputValue(meeting?.date ?? new Date())}
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
                  defaultChecked={meeting?.participantIds.includes(p.id) ?? false}
                />
                {p.name}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Pauta">
          <textarea
            name="agenda"
            rows={3}
            defaultValue={meeting?.agenda ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="O que será discutido"
          />
        </Field>

        <Field label="Notas / conclusões">
          <textarea
            name="notes"
            rows={4}
            defaultValue={meeting?.notes ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="O que foi discutido e concluído — as decisões formais são registradas à parte"
          />
        </Field>

        {meeting && (
          <Field label={sensitive ? "Motivo da alteração (obrigatório para remarcar ou mudar participantes)" : "Motivo da alteração (opcional)"}>
            <textarea
              name="changeReason"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder={
                sensitive
                  ? "Esta reunião já aconteceu ou já tem decisões — a data e os participantes são registro; explique a correção"
                  : "Fica no histórico junto com a alteração"
              }
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
