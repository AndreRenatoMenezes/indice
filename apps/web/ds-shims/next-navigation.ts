// Shim para o design-sync: os componentes do Índice rodam fora do App Router
// nos previews, onde os hooks de `next/navigation` lançam. Devolve a rota raiz.
export function usePathname(): string {
  return "/";
}
export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  };
}
export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}
export function useParams(): Record<string, string> {
  return {};
}
