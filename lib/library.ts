/**
 * lib/library.ts — Thư viện bài giảng trong trình duyệt (V11.5)
 *
 * V11.4 trở về trước chỉ giữ MỘT bản nháp duy nhất ở khoá
 * `lessonstudio.v11.draft`. Soạn bài thứ hai là bài thứ nhất bị ghi đè, muốn
 * giữ lại phải nhớ bấm "Lưu JSON" đúng lúc. Giáo viên dạy 3 khối, mỗi khối vài
 * bài một tuần, nên đây là cách làm việc sai thực tế.
 *
 * Bản này lưu NHIỀU bài và mở lại được bất kỳ bài nào.
 *
 * Vì sao tách chỉ mục ra khỏi nội dung
 * ------------------------------------
 * Danh sách bài (`lib.index`) chỉ chứa tiêu đề, khối lớp, số slide và thời điểm
 * sửa — vài trăm byte. Nội dung mỗi bài nằm riêng ở `lib.item.<id>`, thường
 * 30–100 KB. Nhờ vậy:
 *  - Mở trang chỉ đọc và phân tích chỉ mục, không phải nạp toàn bộ thư viện.
 *  - Tự lưu 600 ms một lần chỉ ghi đè đúng bài đang mở.
 *
 * Giới hạn cần biết
 * -----------------
 * localStorage thường chỉ khoảng 5 MB cho mỗi tên miền, và là bộ nhớ của RIÊNG
 * trình duyệt này trên MÁY này: đổi máy, đổi trình duyệt hay xoá dữ liệu duyệt
 * web là mất. Vì vậy mọi hàm ghi ở đây đều trả lỗi tường minh thay vì im lặng,
 * để giao diện kịp nhắc giáo viên xuất tệp JSON làm bản lưu thật.
 */

import type { Lesson } from "./types";

const PREFIX = "lessonstudio.v11.";
const INDEX_KEY = `${PREFIX}lib.index`;
const ACTIVE_KEY = `${PREFIX}lib.active`;
const FORM_KEY = `${PREFIX}form`;
/** Khoá của V11.0–V11.4, chỉ giữ một bản nháp. Được chuyển vào thư viện rồi xoá. */
const LEGACY_KEY = `${PREFIX}draft`;

const itemKey = (id: string) => `${PREFIX}lib.item.${id}`;

/** Thông tin hiển thị trong danh sách thư viện. Không chứa nội dung slide. */
export type LibraryMeta = {
  id: string;
  title: string;
  grade: string;
  book: string;
  slides: number;
  visuals: number;
  updatedAt: number;
};

export type LibraryEntry<F> = { form: F; lesson: Lesson };

/**
 * Kết quả ghi. Cố tình KHÔNG dùng kiểu hợp (`{ok:true} | {ok:false;error:string}`):
 * `tsconfig.json` của dự án đặt `"strict": false`, mà TypeScript chỉ thu hẹp kiểu
 * theo trường phân biệt kiểu boolean khi `strictNullChecks` được bật. Viết kiểu
 * hợp thì `if (!result.ok) result.error` không biên dịch được.
 */
export type SaveResult = { ok: boolean; error?: string };

export const QUOTA_HINT =
  "Bộ nhớ trình duyệt đã đầy. Hãy mở Thư viện, bấm Lưu JSON cho những bài cần giữ rồi xoá bớt bài cũ.";
const BLOCKED_HINT =
  "Trình duyệt đang chặn lưu trữ (cửa sổ ẩn danh?). Bài sẽ mất khi đóng tab — hãy bấm Lưu JSON.";

/* ------------------------------------------------------------------ */
/* Đọc/ghi cơ bản — luôn nuốt lỗi để giao diện không sập vì localStorage */
/* ------------------------------------------------------------------ */

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // không có localStorage, hoặc dữ liệu hỏng
  }
}

function writeJson(key: string, value: unknown): SaveResult {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    // DOMException không kế thừa Error trong trình duyệt, nên đọc `name` trực tiếp.
    const name =
      typeof e === "object" && e !== null && "name" in e
        ? String((e as { name?: unknown }).name)
        : "";
    const quota = name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
    return { ok: false, error: quota ? QUOTA_HINT : BLOCKED_HINT };
  }
}

function drop(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* bỏ qua */ }
}

