// Verificação do JWT do Neon Auth. Chaves Ed25519 pelo JWKS; `iss`/`aud` são a
// origem da Auth URL — é o que separa QA de Produção, porque as chaves JWKS são
// copiadas no reset da branch (plan.md, 003).
import { jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AuthClaims } from "./identity.js";

export type VerifiedClaims = AuthClaims & { exp: number };

export type JwtVerifier = (token: string) => Promise<VerifiedClaims>;

export class InvalidTokenError extends Error {
  constructor() {
    super("invalid token");
    this.name = "InvalidTokenError";
  }
}

export function createJwtVerifier(options: { keys: JWTVerifyGetKey; issuer: string; audience: string }): JwtVerifier {
  return async (token) => {
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, options.keys, {
        algorithms: ["EdDSA"],
        issuer: options.issuer,
        audience: options.audience,
        requiredClaims: ["sub", "email", "exp"],
      }));
    } catch {
      // Assinatura, exp, iss, aud ou claim obrigatória ausente: tudo é 401.
      throw new InvalidTokenError();
    }

    if (typeof payload.sub !== "string" || !payload.sub) throw new InvalidTokenError();
    if (typeof payload.email !== "string" || !payload.email.trim()) throw new InvalidTokenError();
    if (typeof payload.exp !== "number") throw new InvalidTokenError();

    return {
      sub: payload.sub,
      email: payload.email,
      // Sem claim explícita `true`, a conta é tratada como não verificada.
      emailVerified: payload.emailVerified === true,
      exp: payload.exp,
    };
  };
}

export function expiresAtIso(exp: number): string {
  return new Date(exp * 1000).toISOString();
}
