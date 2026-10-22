import type { Metadata } from "next";
import Link from "next/link";
import { Btn, Card, Field } from "@/components/ui";
import { signUpAction } from "@/lib/actions";

export const metadata: Metadata = { title: "Criar conta · Índice" };
export const dynamic = "force-dynamic";

const ERRO: Record<string, string> = {
  "nao-autorizado": "e-mail não autorizado",
  "ja-cadastrado": "este e-mail já tem conta. Entre ou recupere a senha.",
  curta: "a senha precisa de pelo menos 8 caracteres",
  senhas: "as senhas não conferem",
  campos: "preencha nome, e-mail e senha",
  invalido: "e-mail ou senha inválidos",
  indisponivel: "serviço de login indisponível, tente de novo",
};

type Busca = { erro?: string; email?: string; nome?: string };

export default async function CriarConta({ searchParams }: { searchParams: Promise<Busca> }) {
  const { erro, email = "", nome = "" } = await searchParams;
  const mensagem = erro ? (ERRO[erro] ?? "não foi possível criar a conta") : null;

  return (
    <div className="mx-auto w-full max-w-[430px] py-12">
      <header className="mb-5 text-center">
        <div className="label tracking-[0.24em]">Índice</div>
        <h1 className="mt-1 font-display italic leading-none" style={{ fontSize: 40 }}>Criar conta</h1>
        <p className="mt-2 font-display text-[15px] italic muted">Só e-mails autorizados recebem um Índice.</p>
      </header>

      <Card>
        <form action={signUpAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">nome</span>
            <Field frameClassName="w-full" name="name" autoComplete="name" required defaultValue={nome} />
          </label>
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
            <Field frameClassName="w-full" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">repetir senha</span>
            <Field frameClassName="w-full" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </label>

          {mensagem && <p role="alert" className="m-0 font-display text-[15px] italic" style={{ color: "var(--red)" }}>{mensagem}</p>}

          <Btn type="submit" tone="primary" frameClassName="mt-1 w-full">criar conta</Btn>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm muted">
        já tem conta? <Link href="/entrar">entrar</Link>
      </p>
    </div>
  );
}
