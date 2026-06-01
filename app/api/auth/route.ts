import { NextResponse } from "next/server";

// 三种进入方式：
//  1) { password }    ─ 共享密码（保留原本的家族/内部登入）
//  2) { demo: true }   ─ demo 一键进入（成交演示用，资料为本机暂存）
//  3) { authed: true } ─ 已通过 Supabase 登入的真实帐号（放行 app 外壳，资料由 RLS 保护）
// 三者都会设一个 cookie 让 proxy.ts 放行。
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    password?: string;
    demo?: boolean;
    authed?: boolean;
  };
  const { password, demo, authed } = body;

  // 共享密码
  if (typeof password === "string") {
    if (!process.env.ACCESS_PASSWORD || password !== process.env.ACCESS_PASSWORD) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set("zg_auth", password, COOKIE_OPTS);
    return response;
  }

  // demo 一键进入
  if (demo) {
    const response = NextResponse.json({ success: true, mode: "demo" });
    response.cookies.set("zg_gate", "demo", COOKIE_OPTS);
    return response;
  }

  // Supabase 已登入帐号
  if (authed) {
    const response = NextResponse.json({ success: true, mode: "user" });
    response.cookies.set("zg_gate", "user", COOKIE_OPTS);
    return response;
  }

  return NextResponse.json({ error: "缺少凭证" }, { status: 400 });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("zg_auth");
  response.cookies.delete("zg_gate");
  return response;
}
