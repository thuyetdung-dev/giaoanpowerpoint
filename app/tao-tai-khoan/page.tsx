"use client";
/**
 * app/tao-tai-khoan/page.tsx — Máy tính băm mật khẩu (V12.11)
 *
 * VÌ SAO CẦN TRANG NÀY. Mật khẩu trong TEACHERS được lưu dưới dạng băm, nên
 * quản trị phải băm được mật khẩu trước khi dán vào biến môi trường. Cách thông
 * thường là chạy một lệnh Node ở máy — nhưng thầy làm việc hoàn toàn trên
 * GitHub qua trình duyệt, không gõ lệnh. Nên việc băm phải làm được ngay trong
 * trang web.
 *
 * VÌ SAO TRANG NÀY ĐỂ AI CŨNG VÀO ĐƯỢC (middleware cho qua). Nó không cấp
 * quyền gì cả: chỉ là một phép tính. Ai vào cũng chỉ băm được mật khẩu của
 * chính họ, và bản băm đó vô dụng nếu không được quản trị dán vào TEACHERS
 * trên Vercel. Nếu che nó lại thì chính quản trị cũng không tạo nổi tài khoản
 * đầu tiên — vòng luẩn quẩn kinh điển.
 *
 * MẬT KHẨU KHÔNG BAO GIỜ RỜI KHỎI MÁY NÀY. Việc băm chạy bằng Web Crypto ngay
 * trong trình duyệt; trang không gửi một yêu cầu mạng nào. Nhờ vậy giáo viên có
 * thể tự chọn mật khẩu rồi chỉ đưa DÒNG KẾT QUẢ cho quản trị — quản trị không
 * hề biết mật khẩu của họ.
 */

import { useState } from "react";
import { hashPassword, randomSalt } from "@/lib/auth";

export default function TaoTaiKhoanPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
  const [ketQua, setKetQua] = useState("");
  const [dangTinh, setDangTinh] = useState(false);
  const [daChep, setDaChep] = useState(false);

  async function tao(e: React.FormEvent) {
    e.preventDefault();
    const ten = user.trim();
    if (!ten || !password) return;
    setDangTinh(true);
    setDaChep(false);
    try {
      const salt = randomSalt();
      const hash = await hashPassword(password, salt);
      setKetQua(`${ten}|${role}|${salt}|${hash}`);
      setPassword("");
    } finally {
      setDangTinh(false);
    }
  }

  return (
    <main className="dn-man">
      <form className="dn-the dn-rong" onSubmit={tao}>
        <h1>Tạo dòng tài khoản</h1>
        <p className="dn-phu">Dành cho quản trị — dán kết quả vào biến môi trường TEACHERS trên Vercel</p>

        <label>
          Tên đăng nhập
          <input value={user} onChange={(e) => setUser(e.target.value)} maxLength={80} required autoFocus
                 placeholder="ví dụ: cohoa" />
        </label>

        <label>
          Mật khẩu
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 autoComplete="new-password" maxLength={200} required
                 placeholder="ít nhất 10 ký tự, có chữ và số" />
        </label>

        <label>
          Vai trò
          <select value={role} onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "teacher")}>
            <option value="teacher">Giáo viên</option>
            <option value="admin">Quản trị</option>
          </select>
        </label>

        <button type="submit" className="dn-chinh" disabled={dangTinh}>
          {dangTinh ? "Đang băm…" : "Tạo dòng tài khoản"}
        </button>

        {ketQua && (
          <>
            <p className="dn-ghi">Chép TOÀN BỘ dòng dưới đây, nối vào biến <b>TEACHERS</b>, các dòng ngăn nhau bằng dấu <b>;</b></p>
            <textarea className="dn-ketqua" readOnly value={ketQua} rows={3} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="dn-nho"
                    onClick={() => { navigator.clipboard?.writeText(ketQua); setDaChep(true); }}>
              {daChep ? "Đã chép ✓" : "Chép vào bộ nhớ tạm"}
            </button>
          </>
        )}

        <p className="dn-ghi">
          ✓ Mật khẩu được băm ngay tại máy này, trang không gửi nó đi đâu cả. Giáo viên có thể tự mở
          trang này, tự chọn mật khẩu, rồi chỉ đưa dòng kết quả cho quản trị — quản trị không biết
          mật khẩu của họ.
        </p>
      </form>
    </main>
  );
}
