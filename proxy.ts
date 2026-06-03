import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/pos/ingest") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    // PWA 资产必须可匿名存取，否则安装/离线会坏
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png"
  ) {
    return NextResponse.next();
  }

  // Supabase 登入帐号 / demo 一键进入：凭 gate cookie 放行（资料由 Supabase RLS 保护）
  if (request.cookies.get("zg_gate")?.value) return NextResponse.next();

  const password = process.env.ACCESS_PASSWORD;
  if (!password) return NextResponse.next();

  const token = request.cookies.get("zg_auth")?.value;
  if (token === password) return NextResponse.next();

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
