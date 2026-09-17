/**
 * app/api/generate/route.ts — Tuyến proxy AI chạy trên máy chủ (V11.2)
 *
 * Hỗ trợ cả Gemini lẫn OpenAI. Khoá nằm trong biến môi trường trên Vercel nên
 * trình duyệt không bao giờ nhìn thấy — đây là cách DUY NHẤT an toàn cho khoá
 * OpenAI, vì khoá OpenAI tính tiền: khoá dán vào trình duyệt thì ai mở trang
 * cũng lấy được bằng công cụ Developer Tools và tiêu tiền của chủ khoá.
 *
 * Biến môi trường cần đặt trên Vercel:
 *   GEMINI_API_KEY   — khoá Google Gemini
 *   OPENAI_API_KEY   — khoá OpenAI (sk-...)
 *   AI_PROVIDER      — "openai" hoặc "gemini" (mặc định khi máy khách không nói rõ)
 *   OPENAI_MODEL     — ví dụ "gpt-5.6-terra" (không bắt buộc)
 *   GEMINI_MODEL     — ví dụ "models/gemini-2.5-pro" (không bắt buộc)
 */

import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { callGemini } from "@/lib/gemini-client";
import { callOpenAI } from "@/lib/openai-client";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Chặn lạm dụng theo IP.
 *
 * ĐỌC KỸ TRƯỚC KHI TIN VÀO NÓ. Bộ đếm này nằm trong RAM của MỘT instance
 * serverless, nên nó KHÔNG phải một lớp bảo vệ thật:
 *   • mỗi instance đếm riêng — người gọi nhiều rơi vào instance khác là được
 *     thêm một lượt đầy;
 *   • khởi động nguội là bộ đếm về 0.
 * Nó chỉ chặn được người bấm nhầm liên tục, không chặn được ai cố ý.
 *
 * Muốn chặn thật thì cần hai thứ, cả hai đều nằm ngoài tệp này:
 *   1. Một lớp xác thực trước /api/* (chưa có — trang đang mở cho mọi người).
 *   2. Bộ đếm dùng chung, ví dụ Vercel KV / Upstash Redis, thay cho Map này.
 * Và bất kể chọn gì, hãy đặt Spend limit trên tài khoản OpenAI: đó là lưới an
 * toàn duy nhất không phụ thuộc vào mã nguồn.
 */
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
/* Dọn định kỳ để Map không phình mãi. Bản trước không hề xoá entry cũ: mỗi địa
   chỉ IP mới thêm một ô nhớ và không bao giờ được trả lại, nên một instance
   sống lâu sẽ ngốn bộ nhớ dần cho tới khi bị nền tảng giết. */
const MAX_TRACKED_IPS = 10_000;

function pruneExpired(now: number) {
  for (const [ip, rec] of hits) if (now > rec.resetAt) hits.delete(ip);
  /* Lưới an toàn cuối: nếu vẫn quá đông (bị dội từ rất nhiều IP cùng lúc) thì
     bỏ hẳn, thà mất bộ đếm một nhịp còn hơn để instance chết vì hết bộ nhớ. */
  if (hits.size > MAX_TRACKED_IPS) hits.clear();
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  pruneExpired(now);
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || process.env.AI_PROVIDER || "gemini").toLowerCase();

    const key = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
    if (!key) {
      const varName = provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
      return NextResponse.json(
        { error: `Máy chủ chưa cấu hình ${varName}. Hãy thêm biến môi trường này trên Vercel, hoặc chuyển sang chế độ tự nhập khoá ở thanh bên.` },
        { status: 503 },
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ error: "Bạn đang tạo bài quá nhanh. Vui lòng chờ khoảng một phút rồi thử lại." }, { status: 429 });
    }

    const prompt = String(body?.prompt ?? "");
    if (!prompt.trim()) return NextResponse.json({ error: "Thiếu nội dung yêu cầu." }, { status: 400 });
    if (prompt.length > 400_000) return NextResponse.json({ error: "Tài liệu nguồn quá dài." }, { status: 413 });

    const system = typeof body?.system === "string" && body.system.length > 40 ? body.system : SYSTEM_PROMPT;
    const temperature = body?.temperature === undefined ? 0.25 : Number(body.temperature);

    const model =
      String(body?.model || "") ||
      (provider === "openai"
        ? process.env.OPENAI_MODEL || "gpt-5.4"
        : process.env.GEMINI_MODEL || "models/gemini-2.5-pro");

    const text =
      provider === "openai"
        ? await callOpenAI({ apiKey: key, model, system, user: prompt, temperature })
        : await callGemini({ apiKey: key, model, system, user: prompt, temperature });

    return NextResponse.json({ text, model, provider });
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json(
      { error: err.message || "Lỗi không xác định khi gọi máy chủ AI" },
      { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 500 },
    );
  }
}
