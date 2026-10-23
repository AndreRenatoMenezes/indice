import type { Metadata } from "next";
import Link from "next/link";
import { Btn, Card, Field } from "@/components/ui";
import { signInAction } from "@/lib/actions";

export const metadata: Metadata = { title: "Entrar · Índice" };
export const dynamic = "force-dynamic";

const ERRO: Record<string, string> = {
  credenciais: "e-mail ou senha incorretos",
  "nao-autorizado": "e-mail não autorizado",
  campos: "informe e-mail e senha",
  indisponivel: "serviço de login indisponível, tente de novo",
};

const OK: Record<string, string> = {
  verificado: "e-mail verificado. Entre com sua senha.",
  "senha-redefinida": "senha redefinida. Entre com a senha nova.",
};

type Busca = { erro?: string; ok?: string; email?: string; next?: string };

export default async function Entrar({ searchParams }: { searchParams: Promise<Busca> }) {
  const { erro, ok, email = "", next = "" } = await searchParams;
  const mensagem = erro ? (ERRO[erro] ?? "não foi possível entrar") : null;
  const aviso = ok ? OK[ok] : null;

  return (
    <div className="mx-auto w-full max-w-[430px] py-12">
      <header className="mb-5 text-center">
        <div className="label tracking-[0.24em]">Índice</div>
        <h1 className="mt-1 font-display italic leading-none" style={{ fontSize: 40 }}>Entrar</h1>
      </header>

      <Card>
        <form action={signInAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
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
          <label className="flex flex-col gap-1.5">
            <span className="label">senha</span>
            <Field
              frameClassName="w-full"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {mensagem && <p role="alert" className="m-0 font-display text-[15px] italic" style={{ color: "var(--red)" }}>{mensagem}</p>}
          {aviso && <p className="m-0 font-display text-[15px] italic" style={{ color: "var(--green)" }}>{aviso}</p>}

          <Btn type="submit" tone="primary" frameClassName="mt-1 w-full">entrar</Btn>
        </form>
      </Card>

      <div className="mt-4 flex justify-between text-sm">
        <Link href="/criar-conta">criar conta</Link>
        <Link href="/esqueci-senha">esqueci a senha</Link>
      </div>
    </div>
  );
}
