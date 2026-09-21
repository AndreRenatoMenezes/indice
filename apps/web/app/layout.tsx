import type { Metadata } from "next";
import { EB_Garamond, Kalam } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

// Fallback manuscrito para os glifos fora do subconjunto da Excalifont.
const kalam = Kalam({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-kalam", display: "swap" });

// Serifada de display: nome "Índice", títulos de card e rótulos (classe `font-display`).
const garamond = EB_Garamond({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], variable: "--font-eb-garamond", display: "swap" });

export const metadata: Metadata = { title: "Índice", description: "Mapa central: rotina, finanças, hábitos, metas e mídia." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${kalam.variable} ${garamond.variable}`}>
      <body>
        <Nav />
        <main className="paper mx-auto max-w-[1080px] px-12 py-7">{children}</main>
      </body>
    </html>
  );
}
