import type { Metadata } from "next";
import { Btn, Card } from "@/components/ui";
import { signOutAction } from "@/lib/actions";

export const metadata: Metadata = { title: "Acesso removido · Índice" };
export const dynamic = "force-dynamic";

export default function AcessoRemovido() {
  return (
    <div className="mx-auto w-full max-w-[430px] py-12">
      <header className="mb-5 text-center">
        <div className="label tracking-[0.24em]">Índice</div>
        <h1 className="mt-1 font-display italic leading-none" style={{ fontSize: 40 }}>Acesso removido</h1>
      </header>

      <Card>
        <p className="m-0 font-display text-[16px] italic leading-[1.5]">
          este e-mail não está mais na lista de autorizados deste Índice.
        </p>
        <p className="m-0 text-sm muted">
          nenhum dado foi apagado. Se precisar voltar a entrar, fale com quem administra o acesso.
        </p>
        <form action={signOutAction} className="mt-1 flex justify-end">
          <Btn type="submit" tone="primary">sair</Btn>
        </form>
      </Card>
    </div>
  );
}
