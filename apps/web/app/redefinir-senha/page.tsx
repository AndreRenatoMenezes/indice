import type { Metadata } from "next";
import Link from "next/link";
import { Btn, Card, Empty, Field } from "@/components/ui";
import { resetPasswordAction } from "@/lib/actions";

export const metadata: Metadata = { title: "Redefinir senha · Índice" };
export const dynamic = "force-dynamic";

const ERRO: Record<string, string> = {
  token: "link inválido ou vencido. Peça um novo.",
  curta: "a senha precisa de pelo menos 8 caracteres",
  senhas: "as senhas não conferem",
  indisponivel: "serviço de login indisponível, tente de novo",
};

type Busca = { token?: string; erro?: string };

export default async function RedefinirSenha({ searchParams }: { searchParams: Promise<Busca> }) {
  const { token = "", erro } = await searchParams;
  const mensagem = erro ? (ERRO[erro] ?? "não foi possível redefinir a senha") : null;

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-[430px] py-12">
        <header className="mb-5 text-center">
          <div className="label tracking-[0.24em]">Índice</div>
          <h1 className="mt-1 font-display italic leading-none" style={{ fontSize: 40 }}>Redefinir senha</h1>
        </header>
        <Card>
          <Empty>{mensagem ?? "o link de redefinição não veio completo ou já venceu."}</Empty>
          <Link href="/esqueci-senha" className="text-sm">pedir um link novo</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[430px] py-12">
      <header className="mb-5 text-center">
        <div className="label tracking-[0.24em]">Índice</div>
        <h1 className="mt-1 font-display italic leading-none" style={{ fontSize: 40 }}>Redefinir senha</h1>
        <p className="mt-2 font-display text-[15px] italic muted">escolha a senha nova deste Índice.</p>
      </header>

      <Card>
        <form action={resetPasswordAction} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <label className="flex flex-col gap-1.5">
            <span className="label">senha nova</span>
            <Field frameClassName="w-full" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">repetir senha</span>
            <Field frameClassName="w-full" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </label>

          {mensagem && <p role="alert" className="m-0 font-display text-[15px] italic" style={{ color: "var(--red)" }}>{mensagem}</p>}

          <Btn type="submit" tone="primary" frameClassName="mt-1 w-full">definir senha</Btn>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm muted">
        <Link href="/entrar">voltar para a entrada</Link>
      </p>
    </div>
  );
}
