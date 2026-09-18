// Seed do usuário único: cria o User, as categorias padrão (herdadas do
// app-financeiro), os hábitos fixos da rotina e a meta "Comprar nossa casinha".
// A chave de API vem de INDICE_API_KEY (ou é gerada e impressa uma vez).
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient, CategoryKind, HabitKind, GoalKind } from "@prisma/client";

const prisma = new PrismaClient();

const EXPENSE_CATEGORIES: Array<[string, string]> = [
  ["Contas Fixas", "#E85D75"], ["Lazer", "#9B51E0"], ["Mercado", "#00C28A"],
  ["Lanche", "#FDCB6E"], ["Assinaturas", "#0984E3"], ["Presente", "#E17055"],
  ["Cabelo", "#00CEC9"], ["Celular", "#636E72"], ["Doce", "#FD79A8"],
  ["Dívidas", "#D63031"], ["Outros", "#B2BEC3"],
];
const INCOME_CATEGORIES = ["Salário", "Mesada Avo", "Parcela Carro", "Parcela Casa", "Juliana", "Stone", "Outros"];
const INVEST_CATEGORIES = ["Caixinha", "FII", "Nubank", "Rico", "Inter", "Outros"];

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function main() {
  const email = process.env.INDICE_USER_EMAIL ?? "andre@indice.local";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      displayName: "Andre",
      settings: { create: {} },
    },
  });

  const today = new Date();
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  for (const [i, [name, color]] of EXPENSE_CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { userId_kind_name: { userId: user.id, kind: CategoryKind.EXPENSE, name } },
      update: {},
      create: { userId: user.id, kind: CategoryKind.EXPENSE, name, color, sortOrder: i },
    });
  }
  await prisma.category.upsert({
    where: { userId_kind_name: { userId: user.id, kind: CategoryKind.EXPENSE, name: "Encargos do Cartão" } },
    update: {},
    create: { userId: user.id, kind: CategoryKind.EXPENSE, name: "Encargos do Cartão", color: "#B33771", system: true, sortOrder: 99 },
  });
  for (const [i, name] of INCOME_CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { userId_kind_name: { userId: user.id, kind: CategoryKind.INCOME, name } },
      update: {},
      create: { userId: user.id, kind: CategoryKind.INCOME, name, sortOrder: i },
    });
  }
  for (const [i, name] of INVEST_CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { userId_kind_name: { userId: user.id, kind: CategoryKind.INVESTMENT, name } },
      update: {},
      create: { userId: user.id, kind: CategoryKind.INVESTMENT, name, sortOrder: i },
    });
  }

  const habits: Array<{ name: string; kind: HabitKind; targetTime?: string; targetValue?: number; unit?: string; weekdays?: number[]; icon: string }> = [
    { name: "Acordar às 5:30", kind: HabitKind.TIME, targetTime: "05:30", icon: "sunrise" },
    { name: "Corrida / Exercícios", kind: HabitKind.DURATION, targetValue: 30, unit: "min", icon: "run" },
    { name: "Estudo Faculdade", kind: HabitKind.DURATION, targetValue: 60, unit: "min", weekdays: [1, 2, 3, 4, 5], icon: "book" },
  ];
  for (const [i, h] of habits.entries()) {
    const existing = await prisma.habit.findFirst({ where: { userId: user.id, name: h.name, deletedAt: null } });
    if (!existing) {
      await prisma.habit.create({
        data: {
          userId: user.id, name: h.name, kind: h.kind, icon: h.icon, sortOrder: i, startDate,
          targetTime: h.targetTime, targetValue: h.targetValue, unit: h.unit,
          weekdays: h.weekdays ?? [1, 2, 3, 4, 5, 6, 7],
        },
      });
    }
  }

  const goalTitle = "Comprar nossa casinha";
  const goal = await prisma.goal.findFirst({ where: { userId: user.id, title: goalTitle, deletedAt: null } });
  if (!goal) {
    await prisma.goal.create({
      data: {
        userId: user.id, title: goalTitle, kind: GoalKind.FINANCIAL, targetValue: 0,
        startDate, targetDate: new Date("2035-08-05T00:00:00Z"), icon: "home", priority: 1,
        description: "Meta principal de longo prazo. Ajuste targetValue com o valor da entrada.",
      },
    });
  }

  const rawKey = process.env.INDICE_API_KEY ?? randomBytes(24).toString("base64url");
  await prisma.apiKey.upsert({
    where: { keyHash: hashApiKey(rawKey) },
    update: {},
    create: { userId: user.id, name: "primary", keyHash: hashApiKey(rawKey) },
  });
  if (!process.env.INDICE_API_KEY) {
    console.log(`\nChave de API gerada (guarde, não será exibida de novo):\n  ${rawKey}\n`);
  }
  console.log(`Seed concluído para ${email} (user ${user.id}).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
