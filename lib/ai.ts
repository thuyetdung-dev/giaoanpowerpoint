/**
 * lib/ai.ts — Lớp điều phối chung cho mọi nhà cung cấp AI (V11.2)
 *
 * Phần mềm nay chạy được với hai nguồn:
 *   • Gemini (Google) — có bậc miễn phí, hợp để dùng thử và dạy hằng ngày.
 *   • OpenAI          — trả phí theo lượng chữ, chất lượng tiếng Việt rất tốt.
 *
 * Mọi thứ KHÔNG phụ thuộc nhà cung cấp đều nằm ở đây: thử lại có giãn cách khi
 * máy chủ bận, vá JSON bị cắt cụt, tự gọi bổ sung khi AI trả thiếu slide, huỷ
 * giữa chừng. Nhờ vậy thêm nhà cung cấp thứ ba sau này chỉ cần viết một bộ nối.
 *
 * HAI CHẾ ĐỘ ĐẶT KHOÁ
 *   1. Khoá trên MÁY CHỦ (khuyến nghị, bắt buộc với OpenAI nếu trang công khai):
 *      khoá nằm trong biến môi trường trên Vercel, trình duyệt không hề thấy.
 *   2. Khoá trong TRÌNH DUYỆT: giáo viên tự dán khoá của mình. Tiện khi mỗi
 *      người dùng khoá riêng, nhưng khoá sẽ lộ với bất kỳ ai mở trang đó.
 */

import type { Lesson, Section } from "./types";
import { SYSTEM_PROMPT, buildUserPrompt, buildTopUpPrompt, type GenerateOptions } from "./prompt";
import { callGemini, scanGeminiModels } from "./gemini-client";
import { callOpenAI, scanOpenAIModels } from "./openai-client";

export type Provider = "gemini" | "openai";

export const PROVIDERS: { id: Provider; label: string; hint: string; keyHint: string; keyUrl: string; keyLinkLabel: string }[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    hint: "Có bậc miễn phí, đủ dùng để soạn bài hằng ngày.",
    keyHint: "Lấy khoá tại aistudio.google.com → Get API key",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyLinkLabel: "Mở Google AI Studio",
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "Trả phí theo lượng chữ. Nên để khoá trên máy chủ, đừng dán vào trình duyệt.",
    keyHint: "Lấy khoá tại platform.openai.com → API keys (khoá bắt đầu bằng sk-)",
    keyUrl: "https://platform.openai.com/api-keys",
    keyLinkLabel: "Mở trang API keys của OpenAI",
  },
];

export type AiModel = { id: string; label: string };

/** Lấy danh sách mô hình thật của tài khoản. */
export async function scanModels(provider: Provider, apiKey: string): Promise<AiModel[]> {
  if (provider === "openai") {
    const list = await scanOpenAIModels(apiKey);
    return list.map((m) => ({ id: m.id, label: m.id }));
  }
  const list = await scanGeminiModels(apiKey);
  return list.map((m) => ({ id: m.name, label: m.displayName || m.name.replace("models/", "") }));
}

