/**
 * app/api/auth/session/route.ts — Ai đang đăng nhập? (V12.11)
 *
 * Giao diện gọi tuyến này để hiện tên người dùng và nút Đăng xuất. Chỉ trả về
 * tên và vai trò, không trả về token hay bất cứ thứ gì dùng lại được.
 */
import { NextResponse } from "next/server";
import { authConfigured, readCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const noStore = { "Cache-Control": "no-store" };
  if (!authConfigured()) {
    return NextResponse.json({ authenticated: false, configured: false }, { status: 503, headers: noStore });
  }
  const data = await verifyToken(readCookie(req.headers.get("cookie")), String(process.env.AUTH_SECRET));
  if (!data) return NextResponse.json({ authenticated: false, configured: true }, { status: 401, headers: noStore });
  return NextResponse.json({ authenticated: true, configured: true, user: data.u, role: data.r }, { headers: noStore });
}
