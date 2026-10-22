import { describe, expect, it } from "vitest";
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
} from "jose";
import { createJwtVerifier, expiresAtIso, InvalidTokenError } from "./jwt.js";

const ISSUER = "https://auth.example.com";
const AUDIENCE = "https://auth.example.com";

const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const { privateKey: otherKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "EdDSA" };
const verifier = createJwtVerifier({ keys: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER, audience: AUDIENCE });

async function token(
  claims: Record<string, unknown> = { email: "andre@example.com", emailVerified: true },
  options: {
    sub?: string;
    issuer?: string;
    audience?: string;
    expiration?: string | number;
    key?: CryptoKey;
    alg?: string;
  } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: options.alg ?? "EdDSA" })
    .setSubject(options.sub ?? "auth-user-1")
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.expiration ?? "15m")
    .sign(options.key ?? privateKey);
}

describe("createJwtVerifier", () => {
  it("aceita JWT Ed25519 válido e devolve sub, e-mail, verificação e exp", async () => {
    const claims = await verifier(await token());

    expect(claims.sub).toBe("auth-user-1");
    expect(claims.email).toBe("andre@example.com");
    expect(claims.emailVerified).toBe(true);
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("trata `emailVerified` ausente como não verificado", async () => {
    const claims = await verifier(await token({ email: "andre@example.com" }));
    expect(claims.emailVerified).toBe(false);
  });

  it("rejeita assinatura de outra chave", async () => {
    const forged = await token(undefined, { key: otherKey });
    await expect(verifier(forged)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejeita token vencido", async () => {
    const expired = await token(undefined, { expiration: Math.floor(Date.now() / 1000) - 60 });
    await expect(verifier(expired)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejeita emissor de outro ambiente (QA x Produção)", async () => {
    const wrongIssuer = await token(undefined, { issuer: "https://auth-qa.example.com" });
    await expect(verifier(wrongIssuer)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejeita audiência de outro ambiente", async () => {
    const wrongAudience = await token(undefined, { audience: "https://auth-qa.example.com" });
    await expect(verifier(wrongAudience)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejeita JWT sem `email`", async () => {
    const noEmail = await new SignJWT({ emailVerified: true })
      .setProtectedHeader({ alg: "EdDSA" })
      .setSubject("auth-user-1")
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);
    await expect(verifier(noEmail)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejeita JWT sem `sub`", async () => {
    const noSub = await new SignJWT({ email: "andre@example.com", emailVerified: true })
      .setProtectedHeader({ alg: "EdDSA" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);
    await expect(verifier(noSub)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejeita algoritmo diferente de EdDSA", async () => {
    const hs = await new SignJWT({ email: "andre@example.com", emailVerified: true })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("auth-user-1")
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("segredo-segredo-segredo-segredo"));
    await expect(verifier(hs)).rejects.toBeInstanceOf(InvalidTokenError);
  });
});

describe("expiresAtIso", () => {
  it("converte exp (segundos) em ISO", () => {
    expect(expiresAtIso(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
  });
});
