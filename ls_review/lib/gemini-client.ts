/**
 * lib/gemini-client.ts — Gọi Gemini (V11)
 *
 * Sửa so với V10:
 *  - Dùng chung prompt trong lib/prompt.ts (V10 có 2 bản prompt lệch nhau).
 *  - Có thể chạy ở chế độ MÁY CHỦ (khoá nằm trên Vercel, học sinh/giáo viên không
 *    cần khoá riêng) hoặc chế độ BYOK (giáo viên tự dán khoá) — V10 chỉ có BYOK
 *    và tuyến API máy chủ viết ra rồi bỏ không dùng.
 *  - Có thử lại với giãn cách khi gặp 429/5xx (V10 gặp 429 là nhảy sang model khác,
 *    thường cũng 429 nốt rồi báo lỗi).
 *  - Vá được JSON bị cắt cụt / bị bọc trong ```json.
 *  - Tự gọi bổ sung khi AI trả thiếu số slide (V10 bắt giáo viên bấm "tạo lại").
 *  - Hỗ trợ AbortSignal để nút "Dừng" hoạt động.
 */

import type { Lesson, Section } from "./types";
import { SYSTEM_PROMPT, buildUserPrompt, buildTopUpPrompt, type GenerateOptions } from "./prompt";

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
    .sort((a: GeminiModel, b: GeminiModel) => rank(b.name) - rank(a.name));
}

/** Ưu tiên bản pro/mới cho chất lượng nội dung Toán. */
function rank(name: string): number {
  let s = 0;
  if (/pro/i.test(name)) s += 4;
  if (/flash/i.test(name)) s += 2;
  if (/lite/i.test(name)) s -= 2;
  const v = name.match(/gemini-(\d+(?:\.\d+)?)/);
  if (v) s += Number(v[1]);
  return s;
}

