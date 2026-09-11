/**
 * app/api/models/route.ts — Liệt kê mô hình khi khoá nằm trên máy chủ (V11.2)
 *
 * Cho phép giáo viên chọn mô hình trong danh sách thật của tài khoản mà trình
 * duyệt không cần biết khoá. Chỉ trả về tên mô hình, không trả về gì nhạy cảm.
 */

import { NextResponse } from "next/server";
import { scanGeminiModels } from "@/lib/gemini-client";
import { scanOpenAIModels } from "@/lib/openai-client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const provider = (new URL(req.url).searchParams.get("provider") || process.env.AI_PROVIDER || "gemini").toLowerCase();
    const key = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
    if (!key) {
      const varName = provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
      return NextResponse.json({ error: `Máy chủ chưa cấu hình ${varName}.` }, { status: 503 });
    }

    const models =
      provider === "openai"
        ? (await scanOpenAIModels(key)).map((m) => ({ id: m.id, label: m.id }))
        : (await scanGeminiModels(key)).map((m) => ({ id: m.name, label: m.displayName || m.name.replace("models/", "") }));

    return NextResponse.json({ provider, models });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lấy được danh sách mô hình" },
      { status: 500 },
    );
  }
}
