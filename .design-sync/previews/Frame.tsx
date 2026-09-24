import { Frame } from "@indice/web";

export function Etiquetas() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Frame radius={4}><span className="mono px-1.5 py-0.5 text-[10px] uppercase">livro</span></Frame>
      <Frame radius={4}><span className="mono px-1.5 py-0.5 text-[10px] uppercase">série</span></Frame>
      <Frame radius={4} stroke="#6f665c"><span className="mono px-1.5 py-0.5 text-[10px] uppercase">podcast</span></Frame>
    </div>
  );
}

export function EmVoltaDeSelect() {
  return (
    <div style={{ width: 260 }}>
      <Frame className="w-full">
        <select className="input w-full" aria-label="forma de pagamento" defaultValue="PIX">
          <option value="PIX">Pix</option>
          <option value="DEBIT">Débito</option>
          <option value="CASH">Dinheiro</option>
        </select>
      </Frame>
    </div>
  );
}

export function BotaoRedondo() {
  return (
    <div className="flex items-center gap-3">
      <Frame radius={20} strokeWidth={0.9} fill="#b2f2bb"><button className="btn h-10 w-10 px-0 text-center text-lg">✓</button></Frame>
      <Frame radius={20} strokeWidth={0.9}><button className="btn h-10 w-10 px-0 text-center text-lg">○</button></Frame>
    </div>
  );
}