/** Gỡ ```json ... ``` và vá dấu ngoặc thiếu khi phản hồi bị cắt. */
export function parseLooseJson<T>(raw: string): T {
  let text = String(raw ?? "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = text.search(/[[{]/);
  if (start > 0) text = text.slice(start);
  try {
    return JSON.parse(text) as T;
  } catch {
    // vá ngoặc thiếu do bị cắt giữa chừng
    let fixed = text.replace(/,\s*$/, "");
    const open = (fixed.match(/[[{]/g) || []).length;
    const close = (fixed.match(/[\]}]/g) || []).length;
    const stack: string[] = [];
    for (const ch of fixed) {
      if (ch === "{" || ch === "[") stack.push(ch);
      else if (ch === "}" || ch === "]") stack.pop();
    }
    if (open > close) fixed += stack.reverse().map((c) => (c === "{" ? "}" : "]")).join("");
    return JSON.parse(fixed) as T;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CallOptions = {
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
  signal?: AbortSignal;
  /** true = gọi qua /api/generate của chính ứng dụng (khoá nằm ở máy chủ). */
  viaServer?: boolean;
};

async function callOnce(o: CallOptions): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: o.system }] },
    contents: [{ role: "user", parts: [{ text: o.user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: o.temperature ?? 0.25,
      maxOutputTokens: 32768,
    },
  };

  if (o.viaServer) {
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system: o.system, prompt: o.user, model: o.model, temperature: o.temperature }),
      signal: o.signal,
    });
    const data = await r.json();
    if (!r.ok) throw Object.assign(new Error(data?.error || "Máy chủ không phản hồi"), { status: r.status });
    return data.text as string;
  }

  const r = await fetch(`${ENDPOINT}/${o.model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": o.apiKey! },
    body: JSON.stringify(body),
    signal: o.signal,
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data?.error?.message || `Mô hình ${o.model} không phản hồi`), { status: r.status });
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("");
  if (!text) throw new Error(`Mô hình ${o.model} trả về nội dung trống`);
  return text;
}

/** Gọi kèm thử lại có giãn cách cho lỗi tạm thời. */
async function callWithRetry(o: CallOptions, onProgress?: (m: string) => void): Promise<string> {
  const delays = [0, 1200, 3500, 8000];
  let lastError: Error | null = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) {
      onProgress?.(`Máy chủ Gemini đang bận, thử lại sau ${delays[i] / 1000}s… (lần ${i + 1}/${delays.length})`);
      await sleep(delays[i]);
    }
    try {
      return await callOnce(o);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.name === "AbortError") throw err;
      lastError = err;
      const status = err.status ?? 0;
      // 400/401/403 là lỗi khoá hoặc yêu cầu sai -> dừng ngay
      if ([400, 401, 403].includes(status)) throw err;
      if (status && status !== 429 && status < 500) throw err;
    }
  }
  throw lastError ?? new Error("Không gọi được Gemini");
}

export type GenerateResult = {
  lesson: Lesson;
  modelUsed: string;
  fallbackUsed: boolean;
  topUpRounds: number;
  warnings: string[];
};

export async function generateLesson(
  options: GenerateOptions & {
    apiKey?: string;
    model: string;
    fallbackModels?: GeminiModel[];
    viaServer?: boolean;
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
  },
): Promise<GenerateResult> {
  const { apiKey, model, fallbackModels = [], viaServer, signal, onProgress } = options;
  const choices = [model, ...fallbackModels.map((m) => m.name)]
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .slice(0, 4);

  const warnings: string[] = [];
  let lastError = "Không có mô hình Gemini hoạt động";

  for (let i = 0; i < choices.length; i++) {
    const chosen = choices[i];
    try {
      onProgress?.(`Đang soạn nội dung với ${chosen.replace("models/", "")}…`);
      const raw = await callWithRetry(
        { apiKey, model: chosen, system: SYSTEM_PROMPT, user: buildUserPrompt(options), temperature: 0.25, signal, viaServer },
        onProgress,
      );
      const lesson = parseLooseJson<Lesson>(raw);
      if (!lesson?.sections?.length) throw new Error("Phản hồi không chứa slide nào");

      // Bổ sung nếu thiếu slide, thay vì bắt giáo viên bấm tạo lại từ đầu
      let topUpRounds = 0;
      const target = Math.max(6, options.slideCount - 2);
      while (lesson.sections.length < target * 0.85 && topUpRounds < 2) {
        const missing = target - lesson.sections.length;
        onProgress?.(`Còn thiếu ${missing} slide, đang bổ sung…`);
        try {
          const extraRaw = await callWithRetry(
            { apiKey, model: chosen, system: SYSTEM_PROMPT, user: buildTopUpPrompt(lesson, missing, options), temperature: 0.3, signal, viaServer },
            onProgress,
          );
          const extra = parseLooseJson<{ sections: Section[] }>(extraRaw);
          if (extra?.sections?.length) lesson.sections.push(...extra.sections);
          else break;
        } catch {
          warnings.push("Không bổ sung được số slide còn thiếu; hãy bấm 'Tạo thêm slide' nếu cần.");
          break;
        }
        topUpRounds++;
      }
      if (lesson.sections.length > target) lesson.sections = lesson.sections.slice(0, target);
      if (lesson.sections.length !== target)
        warnings.push(`AI tạo ${lesson.sections.length}/${target} slide nội dung. Bạn có thể bấm "Tạo thêm slide" hoặc giảm số slide dự kiến.`);

      lesson.theme = options.style;
      return { lesson, modelUsed: chosen, fallbackUsed: i > 0, topUpRounds, warnings };
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.name === "AbortError") throw err;
      lastError = err.message || lastError;
      if (/API key|permission|invalid|leaked|API_KEY/i.test(lastError)) throw err;
      warnings.push(`Mô hình ${chosen.replace("models/", "")} không dùng được: ${lastError}`);
    }
  }
  throw new Error(`${lastError}. Đã thử ${choices.length} mô hình nhưng chưa thành công.`);
}
