import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type Prisma, type Transaction } from "@indice/db";
import { CreateTransactionInput, type AccountDto, type CategoryDto, type FinanceSummaryDto, type InstitutionDto, type InvoiceDto, type TransactionDto } from "@indice/shared";
import { parse, dec, decOrNull, dateOrNull } from "../lib/http.js";
import { addDays, daysBetween, fromISODate, monthRange, parts, todayISO } from "../lib/dates.js";
import { config } from "../config.js";
import { calcBalance, calcDailyBudget, calcCurrentDailyRate, computeAccountBalances, UNASSIGNED } from "../modules/finance/balance.js";
import { resolveCycle, effectiveInvoiceStatus } from "../modules/finance/invoice-cycle.js";
import { calcTrafficLight, daysToNextSalary } from "../modules/finance/traffic-light.js";

// Relações carregadas junto com o lançamento para os rótulos da listagem.
export const transactionInclude = {
  category: { select: { name: true } },
  account: { select: { name: true } },
  toAccount: { select: { name: true } },
  creditCard: { select: { nickname: true, last4: true } },
  invoice: { select: { refMonth: true, refYear: true } },
} satisfies Prisma.TransactionInclude;
type TransactionRow = Transaction & Partial<Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>>;

export function toTransactionDto(t: TransactionRow): TransactionDto {
  return {
    id: t.id, type: t.type, date: dateOrNull(t.date)!, amount: dec(t.amount), description: t.description,
    categoryId: t.categoryId, categoryName: t.category?.name ?? null, paymentMethod: t.paymentMethod, accountId: t.accountId,
    toAccountId: t.toAccountId, creditCardId: t.creditCardId, invoiceId: t.invoiceId, installmentNo: t.installmentNo, installmentTotal: t.installmentTotal,
    accountName: t.account?.name ?? null, toAccountName: t.toAccount?.name ?? null,
    creditCardLabel: t.creditCard ? `${t.creditCard.nickname} ····${t.creditCard.last4}` : null,
    invoiceRef: t.invoice ? `${String(t.invoice.refMonth).padStart(2, "0")}/${t.invoice.refYear}` : null,
  };
}

// Garante a fatura do ciclo (institution × refYear × refMonth) para uma compra no crédito.
async function ensureInvoiceForPurchase(userId: string, creditCardId: string, date: string) {
  const card = await prisma.creditCard.findFirst({ where: { id: creditCardId, userId }, include: { institution: true } });
  if (!card) return { error: "credit card not found" as const };
  const cycle = resolveCycle(date, card.institution);
  if (!cycle) return { invoice: null }; // instituição sem ciclo: comportamento antigo (caixa no mês da compra)
  const invoice = await prisma.cardInvoice.upsert({
    where: { institutionId_refYear_refMonth: { institutionId: card.institutionId, refYear: cycle.refYear, refMonth: cycle.refMonth } },
    update: {},
    create: { userId, institutionId: card.institutionId, refYear: cycle.refYear, refMonth: cycle.refMonth, closingDate: fromISODate(cycle.closingDate), dueDate: fromISODate(cycle.dueDate) },
  });
  return { invoice };
}

async function recalcInvoiceTotal(invoiceId: string) {
  const inv = await prisma.cardInvoice.findUnique({ where: { id: invoiceId } });
  if (!inv || inv.totalManual || inv.status === "PAID") return;
  const agg = await prisma.transaction.aggregate({ where: { invoiceId, deletedAt: null }, _sum: { amount: true } });
  await prisma.cardInvoice.update({ where: { id: invoiceId }, data: { total: agg._sum.amount ?? 0 } });
}

