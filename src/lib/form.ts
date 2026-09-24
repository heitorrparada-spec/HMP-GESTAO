/**
 * Texto vindo de formulário: sem espaços nas pontas e com quebras de linha em "\n". O navegador envia as
 * quebras de <textarea> como "\r\n" — sem normalizar, salvar sem mudar nada pareceria uma alteração.
 */
export function cleanText(raw: FormDataEntryValue | null | undefined): string {
  return String(raw ?? "").replace(/\r\n?/g, "\n").trim();
}

export function formText(formData: FormData, name: string): string {
  return cleanText(formData.get(name));
}
