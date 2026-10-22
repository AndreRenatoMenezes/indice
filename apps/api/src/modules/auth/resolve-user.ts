// Orquestra a decisão de identidade com o banco: consulta, liga (atômico) ou
// cria o `User`. Usado pelo hook de auth (toda requisição JWT) e pelo login.
import { decideIdentity, type AuthClaims, type IdentityDenial } from "./identity.js";
import type { StoreUser, UserStore } from "./user-store.js";

export type ResolveResult = { user: StoreUser } | { error: IdentityDenial };

// O JWT do Neon Auth não tem claim de nome. O nome exibido nasce do e-mail;
// o usuário antigo mantém o `displayName` que já tinha.
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  return local ? local.slice(0, 80) : "Você";
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

export async function resolveOrLinkUser(store: UserStore, claims: AuthClaims, allowed: boolean): Promise<ResolveResult> {
  const email = claims.email.trim().toLowerCase();
  const normalized: AuthClaims = { ...claims, email };

  const byAuthId = await store.findByAuthId(normalized.sub);
  // Só procura por e-mail quando a ligação é possível: evita leitura inútil e
  // deixa claro que e-mail não verificado não herda conta.
  const byEmail =
    !byAuthId && normalized.emailVerified && allowed ? await store.findUnlinkedByEmail(normalized.email) : null;

  const decision = decideIdentity({ byAuthId, byEmail, claims: normalized, allowed });

  switch (decision.action) {
    case "deny":
      return { error: decision.error };

    case "use":
      if (!byAuthId) return { error: "not allowed" };
      return { user: byAuthId };

    case "link":
      if (!byEmail) return { error: "not allowed" };
      if (await store.link(normalized.sub, byEmail.id)) return { user: byEmail };
      // Corrida perdida: outra requisição ligou o mesmo `User` (ou outra conta
      // tomou o `sub`). Relê o vínculo; sem ele, nega.
      return reread(store, normalized.sub);

    case "create":
      try {
        return {
          user: await store.create({
            email: normalized.email,
            displayName: displayNameFromEmail(normalized.email),
            authUserId: normalized.sub,
          }),
        };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Corrida de criação (mesmo `sub` ou mesmo e-mail): vale o que gravou.
        return reread(store, normalized.sub);
      }
  }
}

async function reread(store: UserStore, authUserId: string): Promise<ResolveResult> {
  const existing = await store.findByAuthId(authUserId);
  return existing ? { user: existing } : { error: "not allowed" };
}