export async function financeSummary(userId: string, date: string): Promise<FinanceSummaryDto> {
  const { y, m, d } = parts(date);
  const range = monthRange(y, m);
  const [txs, bills, invoices, settings, history] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, deletedAt: null, date: { gte: fromISODate(range.start), lte: fromISODate(range.end) } } }),
    prisma.billOccurrence.findMany({ where: { year: y, month: m, bill: { userId, deletedAt: null } }, include: { bill: true } }),
    prisma.cardInvoice.findMany({ where: { userId, deletedAt: null, status: { not: "PAID" }, dueDate: { gte: fromISODate(date), lte: fromISODate(range.end) } }, include: { institution: true }, orderBy: { dueDate: "asc" } }),
    prisma.userSettings.findUnique({ where: { userId } }),
    // Média histórica: saídas de caixa dos 90 dias anteriores ao mês corrente.
    prisma.transaction.aggregate({ where: { userId, deletedAt: null, type: "EXPENSE", invoiceId: null, date: { gte: fromISODate(addDays(range.start, -90)), lt: fromISODate(range.start) } }, _sum: { amount: true } }),
  ]);

  const sum = (type: Transaction["type"], pred: (t: Transaction) => boolean = () => true) =>
    txs.filter((t) => t.type === type && pred(t)).reduce((s, t) => s + dec(t.amount), 0);
  // Compras em fatura não são caixa do mês; o pagamento da fatura é.
  const totalExpense = sum("EXPENSE", (t) => t.invoiceId == null);
  const totalIncome = sum("INCOME");
  const totalInvestment = sum("INVESTMENT");
  const openBills = bills.filter((b) => b.status === "PENDING").reduce((s, b) => s + dec(b.amount), 0);
  const balance = calcBalance({ totalIncome, totalExpense, totalInvestment, openBills });
  const daysRemaining = Math.max(0, daysBetween(date, range.end));
  const dailyBudget = calcDailyBudget(balance, daysRemaining);
  const spentToday = sum("EXPENSE", (t) => t.invoiceId == null && dateOrNull(t.date) === date);
  const spentSoFar = sum("EXPENSE", (t) => t.invoiceId == null && dateOrNull(t.date)! <= date);
  const histSum = dec(history._sum.amount);
  const histAvg = histSum > 0 ? histSum / 90 : calcCurrentDailyRate(spentSoFar, d);
  const trafficLight = calcTrafficLight(dailyBudget, histAvg, balance);
  const salary = settings?.salaryDay ? daysToNextSalary(settings.salaryDay, date) : null;

  return {
    month: { year: y, month: m },
    totalIncome, totalExpense, totalInvestment, openBills, balance, dailyBudget, daysRemaining, spentToday, trafficLight,
    daysToSalary: salary?.days ?? null,
    billsDueSoon: bills.filter((b) => b.status === "PENDING").map((b) => ({ id: b.id, name: b.bill.name, amount: dec(b.amount) || dec(b.bill.fixedValue) || dec(b.bill.avgValue), dueDay: b.bill.dueDay })).sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)),
    invoicesDueSoon: invoices.map((i) => ({ id: i.id, institution: i.institution.name, total: dec(i.total), dueDate: dateOrNull(i.dueDate)!, status: effectiveInvoiceStatus({ status: i.status, closingDate: dateOrNull(i.closingDate)! }, date) })),
  };
}

