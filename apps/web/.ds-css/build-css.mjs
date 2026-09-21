// Compila o CSS do app para o design-sync: Tailwind v4 precisa varrer os
// componentes para emitir os utilitários, e o bundle do DS não tem o
// `next/font`, então as famílias entram por @import do Google Fonts.
// Saída: .ds-css/styles.built.css (apontado por cfg.cssEntry).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");

// `url("/fonts/...")` é absoluto no app (servido de public/). O extrator de
// fontes do conversor resolve relativo ao arquivo, então reescrevemos.
const globals = readFileSync(resolve(web, "app/globals.css"), "utf8")
  .replace(/url\("\/fonts\//g, 'url("../public/fonts/');

const entry = [
  '@import url("https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Kalam:wght@400;700&display=swap");',
  globals,
  '@source "../components";',
  '@source "../app";',
  // Os previews autorados do design-sync também usam utilitários Tailwind.
  '@source "../../../.design-sync/previews/*.tsx";',
  // No app essas variáveis vêm do next/font; fora dele, apontam para as
  // famílias carregadas pelo @import acima.
  ":root { --font-kalam: 'Kalam'; --font-eb-garamond: 'EB Garamond'; }",
].join("\n");

const entryPath = resolve(here, "entry.css");
mkdirSync(here, { recursive: true });
writeFileSync(entryPath, entry);

const out = await postcss([tailwind()]).process(entry, { from: entryPath, to: resolve(here, "styles.built.css") });
writeFileSync(resolve(here, "styles.built.css"), out.css);
console.error(`ds-css: styles.built.css (${(out.css.length / 1024).toFixed(0)} KB)`);
