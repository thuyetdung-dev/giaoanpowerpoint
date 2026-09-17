/**
 * lib/auth.ts — Tài khoản riêng từng giáo viên (V12.11)
 *
 * VÌ SAO CÓ TỆP NÀY. Trước bản này, `/api/generate` mở cho mọi người: trang công
 * khai, kho công khai, khoá OpenAI nằm trên máy chủ. Ai tìm ra địa chỉ đều tiêu
 * được tiền của nhà trường. Bộ đếm theo IP trong route không chặn được ai cố ý —
 * nó nằm trong RAM của từng instance serverless nên mỗi instance đếm riêng và
 * mất sạch sau mỗi lần khởi động nguội.
 *
 * KHÁC GÌ SO VỚI KHO KHBD. Kho đó để mật khẩu NGUYÊN VĂN trong biến môi trường
 * và cả trường dùng CHUNG một tài khoản giáo viên. Ở đây:
 *   • mật khẩu được BĂM (PBKDF2-SHA256), máy chủ không hề giữ mật khẩu thật;
 *   • MỖI giáo viên một tài khoản, thu hồi được từng người;
 *   • không cần cơ sở dữ liệu — danh sách nằm gọn trong một biến môi trường.
 *
 * VÌ SAO PBKDF2 MÀ KHÔNG PHẢI SCRYPT (kho KHBD dùng scrypt của node:crypto).
 * Tệp này phải chạy được ở BA nơi cùng lúc:
 *   1. middleware (Edge runtime — KHÔNG có node:crypto),
 *   2. route handler (Node),
 *   3. trình duyệt — để trang /tao-tai-khoan băm mật khẩu ngay tại máy giáo
 *      viên, mật khẩu không bao giờ đi qua mạng.
 * Chỉ Web Crypto có mặt ở cả ba, và Web Crypto không có scrypt. PBKDF2-SHA256
 * với 210.000 vòng là mức OWASP khuyến nghị cho thuật toán này.
 * => Tuyệt đối KHÔNG `import ... from "node:crypto"` trong tệp này.
 */

export const COOKIE_NAME = "ls_session";
export const SESSION_HOURS = 8;
const PBKDF2_ITERATIONS = 210_000;
const KEY_BITS = 256;

export type Role = "admin" | "teacher";
export type Account = { user: string; role: Role; salt: string; hash: string };
export type SessionPayload = { u: string; r: Role; exp: number };

/* ------------------------------------------------------------------ */
/* base64url — Web Crypto trả ArrayBuffer, cookie và biến môi trường    */
/* chỉ nhận chữ. Không dùng Buffer vì Buffer không có trên Edge.        */
/* ------------------------------------------------------------------ */

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlToBytes(text: string): Uint8Array {
  const pad = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * So sánh KHÔNG phụ thuộc thời gian.
 *
 * `a === b` thoát ngay tại ký tự đầu khác nhau, nên thời gian trả lời tiết lộ
 * đã đoán đúng bao nhiêu ký tự. node:crypto có timingSafeEqual nhưng Edge thì
 * không, nên viết tay: luôn duyệt hết, gom khác biệt bằng phép XOR.
 */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Mật khẩu                                                            */
/* ------------------------------------------------------------------ */

export function randomSalt(): string {
  return bytesToB64url(crypto.getRandomValues(new Uint8Array(16)));
}

/** Băm mật khẩu. Dùng ở trang /tao-tai-khoan (trình duyệt) và khi đăng nhập. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: b64urlToBytes(salt) as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
  return bytesToB64url(new Uint8Array(bits));
}

export async function verifyPassword(password: string, salt: string, expected: string): Promise<boolean> {
  try {
    return safeEqual(await hashPassword(password, salt), expected);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Danh sách tài khoản                                                 */
/* ------------------------------------------------------------------ */

/**
 * Đọc biến môi trường TEACHERS.
 *
 * Mỗi dòng một tài khoản, ngăn nhau bằng ";" hoặc xuống dòng:
 *     tên|vai trò|salt|hash
 * Ví dụ: `dung|admin|K3f...|9aQ...;hoa|teacher|Lm2...|7bZ...`
 *
 * Dùng biến môi trường thay cơ sở dữ liệu là có chủ ý: một trường vài chục giáo
 * viên thì đây là đủ, không phải dựng thêm hạ tầng nào. Khi nào cần tự đăng ký,
 * đổi mật khẩu trong trang, hoặc nhật ký truy cập thì mới cần cơ sở dữ liệu.
 */
export function parseAccounts(raw: string | undefined): Account[] {
  return String(raw || "")
    .split(/[;\n]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [user, role, salt, hash] = line.split("|").map((p) => p.trim());
      if (!user || !salt || !hash) return null;
      return { user, role: role === "admin" ? "admin" : "teacher", salt, hash } as Account;
    })
    .filter((a): a is Account => a !== null);
}

export function findAccount(accounts: Account[], user: string): Account | undefined {
  const want = String(user || "").trim().toLowerCase();
  return accounts.find((a) => a.user.toLowerCase() === want);
}

/* ------------------------------------------------------------------ */
/* Phiên đăng nhập                                                     */
/* ------------------------------------------------------------------ */

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Token = base64url(JSON) + "." + base64url(HMAC-SHA256).
 *
 * Tự ký chứ không lưu phiên ở máy chủ: serverless không có nơi nào giữ trạng
 * thái giữa hai yêu cầu mà không thêm hạ tầng. Đánh đổi: không thu hồi được một
 * phiên lẻ trước khi nó hết hạn — muốn đá hết mọi người ra thì đổi AUTH_SECRET.
 */
export async function signToken(payload: SessionPayload, secret: string): Promise<string> {
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body));
  return `${body}.${bytesToB64url(new Uint8Array(sig))}`;
}

export async function verifyToken(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  try {
    const expect = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body));
    if (!safeEqual(sig, bytesToB64url(new Uint8Array(expect)))) return null;
    const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as SessionPayload;
    if (!data || typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionCookie(value: string, maxAgeSeconds: number): string {
  /* HttpOnly: JavaScript trong trang không đọc được cookie, nên một lỗi XSS ở
     bất kỳ đâu cũng không lấy được phiên đăng nhập.
     SameSite=Lax: trang khác không thể tự gửi kèm cookie này.
     Secure chỉ bật ở production — bỏ nó thì localhost (http) không đăng nhập được. */
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function readCookie(header: string | null | undefined, name = COOKIE_NAME): string {
  const found = String(header || "")
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

/**
 * Đã cấu hình xong chưa?
 *
 * Thiếu cấu hình thì phần mềm KHOÁ LẠI chứ không mở ra (fail closed). Mở ra khi
 * thiếu cấu hình đúng là cách một lớp bảo vệ âm thầm biến mất: chỉ cần lỡ xoá
 * một biến môi trường là trang lại mở toang mà không ai hay.
 */
export function authConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return String(env.AUTH_SECRET || "").length >= 32 && parseAccounts(env.TEACHERS).length > 0;
}
