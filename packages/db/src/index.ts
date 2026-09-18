import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __indicePrisma?: PrismaClient };

// Singleton: em dev o hot reload recriaria conexões; no Cloud Run o container
// vive por várias requisições e reaproveita o pool.
export const prisma: PrismaClient =
  globalForPrisma.__indicePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__indicePrisma = prisma;

export function createPrisma(url?: string): PrismaClient {
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
}
