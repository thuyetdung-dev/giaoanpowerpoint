/**
 * app/api/auth/login/route.ts — Đăng nhập (V12.11)
 *
 * Chạy ở Node runtime vì PBKDF2 210.000 vòng tốn CPU hơn mức Edge nên dành cho
 * một yêu cầu; và đây cũng là nơi duy nhất cần đọc danh sách tài khoản.
 */

import { NextResponse } from "next/server";
import {
  SESSION_HOURS,
  authConfigured,
  findAccount,
  parseAccounts,
  sessionCookie,
  signToken,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Chặn dò mật khẩu. Bộ đếm này có đúng những khuyết điểm đã ghi ở
 * app/api/generate/route.ts (nằm trong RAM một instance, mất khi khởi động
 * nguội), nhưng ở đây nó vẫn đáng có: kẻ dò mật khẩu phải gửi HÀNG NGHÌN yêu
 * cầu, mà mỗi yêu cầu sai lại tốn 210.000 vòng PBKDF2 của chính máy chủ. Chi
 * phí băm mới là hàng rào chính; bộ đếm chỉ là lớp thứ hai.
 */
const tries = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_TRIES = 6;

function tooManyTries(ip: string): boolean {
  const now = Date.now();
  for (const [k, v] of tries) if (now > v.resetAt) tries.delete(k);
  const rec = tries.get(ip);
  if (!rec || now > rec.resetAt) {
    tries.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_TRIES;
}

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Máy chủ chưa cấu hình đăng nhập. Cần đặt AUTH_SECRET và TEACHERS trong biến môi trường trên Vercel." },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooManyTries(ip)) {
    return NextResponse.json({ error: "Thử đăng nhập quá nhiều lần. Hãy chờ khoảng một phút." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const user = String(body?.user ?? "").trim();
  const password = String(body?.password ?? "");
  if (!user || !password) {
    return NextResponse.json({ error: "Hãy nhập đầy đủ tên đăng nhập và mật khẩu." }, { status: 400 });
  }

  const account = findAccount(parseAccounts(process.env.TEACHERS), user);

  /* Tên sai và mật khẩu sai phải trả về CÙNG một thông báo. Nếu tách riêng
     ("không có tài khoản này" / "sai mật khẩu") thì kẻ dò biết được tên nào có
     thật, và việc dò rút ngắn đi một nửa. */
  const ok = account ? await verifyPassword(password, account.salt, account.hash) : false;
  if (!account || !ok) {
    return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." }, { status: 401 });
  }

  const maxAge = SESSION_HOURS * 3600;
  const token = await signToken(
    { u: account.user, r: account.role, exp: Date.now() + maxAge * 1000 },
    String(process.env.AUTH_SECRET),
  );

  const res = NextResponse.json({ ok: true, user: account.user, role: account.role });
  res.headers.set("Set-Cookie", sessionCookie(token, maxAge));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
