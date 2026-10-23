// Lista de e-mails permitidos por ambiente (`INDICE_ALLOWED_EMAILS`, separada
// por vírgula). E-mail é dado pessoal: o valor vem de secret e nunca entra no
// repositório. A conferência é feita em toda requisição JWT.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAllowlist(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const allowed = new Set<string>();
  for (const part of raw.split(",")) {
    const email = normalizeEmail(part);
    if (email) allowed.add(email);
  }
  return [...allowed];
}

export function isAllowed(list: readonly string[], email: string | null | undefined): boolean {
  if (!email) return false;
  const needle = normalizeEmail(email);
  if (!needle) return false;
  return list.some((entry) => normalizeEmail(entry) === needle);
}
