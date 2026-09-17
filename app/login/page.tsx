"use client";
/**
 * app/login/page.tsx — Trang đăng nhập (V12.11)
 *
 * Trang RIÊNG chứ không phải lớp phủ lên app/page.tsx. Hai lý do:
 *   1. app/page.tsx đã 1630 dòng và 51 hook — chèn thêm vào đó là làm nó tệ hơn.
 *   2. Quan trọng hơn: lớp phủ bằng CSS KHÔNG bảo vệ được gì. Kho KHBD từng làm
 *      vậy: `visibility:hidden` chỉ che bằng mắt, mã vẫn tải và chạy đủ, gõ một
 *      dòng trong Console là vào được. Ở đây middleware chặn từ máy chủ, trình
 *      duyệt không bao giờ nhận được mã của trang soạn bài khi chưa đăng nhập.
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { APP_LABEL } from "@/lib/version";

function LoginForm() {
  const params = useSearchParams();
  const chuaCauHinh = params.get("chua-cau-hinh") === "1";
  const tiep = params.get("tiep") || "/";

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [hienMk, setHienMk] = useState(false);
  const [loi, setLoi] = useState("");
  const [dangGui, setDangGui] = useState(false);

  async function guiDangNhap(e: React.FormEvent) {
    e.preventDefault();
    setLoi("");
    setDangGui(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Đăng nhập không thành công");
      setPassword("");
      /* TẢI LẠI HẲN TRANG, không dùng router.replace().
         Lý do: layout (và nhãn tài khoản trong đó) chỉ gắn kết MỘT lần rồi
         sống suốt các lần chuyển trang phía client. Đăng nhập xong mà chỉ
         chuyển trang bằng router thì nhãn vẫn giữ kết quả "chưa đăng nhập" nó
         đọc được lúc còn ở /login, nên không ai thấy mình đang đăng nhập bằng
         tài khoản nào. Tải lại hẳn cũng bảo đảm middleware chạy lại với cookie
         vừa nhận, không có bản đệm nào xen vào.
         Đã đo: đây chính là lỗi khiến nhãn tài khoản biến mất ở lần thử đầu. */
      window.location.assign(tiep.startsWith("/") ? tiep : "/");
    } catch (err) {
      setLoi(err instanceof Error ? err.message : "Đăng nhập không thành công");
    } finally {
      setDangGui(false);
    }
  }

  return (
    <main className="dn-man">
      <form className="dn-the" onSubmit={guiDangNhap}>
        <h1>Trợ lý soạn PowerPoint Toán THPT</h1>
        <p className="dn-phu">{APP_LABEL}</p>

        {chuaCauHinh && (
          <p className="dn-loi" role="alert">
            Máy chủ chưa cấu hình đăng nhập. Quản trị cần đặt hai biến môi trường
            <b> AUTH_SECRET</b> và <b> TEACHERS</b> trên Vercel rồi Redeploy.
          </p>
        )}

        <label>
          Tên đăng nhập
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" maxLength={80} required autoFocus />
        </label>

        <label>
          Mật khẩu
          <span className="dn-hang">
            <input
              type={hienMk ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={200}
              required
            />
            <button type="button" className="dn-nho" onClick={() => setHienMk((v) => !v)}>
              {hienMk ? "Ẩn" : "Hiện"}
            </button>
          </span>
        </label>

        {loi && <p className="dn-loi" role="alert">{loi}</p>}

        <button type="submit" className="dn-chinh" disabled={dangGui}>
          {dangGui ? "Đang kiểm tra…" : "Vào trang soạn bài"}
        </button>

        <p className="dn-ghi">
          🔒 Phiên đăng nhập được ký và lưu bằng cookie HttpOnly. Máy chủ không lưu mật khẩu —
          chỉ lưu bản băm, nên kể cả người quản trị cũng không đọc được mật khẩu của thầy cô.
        </p>
        <p className="dn-ghi">Quên mật khẩu thì liên hệ quản trị để được cấp lại. Đừng gửi mật khẩu qua tin nhắn chung.</p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  /* useSearchParams cần Suspense khi trang được dựng sẵn ở bước build. */
  return (
    <Suspense fallback={<main className="dn-man" />}>
      <LoginForm />
    </Suspense>
  );
}
