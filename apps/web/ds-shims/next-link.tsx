// Shim para o design-sync: `next/link` exige o contexto do App Router. Aqui
// vira uma âncora simples, que é o que o Link renderiza no HTML final.
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

export default function Link({ href, children, prefetch, replace, scroll, ...rest }: Props) {
  return <a href={href} {...rest}>{children}</a>;
}
