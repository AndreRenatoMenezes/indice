// Config da CLI do Prisma. Existe por dois motivos: substitui a chave
// `package.json#prisma`, removida no Prisma 7, e carrega o `.env` da raiz do
// monorepo — a CLI roda com o cwd em `packages/db` e só procuraria um `.env`
// aqui, então `prisma migrate` não encontrava DATABASE_URL.
import { defineConfig } from "prisma/config";
import { loadRootEnv } from "./src/env.js";

loadRootEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx src/seed.ts",
  },
});
