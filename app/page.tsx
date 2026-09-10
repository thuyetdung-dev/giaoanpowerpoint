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
import { generateLesson, scanGeminiModels, type GeminiModel } from "@/lib/gemini-client";
import type { Lesson, Section, Visual } from "@/lib/types";
import { auditLesson, repairLesson, type AuditItem } from "@/lib/audit";
import { readSource, type SourceDoc } from "@/lib/importer";
import { exportHtml, exportJson, exportPptx, exportPreviewImage, exportWorksheet } from "@/lib/exporters";
import { THEMES, PHASE_META } from "@/lib/themes";

const STORAGE_KEY = "lessonstudio.v11.draft";

type FormState = {
  teacher: string; school: string; grade: string; book: string; lesson: string;
  periods: string; students: string; slideCount: string; style: string; notes: string;
};

const INITIAL: FormState = {
  teacher: "", school: "", grade: "Toán 12", book: "Kết nối tri thức", lesson: "",
  periods: "2", students: "Trung bình - khá", slideCount: "24", style: "academic", notes: "",
};

const PHASES = Object.entries(PHASE_META);

export default function Page() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [documents, setDocuments] = useState<SourceDoc[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [useServerKey, setUseServerKey] = useState(false);
  const [models, setModels] = useState<GeminiModel[]>([]);
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

  const previewRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ---------- Tự lưu / khôi phục ---------- */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { form?: FormState; lesson?: Lesson };
      if (parsed.form) setForm((f) => ({ ...f, ...parsed.form }));
      if (parsed.lesson?.sections?.length) {
        setLesson(parsed.lesson);
        setAudit(auditLesson(parsed.lesson));
        setMessage("Đã khôi phục bài giảng đang soạn dở trên máy này.");
      }
    } catch {
      /* bỏ qua: localStorage có thể bị chặn */
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, lesson }));
      } catch { /* hết dung lượng hoặc chế độ riêng tư */ }
    }, 600);
    return () => clearTimeout(id);
  }, [form, lesson]);

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
  const currentIssues = audit.filter((a) => a.level !== "ok" && (!a.section || a.section === selected + 1));

  /* ---------- Kết nối Gemini ---------- */

  async function scan(): Promise<GeminiModel[]> {
    if (!apiKey.trim()) { setMessage("Vui lòng dán khoá API Gemini, hoặc bật chế độ dùng khoá của nhà trường."); return []; }
    try {
      const found = await scanGeminiModels(apiKey.trim());
      setModels(found);
      if (found[0]) setModel(found[0].name);
      setMessage(`Đã kết nối ${found.length} mô hình. Ưu tiên: ${found[0]?.displayName || found[0]?.name || "—"}`);
      return found;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không kiểm tra được khoá API");
      return [];
    }
  }

  async function importSources(list: FileList | null) {
    if (!list) return;
    setBusy(true);
    const added: SourceDoc[] = [];
    const failed: string[] = [];
    for (const file of Array.from(list).slice(0, 8 - documents.length)) {
      try { added.push(await readSource(file)); }
      catch (e) { failed.push(e instanceof Error ? e.message : file.name); }
    }
    setDocuments((x) => [...x, ...added]);
    setMessage(
      failed.length
        ? `Đã đọc ${added.length} tài liệu. Không đọc được: ${failed.join("; ")}`
        : `Đã đọc ${added.length} tài liệu (${added.reduce((n, d) => n + d.text.length, 0).toLocaleString("vi-VN")} ký tự).`,
    );
    setBusy(false);
  }

  async function importJson(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    try {
      const doc = await readSource(file);
      const parsed = JSON.parse(doc.text) as Lesson;
      if (!parsed.sections) throw new Error("thiếu trường sections");
      applyLesson(parsed);
      setSelected(0);
      setMessage(`Đã nạp bài giảng "${parsed.title}" gồm ${parsed.sections.length} slide.`);
    } catch (e) {
      setMessage(`File JSON không đúng cấu trúc LessonStudio: ${e instanceof Error ? e.message : ""}`);
    }
  }

  async function generate() {
    if (!useServerKey && !apiKey.trim()) { setMessage("Hãy dán khoá API Gemini hoặc bật chế độ dùng khoá của nhà trường."); return; }
    if (!form.lesson.trim() && !documents.length) { setMessage("Hãy nhập tên bài hoặc tải lên tài liệu nguồn."); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setMessage("AI đang xây dựng nội dung slide…");

    try {
      let chosen = model;
      let available = models;
      if (!useServerKey && (chosen === "auto" || available.length < 2)) {
        available = await scan();
        if (!available.length) throw new Error("Không tìm thấy mô hình Gemini phù hợp với khoá này.");
        if (chosen === "auto") chosen = available[0].name;
      }
      if (useServerKey) chosen = "models/gemini-2.5-pro";

      const context = documents
        .map((d, i) => `[TÀI LIỆU ${i + 1}: ${d.name}]\n${d.text}`)
        .join("\n\n")
        .slice(0, 180_000);

      const result = await generateLesson({
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
      applyLesson(repaired);
      setSelected(0);
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

  /* ---------- Xuất bản ---------- */

  async function exportDeck(limitSlides?: number) {
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
        teacher: form.teacher, school: form.school, limitSlides, includeNotes: teacherNotes,
      });
      setMessage(limitSlides ? `Đã xuất bản xem thử ${limitSlides} slide.` : "Đã xuất PowerPoint bài giảng hoàn chỉnh.");
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
  }

  function removeSection() {
    if (!lesson || lesson.sections.length < 2) return;
    const next = structuredClone(lesson);
    next.sections.splice(selected, 1);
    applyLesson(next);
    setSelected(Math.max(0, selected - 1));
  }

  function duplicateSection() {
    if (!lesson) return;
    const next = structuredClone(lesson);
    next.sections.splice(selected + 1, 0, structuredClone(next.sections[selected]));
    applyLesson(next);
    setSelected(selected + 1);
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

  function repair() {
    if (!lesson) return;
    const { lesson: fixed, changes, unresolved } = repairLesson(lesson);
    applyLesson(fixed);
    setMessage(
      [changes.length ? `Đã sửa ${changes.length} mục.` : "Không có mục nào tự sửa được.",
       unresolved.length ? `Còn ${unresolved.length} mục phải sửa tay: ${unresolved[0]}` : ""].filter(Boolean).join(" "),
    );
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
          <label className="check">
            <input type="checkbox" checked={useServerKey} onChange={(e) => setUseServerKey(e.target.checked)} />
            Dùng khoá chung của nhà trường
          </label>
          {!useServerKey && (
            <>
              <label>🔑 Khoá API Gemini
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Dán khoá API" autoComplete="off" />
              </label>
              <div>
                <select value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="auto">Tự động chọn mô hình</option>
                  {models.map((m) => <option key={m.name} value={m.name}>{m.displayName || m.name}</option>)}
                </select>
                <button type="button" onClick={scan}>Dò</button>
              </div>
              <p className="key-note">Khoá chỉ nằm trong trình duyệt của bạn, không gửi về máy chủ LessonStudio.</p>
            </>
          )}
        </div>
      </aside>

      <section className="v9-main" ref={previewRef}>
        <header>
          <div className="triangle">◩</div>
          <div>
            <h1>Trợ lý soạn PowerPoint Toán THPT</h1>
            <p>Phiên bản 11 · Bám Chương trình GDPT 2018 · 16 loại hình Toán · Kiểm định chéo bằng đạo hàm số học</p>
          </div>
        </header>

        {!lesson ? (
          <div className="start-screen">
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

            <h2>2. Mở lại bài giảng đã lưu</h2>
            <label className="upload">
              <input type="file" accept=".json" onChange={(e) => importJson(e.target.files)} />
              <span>⇧ Mở tệp JSON</span>
              <small>Tệp do LessonStudio xuất ra</small>
            </label>

            <h2>3. Yêu cầu riêng</h2>
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
                <button className="trial" onClick={() => exportDeck(10)} disabled={busy}>Xem thử 10 slide</button>
                <button onClick={() => exportDeck()} disabled={busy}>⬇ Xuất PowerPoint</button>
                <button onClick={() => exportHtml(previewRef.current!, lesson)}>Trình chiếu HTML</button>
                <button onClick={() => exportWorksheet(lesson, { teacher: form.teacher, school: form.school })}>Phiếu học tập</button>
                <button onClick={() => exportJson(lesson)}>Lưu JSON</button>
                <button onClick={() => exportPreviewImage(previewRef.current!, lesson.title)}>Ảnh PNG</button>
              </div>
            </div>

            <div className="quality-summary">
              <span className={errors.length ? "bad" : "good"}>
                {errors.length ? `⚠ ${errors.length} lỗi chặn xuất` : "✓ Sẵn sàng xuất PowerPoint"}
              </span>
              {warnings.length > 0 && <span className="warn">{warnings.length} cảnh báo</span>}
              {tips.length > 0 && <span className="tipcount">{tips.length} gợi ý sư phạm</span>}
              <span>{lesson.sections.length} slide</span>
              <span>{lesson.sections.reduce((n, s) => n + (s.visuals?.length || 0), 0)} hình Toán</span>
              <span>{lesson.sections.filter((s) => s.notes?.trim()).length} slide có ghi chú</span>
            </div>

            <div className="editor-grid">
              <nav className="slide-list">
                <h3>Danh sách slide</h3>
                {lesson.sections.map((s, i) => {
                  const count = errors.filter((e) => e.section === i + 1).length;
                  const meta = s.phase ? PHASE_META[s.phase] : undefined;
                  return (
                    <button key={i} className={selected === i ? "selected" : ""} onClick={() => { setSelected(i); setEditing(false); setVisualDraft(null); }}>
                      <b>{String(i + 1).padStart(2, "0")}</b>
                      <span>
                        {s.heading || "Chưa có tiêu đề"}
                        {meta && <em style={{ color: `#${meta.color}` }}>{meta.icon} {meta.label}</em>}
                      </span>
                      <i className={count ? "issue" : "pass"}>{count ? `${count} lỗi` : "Đạt"}</i>
                    </button>
                  );
                })}
              </nav>

              <section className="slide-canvas">
                {current ? (
                  <>
                    <div className="canvas-toolbar">
                      <span>Slide {selected + 1}/{lesson.sections.length}</span>
                      <div className="canvas-tools">
                        <button onClick={() => moveSection(-1)} title="Lên">↑</button>
                        <button onClick={() => moveSection(1)} title="Xuống">↓</button>
                        <button onClick={duplicateSection} title="Nhân bản">⧉</button>
                        <button onClick={removeSection} title="Xoá">🗑</button>
                        <button onClick={() => setEditing((x) => !x)}>{editing ? "✓ Xong" : "✎ Sửa slide"}</button>
                      </div>
                    </div>

                    <article>
                      {editing ? (
                        <div className="edit-form">
                          <label>Tiêu đề slide<input value={current.heading} onChange={(e) => updateSection({ heading: e.target.value })} /></label>
                          <label>Nội dung (mỗi ý một dòng, công thức đặt trong $...$)
                            <textarea rows={6} value={current.content} onChange={(e) => updateSection({ content: e.target.value })} />
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
                            <label>Phút<input type="number" min="0" max="45" value={current.minutes ?? ""} onChange={(e) => updateSection({ minutes: Number(e.target.value) || undefined })} /></label>
                          </div>
                          <label>Ghi chú cho giáo viên (xuất vào Notes của PowerPoint)
                            <textarea rows={4} value={current.notes ?? ""} onChange={(e) => updateSection({ notes: e.target.value })} />
                          </label>
                        </div>
                      ) : (
                        <>
                          <h3>
                            <em>{String(selected + 1).padStart(2, "0")}</em>
                            <MixedMath value={current.heading} />
                          </h3>
                          <p><MixedMath value={current.content} /></p>
                          {current.questions?.length ? (
                            <ul className="questions">
                              {current.questions.map((q, i) => <li key={i}><MixedMath value={q} /></li>)}
                            </ul>
                          ) : null}
                        </>
                      )}

                      <div className="visual-grid">
                        {current.visuals?.map((v, j) => (
                          <div className={`visual-card ${v.type}`} key={j}>
                            <span className="visual-label">
                              {VISUAL_LABEL[v.type] || v.type}
                              <button className="mini" onClick={() => setVisualDraft({ index: j, text: JSON.stringify(v, null, 2) })}>Sửa dữ liệu</button>
                              <button className="mini danger" onClick={() => removeVisual(j)}>Xoá</button>
                            </span>
                            <MathVisual visual={v} />
                          </div>
                        ))}
                      </div>

                      {visualDraft && (
                        <div className="visual-editor">
                          <b>Sửa dữ liệu hình #{visualDraft.index + 1}</b>
                          <textarea rows={12} value={visualDraft.text} onChange={(e) => setVisualDraft({ ...visualDraft, text: e.target.value })} spellCheck={false} />
                          <div>
                            <button onClick={saveVisualDraft}>Áp dụng</button>
                            <button onClick={() => setVisualDraft(null)}>Huỷ</button>
                          </div>
                        </div>
                      )}

                      {current.notes && !editing && (
                        <div className="notes-preview"><b>Ghi chú giáo viên</b><p>{current.notes}</p></div>
                      )}
                    </article>
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

      <div className="v9-status" role="status">{message}</div>
    </main>
  );
}
