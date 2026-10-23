import type { Metadata } from "next";
import Link from "next/link";
import { Btn, Card, Field } from "@/components/ui";
import { forgotPasswordAction } from "@/lib/actions";

export const metadata: Metadata = { title: "Esqueci a senha · Índice" };
export const dynamic = "force-dynamic";

const ERRO: Record<string, string> = {
  campos: "informe o e-mail",
  indisponivel: "serviço de login indisponível, tente de novo",
};

type Busca = { erro?: string; ok?: string; email?: string };

export default async function EsqueciSenha({ searchParams }: { searchParams: Promise<Busca> }) {
  const { erro, ok, email = "" } = await searchParams;
  const mensagem = erro ? (ERRO[erro] ?? "não foi possível enviar o link") : null;

  return (
    <div className="mx-auto w-full max-w-[430px] py-12">
      <header className="mb-5 text-center">
        <div className="label tracking-[0.24em]">Índice</div>
        <h1 className="mt-1 font-display italic leading-none" style={{ fontSize: 40 }}>Esqueci a senha</h1>
        <p className="mt-2 font-display text-[15px] italic muted">informe seu e-mail e enviamos um link para definir a senha nova.</p>
      </header>

      <Card>
        <form action={forgotPasswordAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">e-mail</span>
            <Field
              frameClassName="w-full"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={email}
            />
          </label>

          {mensagem && <p role="alert" className="m-0 font-display text-[15px] italic" style={{ color: "var(--red)" }}>{mensagem}</p>}
          {ok === "enviado" && (
            <p className="m-0 font-display text-[15px] italic" style={{ color: "var(--green)" }}>
              se esse e-mail existir, o link chegou. Confira a caixa de entrada.
            </p>
          )}

          <Btn type="submit" tone="primary" frameClassName="mt-1 w-full">enviar link</Btn>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm muted">
        lembrei: <Link href="/entrar">entrar</Link>
      </p>
    </div>
  );
}
