// Classifica a credencial que chegou na requisição. `X-Api-Key` é sempre chave;
// `Authorization: Bearer` com três segmentos base64url é JWT, e o resto continua
// sendo chave (compatibilidade com scripts e automações que já usam Bearer).
export type Credential = { kind: "jwt"; value: string } | { kind: "apiKey"; value: string };

export type CredentialHeaders = {
  "x-api-key"?: string | string[] | undefined;
  authorization?: string | string[] | undefined;
};

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function classifyCredential(headers: CredentialHeaders): Credential | null {
  const apiKey = first(headers["x-api-key"]);
  if (apiKey) return { kind: "apiKey", value: apiKey };

  const authorization = first(headers.authorization);
  if (!authorization) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  if (!match) return null;

  const value = match[1] ?? "";
  if (!value) return null;
  const segments = value.split(".");
  const looksLikeJwt = segments.length === 3 && segments.every((segment) => BASE64URL_SEGMENT.test(segment));
  return looksLikeJwt ? { kind: "jwt", value } : { kind: "apiKey", value };
}
