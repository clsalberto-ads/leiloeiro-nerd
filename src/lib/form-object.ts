/** Converte `FormData` em um objeto plano para a validação do Zod (o FormData é adaptador de presentation, não schema de domínio). */
export function formToObject(formData: FormData): Record<string, string> {
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

