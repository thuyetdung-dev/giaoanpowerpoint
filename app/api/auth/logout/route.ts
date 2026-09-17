/** app/api/auth/logout/route.ts — Đăng xuất: xoá cookie phiên (V12.11). */
import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookie("", 0));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
