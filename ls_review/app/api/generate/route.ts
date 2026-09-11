/**
 * app/api/generate/route.ts — Tuyến proxy Gemini chạy trên máy chủ (V11)
 *
 * V10 viết tuyến này nhưng KHÔNG chỗ nào gọi tới (mã chết), lại còn chứa một bản
 * prompt thứ hai đã lệch với bản dùng thật ở trình duyệt.
 *
 * V11 dùng tuyến này cho chế độ "khoá dùng chung": nhà trường nạp GEMINI_API_KEY
 * một lần trên Vercel, giáo viên chỉ việc mở web và soạn bài — không cần ai tự
 * đăng ký khoá. Prompt lấy từ lib/prompt.ts để chỉ có một nguồn duy nhất.
 */

import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Chặn lạm dụng đơn giản theo IP (bộ nhớ tiến trình, đủ cho quy mô một trường). */
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

function rateLimited(ip: string): boolean {
  const now = Date.now();
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
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Máy chủ chưa cấu hình GEMINI_API_KEY. Hãy dùng chế độ tự nhập khoá API ở thanh bên." },
        { status: 503 },
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ error: "Bạn đang tạo bài quá nhanh. Vui lòng chờ khoảng một phút rồi thử lại." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt ?? "");
    if (!prompt.trim()) return NextResponse.json({ error: "Thiếu nội dung yêu cầu." }, { status: 400 });
    if (prompt.length > 400_000) return NextResponse.json({ error: "Tài liệu nguồn quá dài." }, { status: 413 });

    const model = String(body?.model || process.env.GEMINI_MODEL || "models/gemini-2.5-pro").replace(/^models\//, "");
    const system = typeof body?.system === "string" && body.system.length > 40 ? body.system : SYSTEM_PROMPT;

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: Number(body?.temperature ?? 0.25),
          maxOutputTokens: 32768,
        },
      }),
    });

    const raw = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: raw?.error?.message || "Gemini trả về lỗi" }, { status: r.status });
    }
    const text = raw?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("");
    if (!text) return NextResponse.json({ error: "Gemini trả về nội dung trống." }, { status: 502 });

    // Trả nguyên văn để phía trình duyệt tự vá & kiểm định (parseLooseJson)
    return NextResponse.json({ text, model });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi không xác định khi gọi Gemini" },
      { status: 500 },
    );
  }
}
