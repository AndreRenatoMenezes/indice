import type { FastifyReply } from "fastify";
import type { ZodType } from "zod";

// Valida body/query com zod e responde 400 com detalhes quando falha.
export function parse<T>(schema: ZodType<T>, data: unknown, reply: FastifyReply): T | null {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  reply.code(400).send({ error: "validation", details: r.error.issues });
  return null;
}

export function dec(v: unknown): number {
  if (v == null) return 0;
  return Number(v.toString());
}

export function decOrNull(v: unknown): number | null {
  return v == null ? null : Number(v.toString());
}

export function dateOrNull(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
