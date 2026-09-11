/**
 * lib/gemini-client.ts — Bộ nối Gemini (V11.2)
 *
 * Phần điều phối chung (thử lại, vá JSON, gọi bổ sung slide thiếu) đã chuyển sang
 * lib/ai.ts để dùng chung cho cả Gemini lẫn OpenAI. Tệp này chỉ còn phần riêng
 * của Gemini: đường dẫn, cách xác thực, tên trường trong phản hồi.
 */

import type { Lesson } from "./types";

export type GeminiModel = { name: string; displayName?: string; supportedGenerationMethods?: string[] };

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

export async function scanGeminiModels(apiKey: string): Promise<GeminiModel[]> {
  const response = await fetch(`${ENDPOINT}/models`, { headers: { "x-goog-api-key": apiKey } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Không kiểm tra được khoá API");
  return (data.models || [])
    .filter((m: GeminiModel) =>
      m.name?.startsWith("models/gemini-") &&
      m.supportedGenerationMethods?.includes("generateContent") &&
      !/(image|imagen|veo|embedding|tts|audio|live)/i.test(m.name))
    .sort((a: GeminiModel, b: GeminiModel) => rankGeminiModel(b.name) - rankGeminiModel(a.name));
}

/** Ưu tiên bản pro/mới cho chất lượng nội dung Toán. */
export function rankGeminiModel(name: string): number {
  let s = 0;
  if (/pro/i.test(name)) s += 4;
  if (/flash/i.test(name)) s += 2;
  if (/lite/i.test(name)) s -= 2;
  const v = name.match(/gemini-(\d+(?:\.\d+)?)/);
  if (v) s += Number(v[1]);
  return s;
}

export type GeminiCallArgs = {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
  signal?: AbortSignal;
};

export async function callGemini(args: GeminiCallArgs): Promise<string> {
  const model = args.model.startsWith("models/") ? args.model : `models/${args.model}`;
  const r = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": args.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: [{ role: "user", parts: [{ text: args.user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: args.temperature ?? 0.25,
        maxOutputTokens: 32768,
      },
    }),
    signal: args.signal,
  });
  const data = await r.json();
  if (!r.ok) {
    throw Object.assign(new Error(data?.error?.message || `Mô hình ${model} không phản hồi`), { status: r.status });
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("");
  if (!text) throw new Error(`Mô hình ${model} trả về nội dung trống`);
  return text as string;
}

/* Giữ lại các tên cũ để mã hiện có không phải sửa đồng loạt. */
export { generateLesson, parseLooseJson, type GenerateResult } from "./ai";
export type { Lesson };