/** Lấy danh sách mô hình khi khoá nằm ở máy chủ (trình duyệt không có khoá). */
export async function scanModelsViaServer(provider: Provider): Promise<AiModel[]> {
  const r = await fetch(`/api/models?provider=${provider}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "Máy chủ chưa cấu hình khoá cho nhà cung cấp này");
  return data.models as AiModel[];
}

/* ------------------------------------------------------------------ */
/* Vá JSON                                                             */
/* ------------------------------------------------------------------ */

/** Gỡ ```json ... ``` và vá dấu ngoặc thiếu khi phản hồi bị cắt. */
export function parseLooseJson<T>(raw: string): T {
  let text = String(raw ?? "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = text.search(/[[{]/);
  if (start > 0) text = text.slice(start);
  try {
    return JSON.parse(text) as T;
  } catch {
    let fixed = text.replace(/,\s*$/, "");
    const stack: string[] = [];
    for (const ch of fixed) {
      if (ch === "{" || ch === "[") stack.push(ch);
      else if (ch === "}" || ch === "]") stack.pop();
    }
    if (stack.length) fixed += stack.reverse().map((c) => (c === "{" ? "}" : "]")).join("");
    return JSON.parse(fixed) as T;
  }
}

/* ------------------------------------------------------------------ */
/* Gọi mô hình                                                         */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type CallArgs = {
  provider: Provider;
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
  signal?: AbortSignal;
  /** true = gọi qua /api/generate của chính ứng dụng (khoá nằm ở máy chủ). */
  viaServer?: boolean;
};

async function callOnce(o: CallArgs): Promise<string> {
  if (o.viaServer) {
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: o.provider,
        model: o.model,
        system: o.system,
        prompt: o.user,
        temperature: o.temperature,
      }),
      signal: o.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data?.error || "Máy chủ không phản hồi"), { status: r.status });
    return data.text as string;
  }

  if (!o.apiKey) throw new Error("Chưa có khoá API.");
  const shared = { apiKey: o.apiKey, model: o.model, system: o.system, user: o.user, temperature: o.temperature, signal: o.signal };
  return o.provider === "openai" ? callOpenAI(shared) : callGemini(shared);
}

/** Gọi kèm thử lại có giãn cách cho lỗi tạm thời (429 / 5xx). */
async function callWithRetry(o: CallArgs, onProgress?: (m: string) => void): Promise<string> {
  const delays = [0, 1500, 4000, 9000];
  let lastError: Error | null = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) {
      onProgress?.(`Máy chủ AI đang bận, thử lại sau ${delays[i] / 1000}s… (lần ${i + 1}/${delays.length})`);
      await sleep(delays[i]);
    }
    try {
      return await callOnce(o);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.name === "AbortError") throw err;
      lastError = err;
      const status = err.status ?? 0;
      if ([400, 401, 403, 404].includes(status)) throw err;
      if (status && status !== 429 && status < 500) throw err;
    }
  }
  throw lastError ?? new Error("Không gọi được máy chủ AI");
}

/* ------------------------------------------------------------------ */
/* Sinh bài giảng                                                      */
/* ------------------------------------------------------------------ */

export type GenerateResult = {
  lesson: Lesson;
  modelUsed: string;
  fallbackUsed: boolean;
  topUpRounds: number;
  warnings: string[];
};

export async function generateLesson(
  options: GenerateOptions & {
    provider?: Provider;
    apiKey?: string;
    model: string;
    fallbackModels?: AiModel[];
    viaServer?: boolean;
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
  },
): Promise<GenerateResult> {
  const provider: Provider = options.provider ?? "gemini";
  const { apiKey, model, fallbackModels = [], viaServer, signal, onProgress } = options;

  const choices = [model, ...fallbackModels.map((m) => m.id)]
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .slice(0, 4);

  const warnings: string[] = [];
  let lastError = "Không có mô hình AI nào hoạt động";

  for (let i = 0; i < choices.length; i++) {
    const chosen = choices[i];
    const shortName = chosen.replace("models/", "");
    try {
      onProgress?.(`Đang soạn nội dung với ${shortName}…`);
      const raw = await callWithRetry(
        { provider, apiKey, model: chosen, system: SYSTEM_PROMPT, user: buildUserPrompt(options), temperature: 0.25, signal, viaServer },
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
            { provider, apiKey, model: chosen, system: SYSTEM_PROMPT, user: buildTopUpPrompt(lesson, missing, options), temperature: 0.3, signal, viaServer },
            onProgress,
          );
          const extra = parseLooseJson<{ sections: Section[] }>(extraRaw);
          if (extra?.sections?.length) lesson.sections.push(...extra.sections);
          else break;
        } catch {
          warnings.push("Không bổ sung được số slide còn thiếu.");
          break;
        }
        topUpRounds++;
      }
      if (lesson.sections.length > target) lesson.sections = lesson.sections.slice(0, target);
      if (lesson.sections.length !== target)
        warnings.push(`AI tạo ${lesson.sections.length}/${target} slide nội dung. Bạn có thể tạo lại hoặc giảm số slide dự kiến.`);

      lesson.theme = options.style;
      return { lesson, modelUsed: chosen, fallbackUsed: i > 0, topUpRounds, warnings };
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.name === "AbortError") throw err;
      lastError = err.message || lastError;
      if (/API key|khoá API|permission|invalid|leaked|hết số dư|Billing/i.test(lastError)) throw err;
      warnings.push(`Mô hình ${shortName} không dùng được: ${lastError}`);
    }
  }
  throw new Error(`${lastError}. Đã thử ${choices.length} mô hình nhưng chưa thành công.`);
}
