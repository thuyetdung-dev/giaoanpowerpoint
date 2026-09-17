"use client";
/**
 * app/page.tsx — Giao diện trình biên tập (V11)
 *
 * Sửa so với V10:
 *  - V10 nén toàn bộ giao diện vào 2 dòng JSX dài hàng nghìn ký tự => không ai
 *    bảo trì nổi. V11 tách thành các khối có tên, có chú thích.
 *  - Tự lưu bài giảng vào máy (localStorage): V10 làm mới trang là mất trắng.
 *  - Có nút DỪNG khi AI đang chạy (V10 không huỷ được).
 *  - Sửa được DỮ LIỆU HÌNH ngay trên giao diện: V10 chỉ cho sửa tiêu đề và nội dung,
 *    hình sai thì chỉ còn cách tạo lại toàn bộ bài.
 *  - Ghi chú giáo viên, pha hoạt động, thời lượng đều sửa được.
 *  - Vùng dựng ảnh có data-visual-key để bộ xuất ánh xạ hình chính xác.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MathVisual, MixedMath, VISUAL_LABEL } from "@/components/MathVisuals";
import { generateLesson, scanModels, scanModelsViaServer, PROVIDERS, type AiModel, type Provider } from "@/lib/ai";
import type { Lesson, Section, Visual } from "@/lib/types";
import { auditLesson, repairLesson, type AuditItem } from "@/lib/audit";
import { LoiCanOCR, readSource, type SourceDoc } from "@/lib/importer";
import { useOcr } from "./hooks/useOcr";
import { KhungOcr } from "./components/KhungOcr";
import { LibraryPanel } from "./components/LibraryPanel";
import { exportHtml, exportJson, exportPptx, exportPreviewImage, exportWorksheet } from "@/lib/exporters";
import { THEMES, PHASE_META, getTheme } from "@/lib/themes";
import { SlideFrame, Presenter } from "@/components/SlideView";
import { buildDeck, findSlideForSection, outlineDeck } from "@/lib/slides";
import { COMMON_RULES, VISUAL_GUIDE, readVisualJson, sampleFor } from "@/lib/visualguide";
import { promptChoAiNgoai } from "@/lib/prompt";
import { khaoSatHamSo } from "@/lib/khaosat";
import { APP_LABEL } from "@/lib/version";
import {
  duplicateEntry, listLibrary, migrateLegacyDraft, newId, QUOTA_HINT, readActiveId,
  readEntry, readForm, removeEntry, saveEntry, writeActiveId, writeForm, type LibraryMeta,
} from "@/lib/library";

type FormState = {
  teacher: string; school: string; grade: string; book: string; lesson: string;
  periods: string; students: string; slideCount: string; style: string; notes: string;
};

const INITIAL: FormState = {
  teacher: "", school: "", grade: "Toán 12", book: "Kết nối tri thức", lesson: "",
  periods: "2", students: "Trung bình - khá", slideCount: "24", style: "academic", notes: "",
};

const PHASES = Object.entries(PHASE_META);

/** Tên bảng chi tiết mở ra khi bấm vào một ô thống kê. */
const DETAIL_TITLE: Record<string, string> = {
  errors: "Lỗi chặn xuất PowerPoint",
  warnings: "Cảnh báo",
  tips: "Gợi ý sư phạm",
  muc: "Các mục nội dung",
  slide: "Từng slide trong bản xuất",
  visuals: "Các hình Toán trong bài",
  notes: "Các mục có ghi chú cho giáo viên",
  khaosat: "Khảo sát một hàm số và thêm vào bài này",
};



