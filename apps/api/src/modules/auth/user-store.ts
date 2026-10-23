// Interface e implementação Prisma do acesso a `User` no fluxo de auth.
// A interface existe para o teste de rota rodar sem banco (fake em memória).
import { prisma } from "@indice/db";

export type StoreUser = { id: string; email: string; displayName: string };

const select = { id: true, email: true, displayName: true } as const;

export interface UserStore {
  findByAuthId(authUserId: string): Promise<StoreUser | null>;
  findUnlinkedByEmail(email: string): Promise<StoreUser | null>;
  /** `true` se gravou; `false` quando outro login ligou o mesmo `User` antes. */
  link(authUserId: string, userId: string): Promise<boolean>;
  create(input: { email: string; displayName: string; authUserId: string }): Promise<StoreUser>;
  findById(id: string): Promise<StoreUser | null>;
}

export const prismaUserStore: UserStore = {
  findByAuthId: (authUserId) => prisma.user.findUnique({ where: { authUserId }, select }),

  // `User.email` é único, mas a comparação é sem caixa (plan.md, 003).
  findUnlinkedByEmail: (email) =>
    prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, authUserId: null }, select }),

  // Ligação atômica: o `WHERE authUserId IS NULL` evita sobrescrever um vínculo.
  link: async (authUserId, userId) => {
    const result = await prisma.user.updateMany({ where: { id: userId, authUserId: null }, data: { authUserId } });
    return result.count > 0;
  },

  // Usuário novo nasce vazio, só com `UserSettings` (spec 003).
  create: (input) => prisma.user.create({ data: { ...input, settings: { create: {} } }, select }),

  findById: (id) => prisma.user.findUnique({ where: { id }, select }),
};