/* ------------------------------------------------------------------ */
/* Chỉ mục                                                             */
/* ------------------------------------------------------------------ */

export function newId(): string {
  return `ls${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function metaOf(id: string, lesson: Lesson, updatedAt: number): LibraryMeta {
  return {
    id,
    title: lesson.title?.trim() || "Bài giảng chưa đặt tên",
    grade: lesson.grade || "",
    book: lesson.book || "",
    slides: lesson.sections?.length || 0,
    visuals: (lesson.sections || []).reduce((n, s) => n + (s.visuals?.length || 0), 0),
    updatedAt,
  };
}

/** Danh sách bài đã lưu, mới sửa gần nhất đứng đầu. */
export function listLibrary(): LibraryMeta[] {
  const raw = readJson<LibraryMeta[]>(INDEX_KEY);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is LibraryMeta => !!m && typeof m.id === "string")
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function writeIndex(list: LibraryMeta[]): SaveResult {
  return writeJson(INDEX_KEY, list);
}

/* ------------------------------------------------------------------ */
/* Từng bài                                                            */
/* ------------------------------------------------------------------ */

export function readEntry<F>(id: string): LibraryEntry<F> | null {
  const entry = readJson<LibraryEntry<F>>(itemKey(id));
  if (!entry?.lesson?.sections?.length) return null;
  return entry;
}

/**
 * Ghi một bài vào thư viện.
 *
 * Ghi nội dung TRƯỚC, cập nhật chỉ mục SAU. Nếu hết dung lượng giữa chừng thì
 * chỉ mục vẫn khớp với thứ đang thực sự nằm trong bộ nhớ, không sinh ra mục ma
 * bấm vào thì báo "không mở được".
 */
export function saveEntry<F>(id: string, form: F, lesson: Lesson): SaveResult {
  const written = writeJson(itemKey(id), { form, lesson } satisfies LibraryEntry<F>);
  if (!written.ok) return written;

  const list = listLibrary().filter((m) => m.id !== id);
  list.unshift(metaOf(id, lesson, Date.now()));
  return writeIndex(list);
}

export function removeEntry(id: string): void {
  drop(itemKey(id));
  writeIndex(listLibrary().filter((m) => m.id !== id));
  if (readActiveId() === id) writeActiveId(null);
}

/** Nhân bản một bài trong thư viện; trả về id của bản sao, hoặc null nếu hỏng. */
export function duplicateEntry<F>(id: string): string | null {
  const entry = readEntry<F>(id);
  if (!entry) return null;
  const copy: Lesson = structuredClone(entry.lesson);
  copy.title = `${copy.title || "Bài giảng"} (bản sao)`;
  const nid = newId();
  return saveEntry(nid, entry.form, copy).ok ? nid : null;
}

/* ------------------------------------------------------------------ */
/* Bài đang mở & thông tin thanh bên                                   */
/* ------------------------------------------------------------------ */

export function readActiveId(): string | null {
  try { return window.localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function writeActiveId(id: string | null): void {
  if (id === null) { drop(ACTIVE_KEY); return; }
  try { window.localStorage.setItem(ACTIVE_KEY, id); } catch { /* bỏ qua */ }
}

/** Thông tin giáo viên/trường/tuỳ chọn — dùng lại cho bài kế tiếp. */
export function readForm<F>(): Partial<F> | null {
  return readJson<Partial<F>>(FORM_KEY);
}

export function writeForm<F>(form: F): void {
  writeJson(FORM_KEY, form);
}

/* ------------------------------------------------------------------ */
/* Chuyển bản nháp cũ sang thư viện                                    */
/* ------------------------------------------------------------------ */

/**
 * Chuyển bản nháp duy nhất của V11.0–V11.4 thành mục đầu tiên của thư viện.
 * Chạy một lần; trả về id nếu có bài được chuyển.
 */
export function migrateLegacyDraft<F>(): string | null {
  const old = readJson<{ form?: F; lesson?: Lesson }>(LEGACY_KEY);
  if (!old) return null;
  if (!old.lesson?.sections?.length) { drop(LEGACY_KEY); return null; }

  const id = newId();
  const saved = saveEntry(id, (old.form ?? {}) as F, old.lesson);
  if (!saved.ok) return null; // hết chỗ: giữ nguyên bản cũ, không làm mất dữ liệu

  writeActiveId(id);
  drop(LEGACY_KEY);
  return id;
}
