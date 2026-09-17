/**
 * middleware.ts — Cổng gác đặt TRƯỚC mọi thứ (V12.11)
 *
 * VÌ SAO ĐẶT Ở ĐÂY CHỨ KHÔNG PHẢI TRONG TỪNG TUYẾN. Middleware chạy trước khi
 * yêu cầu chạm tới bất kỳ route handler nào. Kiểm trong từng tuyến thì chỉ cần
 * một lần quên là thủng — mà tuyến tốn tiền (`/api/generate`) lại chính là
 * tuyến dễ quên nhất khi thêm tính năng mới. Ở đây thì mặc định là ĐÓNG: thêm
 * tuyến mới nào cũng tự động được che, trừ khi cố ý ghi vào danh sách mở.
 *
 * MIDDLEWARE CHẠY Ở EDGE RUNTIME — không có node:crypto. Đó là lý do lib/auth.ts
 * chỉ dùng Web Crypto. Ở đây chỉ kiểm chữ ký HMAC của cookie, không băm mật khẩu,
 * nên rất nhẹ.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, readCookie, verifyToken } from "@/lib/auth";

/** Những đường được vào mà không cần đăng nhập. */
const PUBLIC_PATHS = [
  "/login",
  "/tao-tai-khoan", // chỉ là máy tính băm chạy tại trình duyệt, không cấp quyền gì
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");

  /* Chưa cấu hình đăng nhập thì KHOÁ, không mở. Xem ghi chú authConfigured(). */
  if (!authConfigured()) {
    if (isApi) {
      return NextResponse.json(
        { error: "Máy chủ chưa cấu hình đăng nhập (AUTH_SECRET, TEACHERS). Liên hệ quản trị." },
        { status: 503 },
      );
    }
    return NextResponse.redirect(new URL("/login?chua-cau-hinh=1", req.url));
  }

  const session = await verifyToken(readCookie(req.headers.get("cookie")), String(process.env.AUTH_SECRET));
  if (session) return NextResponse.next();

  /* API trả 401 JSON để giao diện hiện đúng thông báo; trang thì chuyển sang
     /login kèm nơi cần quay lại, để đăng nhập xong về đúng chỗ đang làm dở. */
  if (isApi) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại." }, { status: 401 });
  }
  const to = new URL("/login", req.url);
  if (pathname !== "/") to.searchParams.set("tiep", pathname);
  return NextResponse.redirect(to);
}

/**
 * Bỏ qua tài nguyên tĩnh: nếu che cả _next/static thì trang đăng nhập cũng
 * không tải nổi CSS của chính nó.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|css|js|map|woff2?)$).*)"],
};
