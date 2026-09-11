/**
 * lib/openai-client.ts — Bộ nối OpenAI (V11.2)
 *
 * Vì sao tách riêng khỏi Gemini: hai hãng khác nhau ở đường dẫn, cách xác thực,
 * tên trường và cả những tham số được phép gửi. Gom chung vào một hàm sẽ thành
 * một mớ if/else rất dễ hỏng khi một bên đổi API.
 *
 * LƯU Ý VỀ CHI PHÍ: khác với khoá Gemini miễn phí, khoá OpenAI tính tiền theo
 * lượng chữ. Vì vậy mặc định của phần mềm là để khoá trên MÁY CHỦ (biến môi
 * trường OPENAI_API_KEY trên Vercel), không dán vào trình duyệt — khoá dán vào
 * trình duyệt thì bất kỳ ai mở trang cũng lấy được và tiêu tiền của chủ khoá.
 */

const ENDPOINT = "https://api.openai.com/v1";

export type OpenAIModel = { id: string; owned_by?: string };

/** Các dòng không dùng để sinh văn bản bài giảng. */
const EXCLUDE = /(audio|realtime|tts|whisper|transcribe|embedding|moderation|image|dall-e|sora|codex|search|computer-use|guard)/i;

/**
 * Xếp hạng để chọn mô hình mặc định hợp lý.
 * Cố ý HẠ điểm dòng "pro": chất lượng nhỉnh hơn chút nhưng giá gấp nhiều lần,
 * không đáng cho việc soạn bài giảng hằng ngày.
 */
export function rankOpenAIModel(id: string): number {
  const name = id.toLowerCase();
  let score = 0;
  const version = name.match(/gpt-(\d+(?:\.\d+)?)/);
  if (version) score += Number(version[1]) * 2;
  else if (/^o(\d)/.test(name)) score += Number(name[1]) * 2;
  if (/-pro\b/.test(name)) score -= 7;
  if (/sol|terra/.test(name)) score += 3;
  if (/luna/.test(name)) score += 2;
  if (/mini/.test(name)) score += 1;
  if (/nano/.test(name)) score -= 1;
  if (/preview|instruct|chat-latest|latest/.test(name)) score -= 2;
  return score;
}

/** Lấy danh sách mô hình thật từ tài khoản, không đoán theo tên cứng. */
export async function scanOpenAIModels(apiKey: string): Promise<OpenAIModel[]> {
  const r = await fetch(`${ENDPOINT}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "Không kiểm tra được khoá API OpenAI");
  return ((data.data || []) as OpenAIModel[])
    .filter((m) => /^(gpt|o\d|chatgpt)/i.test(m.id) && !EXCLUDE.test(m.id))
    .sort((a, b) => rankOpenAIModel(b.id) - rankOpenAIModel(a.id));
}

export type OpenAICallArgs = {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
  signal?: AbortSignal;
};

/**
 * Gọi Chat Completions và trả về phần văn bản.
 *
 * Các dòng mô hình suy luận đời mới không nhận `temperature` tuỳ ý và đổi
 * `max_tokens` thành `max_completion_tokens`. Thay vì đoán theo tên mô hình
 * (tên đổi liên tục), hàm này GỬI THỬ rồi TỰ BỎ tham số mà máy chủ than phiền.
 * Cách này sống sót được qua các lần OpenAI đổi API.
 */
export async function callOpenAI(args: OpenAICallArgs): Promise<string> {
  const model = args.model.replace(/^openai\//, "");
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 32768,
  };
  if (args.temperature !== undefined) body.temperature = args.temperature;

  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${ENDPOINT}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${args.apiKey}` },
      body: JSON.stringify(body),
      signal: args.signal,
    });
    const data = await r.json().catch(() => ({}));

    if (r.ok) {
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        const reason = data?.choices?.[0]?.finish_reason;
        throw new Error(
          reason === "length"
            ? "Mô hình trả lời bị cắt vì chạm giới hạn độ dài. Hãy giảm số slide hoặc bớt tài liệu nguồn."
            : `Mô hình ${model} trả về nội dung trống`,
        );
      }
      return text as string;
    }

    const message: string = data?.error?.message || `OpenAI trả lỗi ${r.status}`;
    const param: string | undefined = data?.error?.param;

    // Tự gỡ tham số không được hỗ trợ rồi thử lại
    const offending =
      param && param in body
        ? param
        : /'?max_completion_tokens'?/.test(message) ? "max_completion_tokens"
        : /'?temperature'?/.test(message) ? "temperature"
        : /'?response_format'?/.test(message) ? "response_format"
        : null;

    if (offending && offending in body) {
      delete body[offending];
      if (offending === "max_completion_tokens") body.max_tokens = 32768;
      continue;
    }

    if (r.status === 401) throw new Error("Khoá API OpenAI không hợp lệ hoặc đã bị thu hồi.");
    if (r.status === 403) throw new Error("Khoá API OpenAI không có quyền dùng mô hình này.");
    if (r.status === 404) throw new Error(`Tài khoản của bạn chưa được cấp mô hình "${model}". Hãy bấm "Dò" rồi chọn mô hình khác.`);
    if (r.status === 429) throw Object.assign(new Error("OpenAI báo vượt hạn mức hoặc hết số dư. Kiểm tra mục Billing trong tài khoản OpenAI."), { status: 429 });
    throw Object.assign(new Error(message), { status: r.status });
  }
  throw new Error("Không gọi được OpenAI sau nhiều lần thử.");
}