export default function Page() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [documents, setDocuments] = useState<SourceDoc[]>([]);
  /**
   * PDF ẢNH QUÉT đang chờ thầy quyết định có đọc bằng OCR hay không (V12.3).
   * Giữ nguyên đối tượng File để lát nữa còn vẽ từng trang ra ảnh mà đọc.
   */
  /* Nhóm OCR đã dọn sang app/hooks/useOcr.ts — xem ghi chú "vì sao tách" ở đó.
     Nó cần hai đường nối ngược: chỗ hiện thông báo, và chỗ nhận tài liệu đọc xong. */
  const ocr = useOcr({
    baoTin: (s) => setMessage(s),
    nhanTaiLieu: (doc) => setDocuments((x) => [...x, doc]),
  });
  /* Giữ khóa riêng theo nhà cung cấp để không gửi nhầm khóa khi đổi nguồn AI. */
  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({ gemini: "", openai: "" });
  const [showApiKey, setShowApiKey] = useState(false);
  const [useServerKey, setUseServerKey] = useState(false);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [models, setModels] = useState<AiModel[]>([]);
  const [model, setModel] = useState("auto");
  const [message, setMessage] = useState("Sẵn sàng");
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [teacherNotes, setTeacherNotes] = useState(true);
  const [interactive, setInteractive] = useState(true);
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState(false);
  const [visualDraft, setVisualDraft] = useState<{ index: number; text: string } | null>(null);
  const [presenting, setPresenting] = useState<number | null>(null);
  /**
   * Slide đang xem, tính theo đúng thứ tự của bản xuất.
   *
   * -1 nghĩa là "chưa chọn slide cụ thể" — khung xem tự về slide đầu của mục
   * đang chọn. Nhờ vậy khi mở bài khác, xoá hay đổi chỗ mục thì không cần tính
   * lại chỉ số bằng tay: danh sách slide đã đổi mà con số cũ thì thành vô nghĩa.
   */
  const [slideIdx, setSlideIdx] = useState(-1);
  /** "slide" = liệt kê từng slide của bản xuất; "muc" = liệt kê theo mục như V11.8. */
  const [listMode, setListMode] = useState<"slide" | "muc">("slide");
  /** Ô nhập hàm số của nút "Khảo sát hàm số". */
  const [hamSo, setHamSo] = useState("");
  /** Ô thống kê đang mở bảng chi tiết. */
  const [detail, setDetail] = useState<null | "errors" | "warnings" | "tips" | "muc" | "slide" | "visuals" | "notes" | "khaosat">(null);

  /* ---------- Thư viện bài giảng ---------- */
  /** Chỉ mục các bài đã lưu trong trình duyệt này. */
  const [library, setLibrary] = useState<LibraryMeta[]>([]);
  /** Id của bài đang mở; null nghĩa là bài chưa từng được lưu. */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  /** Id đang chờ xác nhận xoá — xoá là mất hẳn nên phải hỏi lại. */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const previewRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ---------- Tự lưu / khôi phục ---------- */

  /** Mở trang: chuyển bản nháp kiểu cũ vào thư viện rồi mở lại bài làm dở gần nhất. */
  useEffect(() => {
    const migrated = migrateLegacyDraft<FormState>();
    const index = listLibrary();
    setLibrary(index);

    const savedForm = readForm<FormState>();
    if (savedForm) setForm((f) => ({ ...f, ...savedForm }));

    const last = migrated ?? readActiveId();
    const entry = last ? readEntry<FormState>(last) : null;
    if (entry) {
      if (entry.form) setForm((f) => ({ ...f, ...entry.form }));
      setLesson(entry.lesson);
      setAudit(auditLesson(entry.lesson));
      setActiveId(last);
      setMessage(`Đã mở lại “${entry.lesson.title}”. Thư viện đang giữ ${index.length} bài.`);
    } else if (index.length) {
      setMessage(`Thư viện có ${index.length} bài giảng đã lưu trên máy này.`);
    }
  }, []);

  /**
   * Tự lưu bài đang mở vào thư viện.
   *
   * Bài chưa có id thì cấp id ngay tại đây, nên một bài vừa sinh ra đã nằm
   * trong thư viện — không cần giáo viên nhớ bấm lưu.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      writeForm(form);
      if (!lesson?.sections?.length) return;

      const id = activeId ?? newId();
      const result = saveEntry(id, form, lesson);
      if (!result.ok) { setMessage(result.error || QUOTA_HINT); return; }

      writeActiveId(id);
      if (!activeId) setActiveId(id);
      setLibrary(listLibrary());
    }, 600);
    return () => clearTimeout(timer);
  }, [form, lesson, activeId]);

  /**
   * Esc đóng ô sửa toàn màn hình.
   *
   * Ô trùm kín màn hình mà không có lối ra bằng bàn phím thì giáo viên dễ tưởng
   * phần mềm treo. Nếu đang mở ô dữ liệu hình thì Esc đóng ô đó trước — mất một
   * đoạn JSON đang gõ dở vì bấm Esc quá tay là điều rất khó chịu.
   */
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (visualDraft) setVisualDraft(null);
      else setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, visualDraft]);

  /* ---------- Tiện ích ---------- */

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const applyLesson = useCallback((next: Lesson) => {
    setLesson(next);
    setAudit(auditLesson(next));
  }, []);

  const errors = useMemo(() => audit.filter((a) => a.level === "error"), [audit]);
  const warnings = useMemo(() => audit.filter((a) => a.level === "warning"), [audit]);
  const tips = useMemo(() => audit.filter((a) => a.level === "tip"), [audit]);
  const current = lesson?.sections[selected];
  const deckMeta = useMemo(() => ({ teacher: form.teacher, school: form.school }), [form.teacher, form.school]);
  const deck = useMemo(() => (lesson ? buildDeck(lesson, deckMeta) : []), [lesson, deckMeta]);
  const outline = useMemo(() => outlineDeck(deck), [deck]);
  /**
   * Slide đang xem. Tự lành lại khi danh sách slide đổi: chỉ số cũ vượt ra
   * ngoài thì quay về slide đầu của mục đang chọn, không bao giờ trỏ vào chỗ
   * không còn tồn tại.
   */
  const deckIndex = useMemo(() => {
    if (!deck.length) return 0;
    if (slideIdx < 0 || slideIdx >= deck.length) return findSlideForSection(deck, selected);
    return slideIdx;
  }, [deck, slideIdx, selected]);
  const spec = deck[deckIndex];
  /** Slide bìa / phân cách / kết được dựng từ dữ liệu chung và vẫn sửa được. */
  const autoSlide = !!spec && spec.kind !== "content";

  /** Chọn theo MỤC: khung xem về slide đầu của mục đó. */
  const pickSection = useCallback((i: number) => {
    setSelected(i);
    setSlideIdx(-1);
    setVisualDraft(null);
  }, []);

  /** Chọn theo SLIDE: xem đúng slide đó, kể cả slide "(tiếp)". */
  const pickSlide = useCallback((i: number) => {
    setSlideIdx(i);
    const s = deck[i];
    if (s && s.kind === "content") setSelected(s.sectionIndex);
    setVisualDraft(null);
  }, [deck]);

  /** Nhảy tới mục số n (1-based, như audit ghi) từ bảng chi tiết. */
  const jumpToSection = useCallback((oneBased: number) => {
    pickSection(Math.max(0, oneBased - 1));
    setDetail(null);
  }, [pickSection]);
  const theme = useMemo(() => getTheme(lesson?.theme), [lesson?.theme]);
  const currentIssues = audit.filter((a) => a.level !== "ok" && (!a.section || a.section === selected + 1));
  const providerInfo = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const apiKey = apiKeys[provider];
  const setApiKey = (value: string) => setApiKeys((old) => ({ ...old, [provider]: value }));

  /* ---------- Kết nối AI: Gemini hoặc OpenAI ---------- */

  /** Lấy danh sách mô hình — từ khoá trong trình duyệt, hoặc từ khoá trên máy chủ. */
  async function scan(): Promise<AiModel[]> {
    try {
      const found = useServerKey
        ? await scanModelsViaServer(provider)
        : apiKey.trim()
        ? await scanModels(provider, apiKey.trim())
        : [];
      if (!found.length) {
        setMessage(useServerKey
          ? "Máy chủ chưa cấu hình khoá cho nhà cung cấp này."
          : "Vui lòng dán khoá API, hoặc bật chế độ dùng khoá của nhà trường.");
        return [];
      }
      setModels(found);
      if (found[0]) setModel(found[0].id);
      setMessage(`Đã kết nối ${found.length} mô hình. Đang dùng: ${found[0]?.label ?? "—"}`);
      return found;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không kiểm tra được khoá");
      return [];
    }
  }


  async function importSources(list: FileList | null) {
    if (!list) return;
    setBusy(true);
    const added: SourceDoc[] = [];
    const failed: string[] = [];
    /* PDF ảnh quét KHÔNG còn bị tính là "không đọc được": nó sang một danh sách
       riêng, kèm nút mời thầy đọc bằng OCR ngay tại chỗ. */
    const quet: { file: File; soTrang: number }[] = [];
    for (const file of Array.from(list).slice(0, 8 - documents.length)) {
      try { added.push(await readSource(file)); }
      catch (e) {
        if (e instanceof LoiCanOCR) quet.push({ file: e.file, soTrang: e.soTrang });
        else failed.push(e instanceof Error ? e.message : file.name);
      }
    }
    setDocuments((x) => [...x, ...added]);
    ocr.themCanOcr(quet);
    const phan: string[] = [];
    if (added.length)
      phan.push(`Đã đọc ${added.length} tài liệu (${added.reduce((n, d) => n + d.text.length, 0).toLocaleString("vi-VN")} ký tự).`);
    if (quet.length)
      phan.push(`${quet.length} tệp là PDF ảnh quét — xem khung bên dưới để đọc bằng OCR.`);
    if (failed.length) phan.push(`Không đọc được: ${failed.join("; ")}`);
    setMessage(phan.join(" ") || "Không có tệp nào được đọc.");
    setBusy(false);
  }

  /**
   * CHÉP PROMPT CHO AI NGOÀI (V12.4).
   *
   * Thầy nạp sách vào Claude / Gemini / ChatGPT / NotebookLM, lấy về tệp JSON,
   * rồi phần mềm này chỉ việc dựng PowerPoint. Prompt sinh ra từ lib/prompt.ts —
   * đúng bộ quy tắc phần mềm gửi cho AI của chính nó — nên không thể lệch với
   * lược đồ dữ liệu. Có nút tải về vì NotebookLM và vài trình duyệt trên máy
   * trường không cho chép vào bộ nhớ tạm.
   */
  async function chepPrompt() {
    const chu = promptChoAiNgoai();
    try {
      await navigator.clipboard.writeText(chu);
      setMessage("Đã chép prompt. Dán vào Claude / Gemini / ChatGPT / NotebookLM, đính kèm sách rồi gửi.");
    } catch {
      taiPrompt();
      setMessage("Trình duyệt không cho chép tự động nên tôi tải prompt về thành tệp .txt — mở ra rồi chép tay.");
    }
  }

  function taiPrompt() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([promptChoAiNgoai()], { type: "text/plain;charset=utf-8" }));
    a.download = "prompt-soan-json-cho-AI.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    try {
      const doc = await readSource(file);
      const parsed = JSON.parse(doc.text) as Lesson;
      if (!parsed.sections) throw new Error("thiếu trường sections");
      // activeId = null để bài nạp vào được lưu thành MỘT MỤC MỚI trong thư viện,
      // không ghi đè lên bài đang mở.
      setActiveId(null);
      applyLesson(parsed);
      setSelected(0);
      setSlideIdx(-1);
      setMessage(`Đã nạp bài giảng "${parsed.title}" gồm ${parsed.sections.length} slide.`);
    } catch (e) {
      setMessage(`File JSON không đúng cấu trúc LessonStudio: ${e instanceof Error ? e.message : ""}`);
    }
  }

  async function generate() {
    if (!useServerKey && !apiKey.trim()) { setMessage("Hãy dán khoá API, hoặc bật chế độ dùng khoá của nhà trường."); return; }
    if (!form.lesson.trim() && !documents.length) { setMessage("Hãy nhập tên bài hoặc tải lên tài liệu nguồn."); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setMessage("AI đang xây dựng nội dung slide…");

    try {
      let chosen = model;
      let available = models;
      if (chosen === "auto" || available.length < 2) {
        available = await scan();
        if (available.length && chosen === "auto") chosen = available[0].id;
      }
      if (chosen === "auto") {
        // Không dò được danh sách (thường do khoá nằm ở máy chủ): để máy chủ tự chọn.
        chosen = "";
      }

      const context = documents
        .map((d, i) => `[TÀI LIỆU ${i + 1}: ${d.name}]\n${d.text}`)
        .join("\n\n")
        .slice(0, 180_000);

      const result = await generateLesson({
        provider,
        apiKey: apiKey.trim(),
        model: chosen,
        fallbackModels: available,
        viaServer: useServerKey,
        signal: controller.signal,
        onProgress: setMessage,
        grade: form.grade,
        book: form.book,
        lessonName: form.lesson,
        periods: form.periods,
        students: form.students,
        slideCount: Number(form.slideCount) || 24,
        style: form.style,
        notes: form.notes,
        includeAnswers,
        includeTeacherNotes: teacherNotes,
        interactive,
        context,
      });

      const { lesson: repaired, changes, unresolved } = repairLesson(result.lesson);
      setActiveId(null); // bài vừa sinh ra là một mục mới trong thư viện
      applyLesson(repaired);
      setSelected(0);
      setSlideIdx(-1);
      setModel(result.modelUsed);

      const report = auditLesson(repaired);
      const parts = [
        result.fallbackUsed ? `Đã chuyển sang ${result.modelUsed.replace("models/", "")}.` : "",
        changes.length ? `Tự chuẩn hoá ${changes.length} chi tiết.` : "",
        unresolved.length ? `⚠ ${unresolved.length} chỗ cần bạn kiểm tra tay.` : "",
        ...result.warnings,
        report.some((x) => x.level === "error")
          ? "Còn lỗi dữ liệu — hãy mở các slide có nhãn đỏ."
          : "Bài giảng sẵn sàng để xuất PowerPoint.",
      ];
      setMessage(parts.filter(Boolean).join(" "));
    } catch (e) {
      const err = e as Error;
      setMessage(err.name === "AbortError" ? "Đã dừng theo yêu cầu." : err.message || "Có lỗi xảy ra");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  /* ---------- Thư viện ---------- */

  /** Dọn trình biên tập, giữ nguyên thông tin thanh bên. Không đụng tới thư viện. */
  const clearEditor = useCallback(() => {
    abortRef.current?.abort();
    setLesson(null);
    setAudit([]);
    setSelected(0);
    setSlideIdx(-1);
    setEditing(false);
    setVisualDraft(null);
    setPresenting(null);
    setBusy(false);
    setActiveId(null);
    writeActiveId(null);
  }, []);

  /**
   * Quay về màn hình khởi đầu để soạn bài khác.
   *
   * V11.3 trở về trước không có hàm này: màn hình khởi đầu chỉ hiện khi `lesson`
   * còn rỗng, mà bản nháp lại tự khôi phục mỗi lần mở trang, nên soạn xong bài
   * đầu tiên là kẹt luôn trong trình biên tập. Từ V11.5 thao tác này không còn
   * nguy hiểm: bài đang soạn đã nằm sẵn trong thư viện, mở lại lúc nào cũng được.
   */
  function startNewLesson() {
    const keptTitle = lesson?.title;
    clearEditor();
    setShowLibrary(false);
    setLibrary(listLibrary());
    setMessage(
      keptTitle
        ? `“${keptTitle}” đã cất vào Thư viện. Nhập tên bài mới rồi bấm TẠO POWERPOINT BÀI GIẢNG.`
        : "Nhập tên bài rồi bấm TẠO POWERPOINT BÀI GIẢNG.",
    );
  }

  /** Mở một bài đã lưu. Bài đang soạn không mất: nó cũng nằm trong thư viện. */
  function openEntry(id: string) {
    const entry = readEntry<FormState>(id);
    if (!entry) {
      setLibrary(listLibrary());
      setMessage("Không mở được bài này — dữ liệu trong trình duyệt đã hỏng hoặc bị xoá.");
      return;
    }
    abortRef.current?.abort();
    if (entry.form) setForm((f) => ({ ...f, ...entry.form }));
    applyLesson(entry.lesson);
    setActiveId(id);
    writeActiveId(id);
    setSelected(0);
    setSlideIdx(-1);
    setEditing(false);
    setVisualDraft(null);
    setPresenting(null);
    setBusy(false);
    setShowLibrary(false);
    setConfirmDelete(null);
    setMessage(`Đã mở “${entry.lesson.title}” (${entry.lesson.sections.length} slide).`);
  }

  function copyEntry(id: string) {
    const copy = duplicateEntry<FormState>(id);
    setLibrary(listLibrary());
    setMessage(copy
      ? "Đã nhân bản. Bản sao dùng để soạn biến thể cho lớp khác mà không động vào bài gốc."
      : "Không nhân bản được — bộ nhớ trình duyệt đã đầy.");
  }

  function deleteEntry(id: string) {
    const gone = library.find((m) => m.id === id)?.title ?? "bài giảng";
    removeEntry(id);
    setConfirmDelete(null);
    if (id === activeId) clearEditor();
    setLibrary(listLibrary());
    setMessage(`Đã xoá “${gone}” khỏi thư viện.`);
  }

  /* ---------- Xuất bản ---------- */

  async function exportDeck() {
    if (!lesson || !previewRef.current) return;
    const report = auditLesson(lesson);
    setAudit(report);
    if (report.some((x) => x.level === "error")) {
      setMessage("Chưa xuất được: còn lỗi dữ liệu hình Toán. Hãy mở slide có nhãn đỏ để sửa.");
      return;
    }
    setBusy(true);
    try {
      await exportPptx(previewRef.current, lesson, {
        teacher: form.teacher, school: form.school, includeNotes: teacherNotes,
      });
      setMessage(`Đã xuất PowerPoint hoàn chỉnh: ${deck.length} slide.`);
    } catch (e) {
      setMessage(`Không xuất được PowerPoint: ${e instanceof Error ? e.message : "lỗi chưa xác định"}.`);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Sửa nội dung ---------- */

  function updateSection(patch: Partial<Section>) {
    if (!lesson) return;
    const next = structuredClone(lesson);
    next.sections[selected] = { ...next.sections[selected], ...patch };
    applyLesson(next);
  }

  function moveSection(delta: number) {
    if (!lesson) return;
    const to = selected + delta;
    if (to < 0 || to >= lesson.sections.length) return;
    const next = structuredClone(lesson);
    const [item] = next.sections.splice(selected, 1);
    next.sections.splice(to, 0, item);
    applyLesson(next);
    setSelected(to);
    setSlideIdx(-1);
  }

  function removeSection() {
    if (!lesson || lesson.sections.length < 2) return;
    const next = structuredClone(lesson);
    next.sections.splice(selected, 1);
    applyLesson(next);
    setSelected(Math.max(0, selected - 1));
    setSlideIdx(-1);
  }

  function duplicateSection() {
    if (!lesson) return;
    const next = structuredClone(lesson);
    next.sections.splice(selected + 1, 0, structuredClone(next.sections[selected]));
    applyLesson(next);
    setSelected(selected + 1);
    setSlideIdx(-1);
  }

  function saveVisualDraft() {
    if (!lesson || !visualDraft) return;
    try {
      const parsed = JSON.parse(visualDraft.text) as Visual;
      const next = structuredClone(lesson);
      const list = next.sections[selected].visuals ?? [];
      list[visualDraft.index] = parsed;
      next.sections[selected].visuals = list;
      applyLesson(next);
      setVisualDraft(null);
      setMessage("Đã cập nhật dữ liệu hình.");
    } catch (e) {
      setMessage(`JSON của hình chưa hợp lệ: ${e instanceof Error ? e.message : ""}`);
    }
  }

  function removeVisual(index: number) {
    if (!lesson) return;
    const next = structuredClone(lesson);
    next.sections[selected].visuals = (next.sections[selected].visuals ?? []).filter((_, i) => i !== index);
    applyLesson(next);
  }

  function updateVisualFontSize(index: number, value: number) {
    if (!lesson) return;
    const next = structuredClone(lesson);
    const visual = next.sections[selected].visuals?.[index];
    if (!visual) return;
    visual.fontSize = Math.max(20, Math.min(48, value || 32));
    applyLesson(next);
  }

  function repair() {
    if (!lesson) return;
    const { lesson: fixed, changes, unresolved } = repairLesson(lesson);
    applyLesson(fixed);
    setMessage(
      [changes.length ? `Đã sửa ${changes.length} mục.` : "Không có mục nào tự sửa được.",
       unresolved.length ? `Còn ${unresolved.length} mục phải sửa tay: ${unresolved[0]}` : ""].filter(Boolean).join(" "),
    );
  }

  /**
   * NÚT "KHẢO SÁT HÀM SỐ" (V12.0).
   *
   * Nhập một dòng hàm số, phần mềm dựng cả bộ slide: tập xác định, đạo hàm viết
   * thành công thức, nghiệm y′ = 0, bảng biến thiên, tiệm cận, đồ thị có điểm
   * cực trị. KHÔNG gọi AI — mọi con số đều tính trực tiếp từ biểu thức, nên
   * không có bước nào cần soi lại.
   */
  function khaoSat() {
    const kq = khaoSatHamSo(hamSo);
    if (!kq.ok) { setMessage(kq.error || "Không khảo sát được hàm số này."); return; }

    const bai: Lesson = lesson
      ? { ...structuredClone(lesson), sections: [...structuredClone(lesson.sections), ...kq.sections] }
      : {
          title: `Khảo sát hàm số y = ${hamSo.trim()}`,
          subject: "Toán", grade: form.grade.replace(/\D+/g, "") || "12", book: form.book,
          objectives: [
            "Lập được bảng biến thiên của hàm số đã cho.",
            "Xác định được các đường tiệm cận và vẽ được đồ thị.",
          ],
          keywords: ["khảo sát hàm số", "bảng biến thiên", "tiệm cận", "đồ thị"],
          sections: kq.sections,
        };
    if (!lesson) setActiveId(null);
    applyLesson(bai);
    setSelected(bai.sections.length - kq.sections.length);
    setSlideIdx(-1);
    setHamSo("");
    setMessage([
      `Đã dựng ${kq.sections.length} slide khảo sát hàm số.`,
      kq.notes.length ? kq.notes.join("; ") + "." : "",
      kq.chuaChac.length ? `Cần thầy xem lại: ${kq.chuaChac.join(" ")}` : "",
    ].filter(Boolean).join(" "));
  }

  /* ---------- Giao diện ---------- */

  return (
    <main className="v9-app">
      <aside className="v9-sidebar">
        <h3>Thông tin bài dạy</h3>
        <label>Tên giáo viên<input value={form.teacher} onChange={set("teacher")} placeholder="Nguyễn Văn A" /></label>
        <label>Trường<input value={form.school} onChange={set("school")} placeholder="THPT ..." /></label>
        <label>Khối lớp
          <select value={form.grade} onChange={set("grade")}>
            <option>Toán 10</option><option>Toán 11</option><option>Toán 12</option>
          </select>
        </label>
        <label>Bộ sách
          <select value={form.book} onChange={set("book")}>
            <option>Kết nối tri thức</option><option>Chân trời sáng tạo</option><option>Cánh Diều</option>
          </select>
        </label>
        <label>Tên bài<input value={form.lesson} onChange={set("lesson")} placeholder="VD: Giá trị lớn nhất, nhỏ nhất của hàm số" /></label>
        <label>Số tiết<input type="number" min="1" max="12" value={form.periods} onChange={set("periods")} /></label>
        <label>Đối tượng học sinh
          <select value={form.students} onChange={set("students")}>
            <option>Cơ bản</option><option>Trung bình - khá</option><option>Khá - giỏi</option><option>Ôn thi TN THPT</option>
          </select>
        </label>
        <label>Số slide dự kiến <b>{form.slideCount}</b>
          <input className="range" type="range" min="10" max="60" value={form.slideCount} onChange={set("slideCount")} />
        </label>
        <label>Bộ chủ đề trình chiếu
          <select value={form.style} onChange={set("style")}>
            {THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <p className="theme-hint">{THEMES.find((t) => t.id === form.style)?.hint}</p>

        <label className="check"><input type="checkbox" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} /> Hiện đáp án trên slide</label>
        <label className="check"><input type="checkbox" checked={teacherNotes} onChange={(e) => setTeacherNotes(e.target.checked)} /> Ghi chú cho giáo viên (vào Notes của PPT)</label>
        <label className="check"><input type="checkbox" checked={interactive} onChange={(e) => setInteractive(e.target.checked)} /> Chèn slide trắc nghiệm tương tác</label>

        <div className="key-box">
          <label>Nguồn AI
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as Provider);
                setModels([]);
                setModel("auto");
                setShowApiKey(false);
                setMessage("Đã đổi nguồn AI. Bấm \u201cDò\u201d để lấy danh sách mô hình.");
              }}
            >
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <p className="key-note">{providerInfo.hint}</p>

          <label className="check">
            <input type="checkbox" checked={useServerKey} onChange={(e) => { setUseServerKey(e.target.checked); setModels([]); setModel("auto"); }} />
            Dùng khoá chung của nhà trường
          </label>

          {useServerKey && (
            <p className="key-note">
              Chế độ này cần khoá AI được cấu hình trên Vercel. Bấm “Dò” để kiểm tra;
              nếu chưa có, phần mềm sẽ cho biết chính xác biến môi trường cần bổ sung.
            </p>
          )}

          {!useServerKey && (
            <>
              <label>🔑 Khoá API {providerInfo.label}</label>
              <div className="provider-key-row">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === "openai" ? "Dán khóa OpenAI (sk-...)" : "Dán khóa Google Gemini"}
                  autoComplete="new-password"
                  aria-label={`Khóa API ${providerInfo.label}`}
                />
                <button type="button" onClick={() => setShowApiKey((v) => !v)} aria-label={`${showApiKey ? "Ẩn" : "Hiện"} khóa API`}>
                  {showApiKey ? "Ẩn" : "Hiện"}
                </button>
                <button type="button" onClick={() => { setApiKey(""); setModels([]); setModel("auto"); setShowApiKey(false); setMessage(`Đã xóa khóa ${providerInfo.label} khỏi phiên này.`); }}>
                  Xóa
                </button>
              </div>
              {provider === "openai" && (
                <p className="key-warn">
                  ⚠ OpenAI tính phí theo mức sử dụng. Chỉ dùng khóa cá nhân trên thiết bị tin cậy.
                  Chỉ cấu hình <code>OPENAI_API_KEY</code> trên Vercel khi website đã có đăng nhập,
                  giới hạn người dùng và hạn mức gọi API.
                </p>
              )}
              <p className="key-note provider-key-help">
                {providerInfo.keyHint}.{" "}
                <a href={providerInfo.keyUrl} target="_blank" rel="noreferrer">{providerInfo.keyLinkLabel} ↗</a>
              </p>
            </>
          )}

          <div>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="auto">Tự động chọn mô hình</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <button type="button" onClick={scan}>Dò</button>
          </div>

          <p className="key-note">
            {useServerKey
              ? "Khoá nằm trên máy chủ và trình duyệt không nhìn thấy. Website công khai phải có kiểm soát truy cập và hạn mức sử dụng."
              : `Khoá chỉ giữ trong bộ nhớ phiên này và được gửi trực tiếp tới ${providerInfo.label}; không lưu vào thư viện bài giảng.`}
          </p>
        </div>
      </aside>

      <section className="v9-main" ref={previewRef}>
        <header>
          <div className="triangle">◩</div>
          <div>
            <h1>Trợ lý soạn PowerPoint Toán THPT</h1>
            <p>{APP_LABEL} · Bám Chương trình GDPT 2018 · 16 loại hình Toán · Kiểm định chéo bằng đạo hàm số học</p>
          </div>
        </header>

        {!lesson ? (
          <div className="start-screen">
            {library.length > 0 && (
              <>
                <h2>Bài giảng đã lưu trên máy này</h2>
                <LibraryPanel
                  items={library}
                  activeId={activeId}
                  confirmDelete={confirmDelete}
                  onOpen={openEntry}
                  onCopy={copyEntry}
                  onAskDelete={setConfirmDelete}
                  onDelete={deleteEntry}
                  onCancelDelete={() => setConfirmDelete(null)}
                />
              </>
            )}

            <h2>1. Tài liệu nguồn (không bắt buộc)</h2>
            <p>PDF, Word, TXT, Markdown hoặc JSON — tối đa 8 tệp, mỗi tệp 20 MB.</p>
            <label className="upload">
              <input type="file" multiple accept=".pdf,.docx,.txt,.md,.json" onChange={(e) => importSources(e.target.files)} />
              <span>⇧ Tải tài liệu</span>
              <small>SGK, SGV, chuyên đề đã kiểm duyệt cho kết quả tốt nhất</small>
            </label>
            {documents.length > 0 && (
              <div className="file-list">
                {documents.map((d, i) => (
                  <span key={i}>✓ {d.name} · {(d.size / 1024 / 1024).toFixed(1)} MB</span>
                ))}
              </div>
            )}
            <KhungOcr ocr={ocr} busy={busy} />
            <h2>2. Mở lại bài giảng đã lưu</h2>
            <label className="upload">
              <input type="file" accept=".json" onChange={(e) => importJson(e.target.files)} />
              <span>⇧ Mở tệp JSON</span>
              <small>Tệp do LessonStudio xuất ra, hoặc tệp do AI khác soạn theo prompt bên dưới</small>
            </label>

            {/* NHỜ AI KHÁC SOẠN JSON — V12.4.
                Cách này không cần khoá API và không cần chờ OCR: AI nào đọc
                được PDF (NotebookLM đọc tốt cả bản scan) đều soạn được tệp
                JSON, phần mềm chỉ việc dựng PowerPoint. */}
            <div className="prompt-box">
              <strong>💡 Chưa có khoá AI? Nhờ Claude, Gemini, ChatGPT hay NotebookLM soạn hộ</strong>
              <p>
                Chép prompt bên dưới, dán vào AI đang dùng, <b>đính kèm sách giáo khoa</b> rồi gửi.
                AI trả về một đoạn JSON — lưu thành tệp <code>.json</code> (Notepad, chọn UTF-8) rồi
                mở bằng nút <b>⇧ Mở tệp JSON</b> ở trên. Phần mềm sẽ tự kiểm tra lại toàn bộ số liệu Toán.
              </p>
              <p className="prompt-ghi">
                NotebookLM đọc được cả PDF ảnh quét nên khỏi cần chạy OCR. Nếu bài dài, AI in chưa hết
                thì gõ <b>tiếp</b> để nó in phần còn lại, rồi ghép hai đoạn lại.
              </p>
              <div className="prompt-nut">
                <button type="button" className="prompt-chep" onClick={chepPrompt}>📋 Chép prompt</button>
                <button type="button" className="prompt-tai" onClick={taiPrompt}>⇩ Tải về tệp .txt</button>
              </div>
            </div>

            <h2>3. Hoặc: khảo sát một hàm số ngay, không cần AI</h2>
            <div className="khaosat-box">
              <label>
                Hàm số y =
                <input value={hamSo} onChange={(e) => setHamSo(e.target.value)}
                       placeholder="(x^2+2*x-2)/(x-1)"
                       onKeyDown={(e) => { if (e.key === "Enter") khaoSat(); }} />
              </label>
              <button className="khaosat" onClick={khaoSat} disabled={!hamSo.trim()}>∫ KHẢO SÁT HÀM SỐ</button>
              <p>
                Phần mềm tự tính tập xác định, đạo hàm, nghiệm $y&apos; = 0$, bảng biến thiên, tiệm cận
                và vẽ đồ thị — <b>không qua AI</b>, nên không có bước nào phải soi lại.
                Viết như máy tính: <code>x^3-3*x+2</code>, <code>(x+1)/(x-1)</code>, <code>sqrt(x+1)</code>.
              </p>
            </div>

            <h2>4. Yêu cầu riêng</h2>
            <textarea value={form.notes} onChange={set("notes")} placeholder="VD: nhấn mạnh bài toán thực tế về lãi kép; dành 2 slide cho sai lầm thường gặp khi xét dấu..." />
            <div className="start-actions">
              <button className="create" onClick={generate} disabled={busy}>
                🚀 {busy ? "ĐANG TẠO BÀI GIẢNG…" : "TẠO POWERPOINT BÀI GIẢNG"}
              </button>
              {busy && <button className="stop" onClick={stop}>■ DỪNG</button>}
            </div>
          </div>
        ) : (
          <div className="deck-preview">
            <div className="preview-toolbar">
              <div>
                <small>TRÌNH BIÊN TẬP · {lesson.sections.length} SLIDE NỘI DUNG</small>
                <h2>
                  {editing
                    ? <input className="title-edit" value={lesson.title} onChange={(e) => applyLesson({ ...lesson, title: e.target.value })} />
                    : <MixedMath value={lesson.title} />}
                </h2>
              </div>
              <div className="export-actions">
                <button
                  className={showLibrary ? "library-btn on" : "library-btn"}
                  onClick={() => { setShowLibrary((x) => !x); setConfirmDelete(null); }}
                >
                  ▤ Thư viện ({library.length})
                </button>
                <button className="newlesson" onClick={startNewLesson}>✚ Bài mới</button>
                <button className="khaosat-btn" onClick={() => setDetail(detail === "khaosat" ? null : "khaosat")}>
                  ∫ Khảo sát hàm số
                </button>
                <button className="present" onClick={() => setPresenting(deckIndex)}>⛶ Trình chiếu</button>
                {/* V11.9: bỏ nút "Xem thử 10 slide". Khung xem trước bên dưới đã là
                    hình ảnh thật của từng slide, và nay danh sách bên trái mở được
                    mọi slide, nên xuất một tệp 10 slide chỉ làm rối. */}
                <button onClick={() => exportDeck()} disabled={busy}>⬇ Xuất PowerPoint</button>
                <button onClick={() => exportHtml(previewRef.current!, lesson)}>Trình chiếu HTML</button>
                <button onClick={() => exportWorksheet(lesson, { teacher: form.teacher, school: form.school })}>Phiếu học tập</button>
                <button onClick={() => exportJson(lesson)}>Lưu JSON</button>
                <button onClick={() => exportPreviewImage(previewRef.current!, lesson.title)}>Ảnh PNG</button>
              </div>
            </div>

            {showLibrary && (
              <LibraryPanel
                items={library}
                activeId={activeId}
                confirmDelete={confirmDelete}
                onOpen={openEntry}
                onCopy={copyEntry}
                onAskDelete={setConfirmDelete}
                onDelete={deleteEntry}
                onCancelDelete={() => setConfirmDelete(null)}
                onClose={() => { setShowLibrary(false); setConfirmDelete(null); }}
              />
            )}

            {/* Mỗi ô thống kê là một NÚT. V11.8 chỉ in con số: thấy "5 gợi ý sư
                phạm" mà không có cách nào biết 5 gợi ý đó là gì, ở slide nào. */}
            <div className="quality-summary">
              <button
                className={`chip ${errors.length ? "bad" : "good"} ${detail === "errors" ? "open" : ""}`}
                onClick={() => setDetail(detail === "errors" ? null : "errors")}
              >
                {errors.length ? `⚠ ${errors.length} lỗi chặn xuất` : "✓ Sẵn sàng xuất PowerPoint"}
              </button>
              {warnings.length > 0 && (
                <button className={`chip warn ${detail === "warnings" ? "open" : ""}`}
                        onClick={() => setDetail(detail === "warnings" ? null : "warnings")}>
                  {warnings.length} cảnh báo
                </button>
              )}
              {tips.length > 0 && (
                <button className={`chip tipcount ${detail === "tips" ? "open" : ""}`}
                        onClick={() => setDetail(detail === "tips" ? null : "tips")}>
                  {tips.length} gợi ý sư phạm
                </button>
              )}
              <button className={`chip ${detail === "muc" ? "open" : ""}`}
                      onClick={() => setDetail(detail === "muc" ? null : "muc")}>
                {lesson.sections.length} mục nội dung
              </button>
              <button className={`chip ${detail === "slide" ? "open" : ""}`}
                      onClick={() => setDetail(detail === "slide" ? null : "slide")}>
                {deck.length} slide khi xuất
              </button>
              <button className={`chip ${detail === "visuals" ? "open" : ""}`}
                      onClick={() => setDetail(detail === "visuals" ? null : "visuals")}>
                {lesson.sections.reduce((n, s) => n + (s.visuals?.length || 0), 0)} hình Toán
              </button>
              <button className={`chip ${detail === "notes" ? "open" : ""}`}
                      onClick={() => setDetail(detail === "notes" ? null : "notes")}>
                {lesson.sections.filter((s) => s.notes?.trim()).length} mục có ghi chú
              </button>
            </div>

            {detail && (
              <div className="detail-panel">
                <div className="detail-head">
                  <b>{DETAIL_TITLE[detail]}</b>
                  <button className="ghost" onClick={() => setDetail(null)}>Đóng</button>
                </div>

                {detail === "khaosat" && (
                  <div className="khaosat-box">
                    <label>
                      Hàm số y =
                      <input value={hamSo} onChange={(e) => setHamSo(e.target.value)}
                             placeholder="(x^2+2*x-2)/(x-1)"
                             onKeyDown={(e) => { if (e.key === "Enter") khaoSat(); }} />
                    </label>
                    <button className="khaosat" onClick={khaoSat} disabled={!hamSo.trim()}>∫ KHẢO SÁT VÀ THÊM SLIDE</button>
                    <p>
                      Thêm 3 slide vào cuối bài: tập xác định + đạo hàm + nghiệm $y&apos; = 0$, bảng biến thiên,
                      tiệm cận + đồ thị. Mọi con số tính trực tiếp từ biểu thức, <b>không qua AI</b>.
                      Viết như máy tính: <code>x^3-3*x+2</code>, <code>(x+1)/(x-1)</code>, <code>sqrt(x+1)</code>.
                    </p>
                  </div>
                )}

                {(detail === "errors" || detail === "warnings" || detail === "tips") && (() => {
                  const list = detail === "errors" ? errors : detail === "warnings" ? warnings : tips;
                  if (!list.length) return <p className="detail-empty">Không có mục nào. Bài giảng sẵn sàng xuất PowerPoint.</p>;
                  return (
                    <ul className="detail-list">
                      {list.map((a, i) => (
                        <li key={i}>
                          <div>
                            <b>{a.section ? `Mục ${a.section}` : "Cả bài"} · {a.code}</b>
                            <p>{a.message}</p>
                            {a.fix && <small>{a.fix}</small>}
                          </div>
                          {a.section && <button onClick={() => jumpToSection(a.section!)}>Mở mục {a.section}</button>}
                        </li>
                      ))}
                    </ul>
                  );
                })()}

                {detail === "muc" && (
                  <ul className="detail-list">
                    {lesson.sections.map((s, i) => {
                      const m = s.phase ? PHASE_META[s.phase] : undefined;
                      const slides = outline.filter((o) => o.sectionIndex === i).length;
                      return (
                        <li key={i}>
                          <div>
                            <b>{String(i + 1).padStart(2, "0")} · {s.heading || "Chưa có tiêu đề"}</b>
                            <small>
                              {m ? `${m.icon} ${m.label} · ` : ""}{slides} slide khi xuất
                              {s.visuals?.length ? ` · ${s.visuals.length} hình` : ""}
                              {s.minutes ? ` · ${s.minutes} phút` : ""}
                              {s.notes?.trim() ? " · có ghi chú" : ""}
                            </small>
                          </div>
                          <button onClick={() => jumpToSection(i + 1)}>Mở</button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {detail === "slide" && (
                  <ul className="detail-list compact">
                    {outline.map((o) => (
                      <li key={o.index}>
                        <div>
                          <b>Slide {o.index + 1} · {o.label}</b>
                          {o.auto && <small>Dữ liệu chung của bài giảng · có thể sửa</small>}
                        </div>
                        <button onClick={() => { pickSlide(o.index); setDetail(null); }}>Xem</button>
                      </li>
                    ))}
                  </ul>
                )}

                {detail === "visuals" && (() => {
                  const rows = lesson.sections.flatMap((s, i) =>
                    (s.visuals ?? []).map((v, j) => ({ i, j, v, heading: s.heading })));
                  if (!rows.length) return <p className="detail-empty">Bài này chưa có hình Toán nào.</p>;
                  return (
                    <ul className="detail-list compact">
                      {rows.map((r) => (
                        <li key={`${r.i}-${r.j}`}>
                          <div>
                            <b>{VISUAL_LABEL[r.v.type] || r.v.type}</b>
                            <small>Mục {r.i + 1} · {r.heading || "Chưa có tiêu đề"}</small>
                          </div>
                          <button onClick={() => jumpToSection(r.i + 1)}>Mở mục {r.i + 1}</button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}

                {detail === "notes" && (() => {
                  const rows = lesson.sections.map((s, i) => ({ i, s })).filter((r) => r.s.notes?.trim());
                  if (!rows.length) return <p className="detail-empty">Chưa mục nào có ghi chú. Ghi chú được xuất vào phần Notes của PowerPoint.</p>;
                  return (
                    <ul className="detail-list">
                      {rows.map((r) => (
                        <li key={r.i}>
                          <div>
                            <b>Mục {r.i + 1} · {r.s.heading || "Chưa có tiêu đề"}</b>
                            <p>{r.s.notes!.trim().slice(0, 180)}{r.s.notes!.trim().length > 180 ? "…" : ""}</p>
                          </div>
                          <button onClick={() => jumpToSection(r.i + 1)}>Mở</button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            )}

            <div className="editor-grid">
              {/* Danh sách slide. Mặc định liệt kê TỪNG slide của bản xuất, vì
                  bài 18 mục xuất ra 74 slide thì 56 slide "(tiếp)" của V11.8
                  không có cách nào mở ra xem trước khi xuất cả tệp. */}
              <nav className="slide-list">
                <div className="list-head">
                  <h3>{listMode === "slide" ? `Danh sách slide · ${deck.length}` : `Danh sách mục · ${lesson.sections.length}`}</h3>
                  <div className="list-switch">
                    <button className={listMode === "slide" ? "on" : ""} onClick={() => setListMode("slide")}>
                      Từng slide
                    </button>
                    <button className={listMode === "muc" ? "on" : ""} onClick={() => setListMode("muc")}>
                      Theo mục
                    </button>
                  </div>
                </div>

                {listMode === "muc"
                  ? lesson.sections.map((s, i) => {
                      const count = errors.filter((e) => e.section === i + 1).length;
                      const meta = s.phase ? PHASE_META[s.phase] : undefined;
                      const slides = outline.filter((o) => o.sectionIndex === i).length;
                      return (
                        <button key={i} className={selected === i ? "selected" : ""}
                                onClick={() => { pickSection(i); setEditing(false); }}>
                          <b>{String(i + 1).padStart(2, "0")}</b>
                          <span>
                            {s.heading || "Chưa có tiêu đề"}
                            <em style={{ color: meta ? `#${meta.color}` : undefined }}>
                              {meta ? `${meta.icon} ${meta.label} · ` : ""}{slides} slide
                            </em>
                          </span>
                          <i className={count ? "issue" : "pass"}>{count ? `${count} lỗi` : "Đạt"}</i>
                        </button>
                      );
                    })
                  : outline.map((o) => {
                      const count = o.sectionIndex === undefined
                        ? 0
                        : errors.filter((e) => e.section === o.sectionIndex! + 1).length;
                      const meta = o.phase ? PHASE_META[o.phase] : undefined;
                      const cls = [
                        deckIndex === o.index ? "selected" : "",
                        o.part ? "cont" : "",
                      ].filter(Boolean).join(" ");
                      return (
                        <button key={o.index} className={cls} onClick={() => { pickSlide(o.index); setEditing(false); }}>
                          <b>{String(o.index + 1).padStart(2, "0")}</b>
                          <span>
                            {o.label}
                            <em style={{ color: meta ? `#${meta.color}` : undefined }}>
                              {o.auto
                                ? (o.kind === "divider" && meta ? `${meta.icon} ${meta.label}` : "Dữ liệu chung")
                                : `Mục ${o.sectionIndex! + 1}${meta ? ` · ${meta.icon} ${meta.label}` : ""}`}
                            </em>
                          </span>
                          {o.auto
                            ? <i className="pass">Sửa được</i>
                            : <i className={count ? "issue" : "pass"}>{count ? `${count} lỗi` : "Đạt"}</i>}
                        </button>
                      );
                    })}
              </nav>

              <section className="slide-canvas">
                {current ? (
                  <>
                    {/* Thanh công cụ: nút ghi rõ chữ, không dùng biểu tượng khó đoán */}
                    <div className="canvas-head">
                      <span className="pos">
                        Slide {deckIndex + 1}/{deck.length}
                        {autoSlide
                          ? ` · ${outline[deckIndex]?.label ?? ""}`
                          : ` · mục ${selected + 1}/${lesson.sections.length}${(outline[deckIndex]?.parts ?? 1) > 1 ? ` · trang ${(outline[deckIndex]?.part ?? 0) + 1}/${outline[deckIndex]?.parts}` : ""}`}
                      </span>
                      {/* Bốn nút này tác động lên cả MỤC. Khi đang xem slide bìa /
                          phân cách / kết thì mục đang chọn không nằm trên màn hình,
                          bấm XOÁ MỤC là xoá mất thứ mình không nhìn thấy — nên chặn. */}
                      <button onClick={() => moveSection(-1)} disabled={autoSlide || selected === 0}>↑ LÊN</button>
                      <button onClick={() => moveSection(1)} disabled={autoSlide || selected === lesson.sections.length - 1}>↓ XUỐNG</button>
                      <button onClick={duplicateSection} disabled={autoSlide}>⧉ NHÂN BẢN</button>
                      <button className="danger" onClick={removeSection} disabled={autoSlide}>🗑 XOÁ MỤC</button>
                      {/* Slide bìa / phân cách / kết không có nội dung để sửa — nút phải
                          nói rõ lý do, đừng để giáo viên bấm rồi không thấy gì xảy ra. */}
                      <button className="edit" onClick={() => setEditing(true)} title="Mở ô sửa toàn màn hình">
                        ✎ SỬA SLIDE
                      </button>
                      <button className="primary" onClick={() => setPresenting(deckIndex)}>⛶ TRÌNH CHIẾU</button>
                    </div>

                    {/* Khung xem trước: đúng khổ 16:9 và đúng bố cục của file PowerPoint xuất ra */}
                    <SlideFrame
                      spec={deck[deckIndex]}
                      lesson={lesson}
                      number={deckIndex + 1}
                      meta={deckMeta}
                      theme={theme}
                    />
                    <p className="slide-hint">
                      {autoSlide ? (
                        <>Bấm <b>SỬA SLIDE</b> để thay đổi dữ liệu chung tạo nên trang này.</>
                      ) : (
                        <>
                          Đây là hình ảnh thật của slide khi trình chiếu — chữ tràn hay hình bị nhỏ đều thấy được ngay tại đây.
                          Bấm <b>TRÌNH CHIẾU</b> để chiếu thử cả bài (mũi tên ←/→ chuyển slide, phím S xem ghi chú, Esc thoát).
                        </>
                      )}
                    </p>

                    {current.notes && !editing && (
                      <div className="notes-preview"><b>Ghi chú giáo viên</b><p>{current.notes}</p></div>
                    )}
                  </>
                ) : (
                  <div className="no-current">Chưa có nội dung để xem</div>
                )}
              </section>

              <aside className="repair-panel">
                <h3>Trợ lý kiểm định</h3>
                {currentIssues.length ? (
                  <>
                    {currentIssues.map((a, i) => (
                      <div className={`issue-card ${a.level}`} key={i}>
                        <b>{a.level === "error" ? "LỖI" : a.level === "warning" ? "CẢNH BÁO" : "GỢI Ý"} · {a.code}</b>
                        <p>{a.message}</p>
                        {a.fix && <small>{a.fix}</small>}
                      </div>
                    ))}
                    <button className="repair" onClick={repair}>⚙ Tự sửa những gì chắc chắn đúng</button>
                    <p className="repair-note">
                      Phần mềm KHÔNG tự điền dấu đạo hàm hay giá trị còn thiếu, vì điền bừa sẽ tạo ra
                      bảng biến thiên sai mà vẫn báo &quot;Đạt&quot;. Hãy bổ sung trường <code>expression</code>
                      cho bảng biến thiên để hệ thống tính lại giúp bạn.
                    </p>
                  </>
                ) : (
                  <div className="all-good"><b>✓ Slide này đạt</b><p>Không phát hiện lỗi cấu trúc hay lỗi dữ liệu hình Toán.</p></div>
                )}
              </aside>
            </div>

            {editing && spec && autoSlide && (
              <div className="edit-full" role="dialog" aria-label="Sửa slide dữ liệu chung">
                <header>
                  <b>Sửa slide {deckIndex + 1}/{deck.length} · {outline[deckIndex]?.label}</b>
                  <span className="ef-hint">Thay đổi được cập nhật ngay trên bản xem trước và PowerPoint.</span>
                  <button className="done" onClick={() => setEditing(false)}>✓ XONG</button>
                </header>
                <div className="ef-body auto-slide-editor">
                  <div className="ef-left">
                    {spec.kind === "cover" && (
                      <>
                        <label>Tên bài giảng
                          <input value={lesson.title} onChange={(e) => applyLesson({ ...lesson, title: e.target.value })} />
                        </label>
                        <label>Tên giáo viên
                          <input value={form.teacher} onChange={set("teacher")} />
                        </label>
                        <label>Trường
                          <input value={form.school} onChange={set("school")} />
                        </label>
                        <label>Khối lớp
                          <input value={lesson.grade ?? ""} onChange={(e) => applyLesson({ ...lesson, grade: e.target.value })} />
                        </label>
                        <label>Bộ sách
                          <input value={lesson.book ?? ""} onChange={(e) => applyLesson({ ...lesson, book: e.target.value })} />
                        </label>
                      </>
                    )}
                    {spec.kind === "objectives" && (
                      <label className="grow">Yêu cầu cần đạt (mỗi yêu cầu một dòng)
                        <textarea value={(lesson.objectives ?? []).join("\n")}
                          onChange={(e) => applyLesson({ ...lesson, objectives: e.target.value.split(/\n+/).map((x) => x.trim()).filter(Boolean) })} />
                      </label>
                    )}
                    {spec.kind === "divider" && (
                      <>
                        <label>Pha hoạt động của trang phân cách
                          <select value={spec.phase} onChange={(e) => {
                            const phase = e.target.value as Section["phase"];
                            applyLesson({ ...lesson, sections: lesson.sections.map((s) => s.phase === spec.phase ? { ...s, phase } : s) });
                          }}>
                            {PHASES.map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}
                          </select>
                        </label>
                        <p className="slide-hint">Đổi pha tại đây sẽ cập nhật tất cả mục đang thuộc cùng pha và tên trang phân cách tương ứng.</p>
                      </>
                    )}
                    {spec.kind === "end" && (
                      <label className="grow">Từ khóa cuối bài (mỗi từ khóa một dòng)
                        <textarea value={(lesson.keywords ?? []).join("\n")}
                          onChange={(e) => applyLesson({ ...lesson, keywords: e.target.value.split(/\n+/).map((x) => x.trim()).filter(Boolean) })} />
                      </label>
                    )}
                  </div>
                  <div className="ef-right">
                    <SlideFrame spec={spec} lesson={lesson} number={deckIndex + 1} meta={deckMeta} theme={theme} />
                    <p className="slide-hint">Đây là bản xem trước trực tiếp của slide đang sửa.</p>
                  </div>
                </div>
              </div>
            )}

            {editing && current && !autoSlide && (
              /**
               * Ô SỬA TOÀN MÀN HÌNH (V11.9).
               *
               * V11.8 nhét ô sửa vào cột giữa, rộng chừng một phần ba màn hình:
               * ô nội dung cao 6 dòng cho một slide có 5 ý kèm công thức, phải
               * cuộn mới đọc hết, và khung xem trước thì trôi lên khỏi tầm mắt.
               * Nay chữ nằm nửa trái, khung slide nửa phải và cập nhật ngay khi gõ.
               */
              <div className="edit-full" role="dialog" aria-label={`Sửa mục ${selected + 1}`}>
                <header>
                  <b>Sửa mục {selected + 1}/{lesson.sections.length} · slide {deckIndex + 1}/{deck.length}</b>
                  <span className="ef-hint">Mọi thay đổi lưu ngay. Bấm Esc hoặc XONG để đóng.</span>
                  <button className="done" onClick={() => { setEditing(false); setVisualDraft(null); }}>✓ XONG</button>
                </header>

                <div className="ef-body">
                  <div className="ef-left">
                    <label>Tiêu đề slide
                      <input value={current.heading} onChange={(e) => updateSection({ heading: e.target.value })} />
                    </label>
                    <div className="font-size-controls">
                      <label>Cỡ tiêu đề (pt)
                        <input type="number" min="20" max="44" value={current.fontSize?.title ?? 32}
                          onChange={(e) => updateSection({ fontSize: { ...current.fontSize, title: Number(e.target.value) || 32 } })} />
                      </label>
                      <label>Cỡ nội dung (pt)
                        <input type="number" min="20" max="48" value={current.fontSize?.body ?? 32}
                          onChange={(e) => updateSection({ fontSize: { ...current.fontSize, body: Number(e.target.value) || 32 } })} />
                      </label>
                    </div>
                    <label className="grow">Nội dung (mỗi ý một dòng, công thức đặt trong $...$)
                      <textarea value={current.content} onChange={(e) => updateSection({ content: e.target.value })} spellCheck={false} />
                    </label>
                    <div className="edit-row">
                      <label>Pha hoạt động
                        <select value={current.phase ?? ""} onChange={(e) => updateSection({ phase: (e.target.value || undefined) as Section["phase"] })}>
                          <option value="">— không đặt —</option>
                          {PHASES.map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}
                        </select>
                      </label>
                      <label>Mức độ
                        <select value={current.level ?? ""} onChange={(e) => updateSection({ level: (e.target.value || undefined) as Section["level"] })}>
                          <option value="">—</option><option>NB</option><option>TH</option><option>VD</option><option>VDC</option>
                        </select>
                      </label>
                      <label>Phút
                        <input type="number" min="0" max="45" value={current.minutes ?? ""} onChange={(e) => updateSection({ minutes: Number(e.target.value) || undefined })} />
                      </label>
                    </div>
                    <label className="notes">Ghi chú cho giáo viên (xuất vào Notes của PowerPoint)
                      <textarea value={current.notes ?? ""} onChange={(e) => updateSection({ notes: e.target.value })} />
                    </label>
                  </div>

                  <div className="ef-right">
                    <div className="ef-preview">
                      <div className="ef-pager">
                        <button onClick={() => pickSlide(Math.max(0, deckIndex - 1))} disabled={deckIndex === 0}>← Slide trước</button>
                        <span>
                          Slide {deckIndex + 1}/{deck.length}
                          {(outline[deckIndex]?.parts ?? 1) > 1 && ` · trang ${(outline[deckIndex]?.part ?? 0) + 1}/${outline[deckIndex]?.parts} của mục này`}
                        </span>
                        <button onClick={() => pickSlide(Math.min(deck.length - 1, deckIndex + 1))} disabled={deckIndex >= deck.length - 1}>Slide sau →</button>
                      </div>
                      <SlideFrame spec={deck[deckIndex]} lesson={lesson} number={deckIndex + 1} meta={deckMeta} theme={theme} />
                      <p className="ef-note">
                        Khung này là hình ảnh thật của slide. Chữ nhiều quá thì phần mềm tự tách sang
                        slide &quot;(tiếp)&quot; — bấm <b>Slide sau</b> để xem, cỡ chữ vẫn giữ 32–36 pt.
                      </p>
                    </div>

                    <div className="ef-visuals">
                      <b>Hình trên mục này</b>
                      {current.visuals?.length ? current.visuals.map((v, j) => (
                        <div className={`visual-row ${visualDraft?.index === j ? "on" : ""}`} key={j}>
                          <span>{j + 1}. {VISUAL_LABEL[v.type] || v.type}</span>
                          <label className="visual-size">Cỡ chữ
                            <input type="number" min="20" max="48" value={v.fontSize ?? 32}
                              onChange={(e) => updateVisualFontSize(j, Number(e.target.value))} />
                          </label>
                          <button onClick={() => setVisualDraft({ index: j, text: JSON.stringify(v, null, 2) })}>✎ SỬA DỮ LIỆU</button>
                          <button className="danger" onClick={() => removeVisual(j)}>🗑 XOÁ HÌNH</button>
                        </div>
                      )) : <p className="ef-empty">Mục này chưa có hình Toán nào.</p>}
                    </div>

                    {visualDraft && (() => {
                      const kind = String((current.visuals?.[visualDraft.index] as { type?: string } | undefined)?.type ?? "");
                      const guide = VISUAL_GUIDE[kind];
                      const check = readVisualJson(visualDraft.text);
                      const mau = sampleFor(kind);
                      return (
                        <div className="visual-editor">
                          <div className="ve-head">
                            <b>Dữ liệu hình #{visualDraft.index + 1} · {VISUAL_LABEL[kind] || kind}</b>
                            <span className={check.ok ? "ve-ok" : "ve-bad"}>{check.ok ? "✓ Dữ liệu đọc được" : "⚠ Chưa đọc được"}</span>
                          </div>

                          <div className="ve-body">
                            <textarea value={visualDraft.text} spellCheck={false}
                                      onChange={(e) => setVisualDraft({ ...visualDraft, text: e.target.value })} />

                            {/* Ô HƯỚNG DẪN — viết cho đúng loại hình đang sửa. */}
                            <aside className="ve-guide">
                              {guide ? (
                                <>
                                  <p className="ve-intro">{guide.intro}</p>
                                  <table>
                                    <tbody>
                                      {guide.fields.map((f) => (
                                        <tr key={f.name} className={f.required ? "req" : ""}>
                                          <th><code>{f.name}</code>{f.required && <em>bắt buộc</em>}</th>
                                          <td>{f.desc}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {guide.notes?.map((n, i) => <p className="ve-tip" key={i}>💡 {n}</p>)}
                                </>
                              ) : (
                                <p className="ve-intro">Chưa có hướng dẫn riêng cho loại hình &quot;{kind}&quot;.</p>
                              )}
                              <details>
                                <summary>Quy tắc chung khi gõ dữ liệu</summary>
                                <ul>{COMMON_RULES.map((r, i) => <li key={i}>{r}</li>)}</ul>
                              </details>
                            </aside>
                          </div>

                          {!check.ok && <p className="ve-error">{check.error}</p>}

                          <div className="ve-actions">
                            <button className="done" onClick={saveVisualDraft} disabled={!check.ok}>Áp dụng</button>
                            {mau && (
                              <button onClick={() => setVisualDraft({ ...visualDraft, text: mau })}
                                      title="Ghi đè ô dữ liệu bằng một ví dụ mẫu đầy đủ, rồi thầy chỉ việc sửa số">
                                ⎘ Chèn mẫu
                              </button>
                            )}
                            <button onClick={() => setVisualDraft({ index: visualDraft.index, text: JSON.stringify(current.visuals?.[visualDraft.index] ?? {}, null, 2) })}>
                              ↺ Lấy lại dữ liệu cũ
                            </button>
                            <button className="ghost" onClick={() => setVisualDraft(null)}>Huỷ</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Vùng dựng ẩn phục vụ xuất ảnh — mỗi hình có khoá riêng để bộ xuất ánh xạ chính xác */}
            <div className="export-staging" aria-hidden="true">
              {lesson.sections.map((s, i) => (
                <article key={i}>
                  <h3>{s.heading}</h3>
                  <p>{s.content}</p>
                  <div className="visual-grid">
                    {s.visuals?.map((v, j) => (
                      <div className={`visual-card ${v.type}`} key={j} data-visual-key={`${i}-${j}`}>
                        <MathVisual visual={v} />
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {presenting !== null && lesson && (
        <Presenter
          deck={deck}
          lesson={lesson}
          meta={deckMeta}
          startAt={presenting}
          onClose={() => setPresenting(null)}
        />
      )}

      <div className="v9-status" role="status">{message}</div>
    </main>
  );
}
