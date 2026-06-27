import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, tokenFor } from "@/lib/auth";

// Gate every page/route behind the shared password. If DASHBOARD_PASSWORD is not
// set, the gate is disabled (handy for first-boot / local dev).
export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE)?.value;
  const expected = await tokenFor(password);
  if (cookie && cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
