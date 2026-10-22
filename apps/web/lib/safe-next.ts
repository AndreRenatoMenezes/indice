// Destino pós-login (`?next=`): só caminho interno do próprio Índice.
// Função pura, sem imports do Next, para o teste rodar sem request.
const ORIGIN = "http://indice.local";

/**
 * Resolve `next` como o navegador resolve e devolve só o caminho interno.
 * Qualquer tentativa de trocar a origem — `//host`, `/\host`, `%5C`, tabs ou
 * normalização que gere `//` — cai em `/`. `/entrar*` também cai em `/` para
 * não criar laço depois do login.
 */
export function safeNext(value: string): string {
  const raw = value.trim();
  if (!raw.startsWith("/")) return "/";
  // Barra invertida (crua ou percent-encoded) é separador em alguns parsers.
  if (raw.includes("\\") || /%5c/i.test(raw)) return "/";

  let url: URL;
  try {
    url = new URL(raw, ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== ORIGIN) return "/";
  if (url.pathname === "/entrar" || url.pathname.startsWith("/entrar/")) return "/";

  const target = `${url.pathname}${url.search}${url.hash}`;
  // A normalização de `/..//host` produz `//host`, que o navegador leria como
  // outro host mesmo com a origem acima intacta.
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return "/";
  return target;
}
