// Renovação transparente da sessão antes da página renderizar. Se o access
// token venceu (ou está a menos de 60 s de vencer), troca o refresh token por
// um novo em `POST /auth/refresh` e repassa o token novo ao request e ao
// navegador. Sem refresh token, produção volta para `/entrar`.
//
// Os nomes dos cookies repetem `lib/session.ts` de propósito: middleware roda
// no edge runtime e não pode importar `next/headers`. Mantenha os dois iguais.
import { NextResponse, type NextRequest } from "next/server";

const REFRESH_COOKIE = "indice_rt";
const ACCESS_COOKIE = "indice_at";
const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// Em dev local sem Neon Auth a web segue funcionando pela `dev-local-key`;
// em produção (QA e Produção) a sessão é obrigatória.
const AUTH_REQUIRED = process.env.NODE_ENV === "production";
const COOKIE = { httpOnly: true, secure: AUTH_REQUIRED, sameSite: "lax" as const, path: "/" };
const SKEW_SECONDS = 60;
// Mesmo valor de `REFRESH_MAX_AGE` em `lib/session.ts`: janela deslizante de 7
// dias, renovada a cada refresh bem-sucedido.
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

function expOf(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function needsRefresh(token: string | undefined): boolean {
  if (!token) return true;
  const exp = expOf(token);
  if (!exp) return true;
  return exp - Math.floor(Date.now() / 1000) < SKEW_SECONDS;
}

function toLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  const from = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (from && from !== "/") url.searchParams.set("next", from);
  return NextResponse.redirect(url);
}

function expire(response: NextResponse): void {
  const gone = { ...COOKIE, maxAge: 0 };
  response.cookies.set(REFRESH_COOKIE, "", gone);
  response.cookies.set(ACCESS_COOKIE, "", gone);
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    if (!AUTH_REQUIRED) return NextResponse.next();
    return toLogin(req);
  }

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!needsRefresh(accessToken)) return NextResponse.next();

  let res: Response;
  try {
    res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
  } catch {
    // API fora do ar: um access ainda válido continua servindo a página.
    return NextResponse.next();
  }

  if (res.status === 401) {
    const response = toLogin(req);
    expire(response);
    return response;
  }
  if (!res.ok) return NextResponse.next();

  const data = (await res.json().catch(() => null)) as { accessToken?: unknown; accessTokenExpiresAt?: unknown } | null;
  if (!data || typeof data.accessToken !== "string") return NextResponse.next();

  const maxAge = typeof data.accessTokenExpiresAt === "string"
    ? Math.max(0, Math.floor((Date.parse(data.accessTokenExpiresAt) - Date.now()) / 1000))
    : 15 * 60;

  // O request que segue para o Server Component precisa enxergar o token novo.
  const headers = new Headers(req.headers);
  const pairs = (headers.get("cookie") ?? "").split(/;\s*/).filter(Boolean);
  headers.set(
    "cookie",
    [...pairs.filter((pair) => !pair.startsWith(`${ACCESS_COOKIE}=`)), `${ACCESS_COOKIE}=${data.accessToken}`].join("; "),
  );

  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(ACCESS_COOKIE, data.accessToken, { ...COOKIE, maxAge });
  // Janela deslizante: cada renovação empurra o refresh por mais 7 dias.
  response.cookies.set(REFRESH_COOKIE, refreshToken, { ...COOKIE, maxAge: REFRESH_MAX_AGE });
  return response;
}

export const config = {
  // Páginas de auth, arquivos do Next e fontes não passam pelo middleware.
  matcher: ["/((?!entrar|criar-conta|verificar-email|esqueci-senha|redefinir-senha|_next|fonts|favicon.ico).*)"],
};
