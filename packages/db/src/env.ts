// Carrega o `.env` da raiz do monorepo quando DATABASE_URL não veio do ambiente.
// Só a CLI do Prisma lê `.env` sozinha; o cliente, a API (`tsx watch`) e o seed
// não leem. Em produção (Cloud Run) a variável já existe e nada é lido.
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
