// Contexto de auth montado uma vez por processo e injetado no hook e nas rotas.
// Os testes trocam as peças sem rede e sem banco (`buildApp({ auth })`).
import { createRemoteJWKSet } from "jose";
import { authOrigin, config } from "../../config.js";
import {
  createNeonAuthClient,
  NEON_AUTH_PROTOCOL,
  type NeonAuthClient,
} from "../../lib/neon-auth-client.js";
import { parseAllowlist } from "./allowlist.js";
import { createJwtVerifier, type JwtVerifier } from "./jwt.js";
import { prismaUserStore, type UserStore } from "./user-store.js";

export interface AuthContext {
  /** `null` quando `NEON_AUTH_BASE_URL` não está configurada: `/auth/*` → 503. */
  neonAuth: NeonAuthClient | null;
  /** `null` desliga o caminho JWT (fora de produção sem Auth configurado). */
  verifier: JwtVerifier | null;
  store: UserStore;
  allowlist: string[];
  /** `AUTH_WEB_ORIGIN`, usado no `redirectTo` do reset de senha. */
  webOrigin: string | null;
}

export function createAuthContext(): AuthContext {
  const baseUrl = config.neonAuthBaseUrl;
  const webOrigin = config.authWebOrigin;
  const origin = webOrigin ?? (baseUrl ? authOrigin(baseUrl) : null);

  const neonAuth =
    baseUrl && origin ? createNeonAuthClient({ baseUrl, origin, timeoutMs: config.authTimeoutMs }) : null;

  // `createRemoteJWKSet` não faz rede na criação: o JWKS é buscado na primeira
  // verificação e fica em cache no `jose`.
  const verifier = baseUrl
    ? createJwtVerifier({
        keys: createRemoteJWKSet(new URL(`${baseUrl}${NEON_AUTH_PROTOCOL.jwksPath}`)),
        issuer: authOrigin(baseUrl),
        audience: authOrigin(baseUrl),
      })
    : null;

  return {
    neonAuth,
    verifier,
    store: prismaUserStore,
    allowlist: parseAllowlist(config.allowedEmailsRaw),
    webOrigin,
  };
}
