/** Falha esperada de validação/negócio: a mensagem é mostrada ao usuário no próprio formulário. */
export class ActionError extends Error {}

export type ActionResult = { error: string } | void;

// Só ActionError vira retorno; redirect() e erros inesperados continuam propagando (error boundary + log).
export async function runAction(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    throw error;
  }
}
