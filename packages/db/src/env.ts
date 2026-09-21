// Carrega o `.env` da raiz do monorepo quando DATABASE_URL não veio do ambiente.
// Ninguém aqui lê esse arquivo sozinho: nem o cliente, nem a API (`tsx watch`),
// nem o seed — e nem a CLI do Prisma, que roda com o cwd em `packages/db` e
// procuraria um `.env` local. Por isso `prisma.config.ts` chama esta função.
// Em produção (Cloud Run) a variável já vem do ambiente e nada é lido.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function loadRootEnv(): void {
  if (process.env.DATABASE_URL) return;
  const here = fileURLToPath(new URL(".", import.meta.url));
  const candidates = [resolve(process.cwd(), ".env"), resolve(here, "../../../.env")];
  const found = candidates.find((p) => existsSync(p));
  if (found) process.loadEnvFile(found);
}
