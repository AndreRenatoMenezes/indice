import type { Metadata } from "next";
import Link from "next/link";
import { Btn, Card, Field } from "@/components/ui";
import { resendVerificationAction, verifyEmailAction } from "@/lib/actions";

export const metadata: Metadata = { title: "Verificar e-mail · Índice" };
export const dynamic = "force-dynamic";

const ERRO: Record<string, string> = {
  codigo: "código inválido",
  campos: "informe o e-mail e o código",
  indisponivel: "serviço de login indisponível, tente de novo",
};

type Busca = { email?: string; erro?: string; ok?: string };

export default async function VerificarEmail({ searchParams }: { searchParams: Promise<Busca> }) {
  const { email = "", erro, ok } = await searchParams;
  const mensagem = erro ? (ERRO[erro] ?? "não foi possível verificar") : null;

  return (
    <div className="mx-auto w-full max-w-[430px] py-12">
      <header className="mb-5 text-center">
        <div className="label tracking-[0.24em]">Índice</div>
        <h1 className="mt-1 font-display italic leading-none" style={{ fontSize: 40 }}>Verificar e-mail</h1>
        <p className="mt-2 font-display text-[15px] italic muted">
          {email ? <>enviamos um código de 6 dígitos para <span style={{ color: "var(--fg)" }}>{email}</span>.</> : "informe o e-mail que recebeu o código."}
        </p>
      </header>

      <Card>
        <form action={verifyEmailAction} className="flex flex-col gap-4">
          {email
            ? <input type="hidden" name="email" value={email} />
            : (
              <label className="flex flex-col gap-1.5">
                <span className="label">e-mail</span>
                <Field frameClassName="w-full" name="email" type="email" autoComplete="email" inputMode="email" required />
              </label>
            )}
          <label className="flex flex-col gap-1.5">
            <span className="label">código</span>
            <Field
              frameClassName="w-full"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              required
            />
          </label>

          {mensagem && <p role="alert" className="m-0 font-display text-[15px] italic" style={{ color: "var(--red)" }}>{mensagem}</p>}
          {ok === "reenviado" && <p className="m-0 font-display text-[15px] italic" style={{ color: "var(--green)" }}>código reenviado.</p>}

          <Btn type="submit" tone="primary" frameClassName="mt-1 w-full">verificar</Btn>
        </form>

        {email && (
          <form action={resendVerificationAction} className="flex justify-center pt-1">
            <input type="hidden" name="email" value={email} />
            <Btn type="submit" tone="ghost" className="text-sm">reenviar código</Btn>
          </form>
        )}
      </Card>

      <p className="mt-4 text-center text-sm muted">
        já verificou? <Link href="/entrar">entrar</Link>
      </p>
    </div>
  );
}
