// Decisão pura de identidade: dado o que o JWT afirma e o que o banco tem,
// diz se o `User` do Índice já existe, se é para ligar ao usuário antigo de
// mesmo e-mail, se nasce um Índice vazio ou se o acesso é negado.
//
// Regras (spec 003):
// - vínculo é permanente: `User.authUserId` é único e nulo até o primeiro login;
// - ligação por e-mail só com e-mail verificado e fora de qualquer conta já ligada;
// - allowlist vale em toda requisição JWT, então também barra conta já ligada.
// Sem Prisma: quem chama faz as consultas e grava a ligação.
export type AuthClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
};

export type IdentityUser = { id: string };

export type IdentityDenial = "not allowed" | "email not verified";

export type IdentityDecision =
  | { action: "use"; id: string }
  | { action: "link"; id: string }
  | { action: "create" }
  | { action: "deny"; error: IdentityDenial };

export function decideIdentity(input: {
  byAuthId: IdentityUser | null;
  byEmail: IdentityUser | null;
  claims: AuthClaims;
  allowed: boolean;
}): IdentityDecision {
  // Conta sem e-mail verificado nunca chega a ter ou ganhar `User`.
  if (!input.claims.emailVerified) return { action: "deny", error: "email not verified" };

  if (input.byAuthId) {
    // Já ligada: a allowlist continua sendo conferida em cada requisição.
    return input.allowed ? { action: "use", id: input.byAuthId.id } : { action: "deny", error: "not allowed" };
  }

  if (!input.allowed) return { action: "deny", error: "not allowed" };

  // Primeiro login: herda o usuário antigo de mesmo e-mail, se ainda não ligado.
  if (input.byEmail) return { action: "link", id: input.byEmail.id };

  return { action: "create" };
}