export async function financeRoutes(app: FastifyInstance) {
  app.get("/finance/summary", async (req, reply) => {
    const q = parse(z.object({ date: z.string().optional() }), req.query, reply);
    if (!q) return;
    return financeSummary(req.userId, q.date ?? todayISO(config.timezone));
  });

  app.get("/transactions", async (req, reply) => {
    const q = parse(z.object({ from: z.string().optional(), to: z.string().optional(), type: z.string().optional(), accountId: z.string().optional(), limit: z.coerce.number().int().max(1000).default(200) }), req.query, reply);
    if (!q) return;
    const where: Prisma.TransactionWhereInput = { userId: req.userId, deletedAt: null };
    if (q.from || q.to) where.date = { ...(q.from ? { gte: fromISODate(q.from) } : {}), ...(q.to ? { lte: fromISODate(q.to) } : {}) };
    if (q.type) where.type = q.type as Transaction["type"];
    if (q.accountId) where.OR = [{ accountId: q.accountId }, { toAccountId: q.accountId }];
    const rows = await prisma.transaction.findMany({ where, include: transactionInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: q.limit });
    return { transactions: rows.map(toTransactionDto) };
  });

  app.post("/transactions", async (req, reply) => {
    const body = parse(CreateTransactionInput, req.body, reply);
    if (!body) return;
    if (body.type === "TRANSFER" && (!body.accountId || !body.toAccountId || body.accountId === body.toAccountId)) {
      return reply.code(400).send({ error: "TRANSFER exige accountId e toAccountId distintos" });
    }
    if (body.paymentMethod === "CREDIT" && !body.creditCardId) {
      return reply.code(400).send({ error: "CREDIT exige creditCardId" });
    }
    let invoiceId: string | null = null;
    if (body.type === "EXPENSE" && body.creditCardId) {
      const r = await ensureInvoiceForPurchase(req.userId, body.creditCardId, body.date);
      if ("error" in r) return reply.code(404).send({ error: r.error });
      invoiceId = r.invoice?.id ?? null;
    }
    const created = await prisma.transaction.create({
      data: {
        id: body.id, userId: req.userId, type: body.type, date: fromISODate(body.date), amount: body.amount, description: body.description,
        categoryId: body.categoryId, paymentMethod: body.paymentMethod ?? (body.creditCardId ? "CREDIT" : undefined), accountId: body.accountId,
        toAccountId: body.toAccountId, creditCardId: body.creditCardId, invoiceId, notes: body.notes, source: body.source ?? "API",
      },
      include: transactionInclude,
    });
    if (invoiceId) await recalcInvoiceTotal(invoiceId);
    return reply.code(201).send(toTransactionDto(created));
  });

  app.delete("/transactions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const t = await prisma.transaction.findFirst({ where: { id, userId: req.userId, deletedAt: null } });
    if (!t) return reply.code(404).send({ error: "not found" });
    await prisma.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
    if (t.invoiceId) await recalcInvoiceTotal(t.invoiceId);
    return reply.code(204).send();
  });

  app.get("/accounts", async (req, reply) => {
    const q = parse(z.object({ upTo: z.string().optional() }), req.query, reply);
    if (!q) return;
    const [accounts, txs] = await Promise.all([
      prisma.account.findMany({ where: { userId: req.userId, deletedAt: null, archivedAt: null }, include: { institution: true }, orderBy: { name: "asc" } }),
      prisma.transaction.findMany({ where: { userId: req.userId, deletedAt: null }, select: { type: true, date: true, amount: true, accountId: true, toAccountId: true, invoiceId: true } }),
    ]);
    const balances = computeAccountBalances(
      accounts.map((a) => ({ id: a.id, openingBalance: a.openingBalance, openingDate: dateOrNull(a.openingDate) })),
      txs.map((t) => ({ ...t, date: dateOrNull(t.date)! })),
      q.upTo ?? null,
    );
    const list: AccountDto[] = accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, institution: a.institution?.name ?? null, color: a.color, isDefault: a.isDefault, balance: Math.round((balances.get(a.id) ?? 0) * 100) / 100 }));
    return { accounts: list, unassigned: balances.get(UNASSIGNED) ?? 0 };
  });

  app.post("/accounts", async (req, reply) => {
    const body = parse(z.object({ name: z.string().min(1), kind: z.enum(["CHECKING", "SAVINGS", "PAYMENT", "CASH", "INVESTMENT"]).default("CHECKING"), institutionId: z.string().optional(), openingBalance: z.number().default(0), openingDate: z.string(), color: z.string().optional(), isDefault: z.boolean().optional() }), req.body, reply);
    if (!body) return;
    if (body.kind === "CASH" && body.institutionId) return reply.code(400).send({ error: "conta CASH não tem instituição" });
    const a = await prisma.account.create({ data: { ...body, userId: req.userId, openingDate: fromISODate(body.openingDate) } });
    return reply.code(201).send({ id: a.id, name: a.name, kind: a.kind });
  });

  app.get("/institutions", async (req) => {
    const rows = await prisma.institution.findMany({ where: { userId: req.userId, deletedAt: null }, include: { creditCards: { where: { deletedAt: null } } }, orderBy: { name: "asc" } });
    const list: InstitutionDto[] = rows.map((i) => ({ id: i.id, name: i.name, type: i.type, color: i.color, closingDay: i.closingDay, dueDay: i.dueDay, cards: i.creditCards.map((c) => ({ id: c.id, nickname: c.nickname, brand: c.brand, last4: c.last4 })) }));
    return { institutions: list };
  });

  app.post("/institutions", async (req, reply) => {
    const body = parse(z.object({ name: z.string().min(1), type: z.enum(["BANK", "FINTECH", "COOPERATIVE", "BROKER", "OTHER"]).default("BANK"), color: z.string().optional(), closingDay: z.number().int().min(1).max(31).optional(), dueDay: z.number().int().min(1).max(31).optional() }), req.body, reply);
    if (!body) return;
    if ((body.closingDay == null) !== (body.dueDay == null)) return reply.code(400).send({ error: "ciclo é tudo-ou-nada: closingDay e dueDay juntos" });
    const i = await prisma.institution.create({ data: { ...body, userId: req.userId } });
    return reply.code(201).send({ id: i.id, name: i.name });
  });

  app.post("/institutions/:id/cards", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(z.object({ nickname: z.string().min(1), brand: z.enum(["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "OTHER"]).default("OTHER"), last4: z.string().regex(/^\d{4}$/), limitAmount: z.number().optional() }), req.body, reply);
    if (!body) return;
    const inst = await prisma.institution.findFirst({ where: { id, userId: req.userId } });
    if (!inst) return reply.code(404).send({ error: "institution not found" });
    const c = await prisma.creditCard.create({ data: { ...body, userId: req.userId, institutionId: id } });
    return reply.code(201).send({ id: c.id, nickname: c.nickname });
  });

  app.get("/categories", async (req) => {
    const rows = await prisma.category.findMany({ where: { userId: req.userId, archivedAt: null }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
    const list: CategoryDto[] = rows.map((c) => ({ id: c.id, kind: c.kind, name: c.name, color: c.color, icon: c.icon, system: c.system }));
    return { categories: list };
  });

  app.get("/invoices", async (req, reply) => {
    const q = parse(z.object({ year: z.coerce.number().int().optional(), month: z.coerce.number().int().optional() }), req.query, reply);
    if (!q) return;
    const today = todayISO(config.timezone);
    const rows = await prisma.cardInvoice.findMany({ where: { userId: req.userId, deletedAt: null, ...(q.year ? { refYear: q.year } : {}), ...(q.month ? { refMonth: q.month } : {}) }, include: { institution: true, _count: { select: { purchases: true } } }, orderBy: { dueDate: "desc" }, take: 60 });
    const list: InvoiceDto[] = rows.map((i) => ({ id: i.id, institution: i.institution.name, refYear: i.refYear, refMonth: i.refMonth, closingDate: dateOrNull(i.closingDate), dueDate: dateOrNull(i.dueDate), total: dec(i.total), declaredTotal: decOrNull(i.declaredTotal), purchases: i._count.purchases, status: effectiveInvoiceStatus({ status: i.status, closingDate: dateOrNull(i.closingDate)! }, today) }));
    return { invoices: list };
  });

  // Pagar fatura (D6): cria a saída que movimenta a conta e congela a fatura como PAID.
  app.post("/invoices/:id/pay", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(z.object({ accountId: z.string(), date: z.string().optional(), amount: z.number().positive().optional(), paymentMethod: z.enum(["DEBIT", "PIX", "BOLETO", "OTHER"]).default("DEBIT") }), req.body, reply);
    if (!body) return;
    const inv = await prisma.cardInvoice.findFirst({ where: { id, userId: req.userId, deletedAt: null }, include: { institution: true } });
    if (!inv) return reply.code(404).send({ error: "not found" });
    if (inv.status === "PAID") return reply.code(409).send({ error: "fatura já paga" });
    const amount = body.amount ?? dec(inv.total);
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.transaction.create({
        data: { userId: req.userId, type: "EXPENSE", date: fromISODate(body.date ?? dateOrNull(inv.dueDate)!), amount, description: `Fatura ${inv.institution.name} ${String(inv.refMonth).padStart(2, "0")}/${inv.refYear}`, paymentMethod: body.paymentMethod, accountId: body.accountId, paidInvoiceId: inv.id, source: "SYSTEM" },
      });
      await tx.cardInvoice.update({ where: { id: inv.id }, data: { status: "PAID", total: amount, totalManual: true } });
      return payment;
    });
    return reply.code(201).send(toTransactionDto(result));
  });
}
