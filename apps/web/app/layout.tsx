import type { Metadata } from "next";
import { Kalam } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

// Fallback manuscrito para os glifos fora do subconjunto da Excalifont.
const kalam = Kalam({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-kalam", display: "swap" });

export const metadata: Metadata = { title: "Índice", description: "Mapa central: rotina, finanças, hábitos, metas e mídia." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={kalam.variable}>
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl px-12 py-7">{children}</main>
      </body>
    </html>
  );
}
