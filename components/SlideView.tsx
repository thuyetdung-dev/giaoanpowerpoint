"use client";
/**
 * components/SlideView.tsx — Khung xem trước đúng như slide PowerPoint (V11.1)
 *
 * Trước đây trình biên tập chỉ hiện một ô chữ. Giáo viên không thể biết trước
 * chữ có tràn slide không, hình có bị bóp nhỏ không — phải xuất file ra rồi mở
 * PowerPoint mới thấy. Tệp này vẽ lại slide theo ĐÚNG bố cục của bộ xuất
 * (lib/slides.ts giữ toạ độ chung, tính bằng inch), rồi thu phóng cho vừa khung.
 *
 * Kèm theo là chế độ TRÌNH CHIẾU TOÀN MÀN HÌNH: mũi tên trái/phải để chuyển
 * slide, phím S bật/tắt ghi chú giáo viên, Esc để thoát.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { APP_LABEL } from "@/lib/version";
import { MathVisual, MixedMath } from "./MathVisuals";
import type { Lesson } from "@/lib/types";
import { getTheme, PHASE_META, VISUAL_LABEL, type Theme } from "@/lib/themes";
import {
  IN, LAYOUT, SLIDE_H_IN, SLIDE_W_IN, TYPO, objectivesBox, textBandBox, visualBox, visualImageBox,
  type Box, type DeckMeta, type SlideSpec,
} from "@/lib/slides";

const px = (inch: number) => inch * IN;
const pt = (p: number) => p * (IN / 72);

/** Thu phóng khung 1280×720 cho vừa chiều ngang của vùng chứa. */
function useFitScale() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () => {
      const w = host.clientWidth;
      if (w > 0) setScale(w / px(SLIDE_W_IN));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  return { hostRef, scale };
}

/* ------------------------------------------------------------------ */
/* Các mảnh của slide                                                  */
/* ------------------------------------------------------------------ */

function Chrome({ t, title, phase, number, titlePt }: { t: Theme; title: string; phase?: string; number: number; titlePt?: number }) {
  const meta = phase ? PHASE_META[phase] : undefined;
  return (
    <>
      <div className="sl-topbar" style={{ background: `#${t.primary}`, height: px(LAYOUT.topBar.h) }} />
      <div
        className="sl-accent"
        style={{
          left: px(LAYOUT.accentBar.x), top: px(LAYOUT.accentBar.y),
          width: px(LAYOUT.accentBar.w), height: px(LAYOUT.accentBar.h),
          background: `#${meta?.color || t.accent}`,
        }}
      />
      <div
        className="sl-title"
        style={{
          left: px(LAYOUT.title.x), top: px(LAYOUT.title.y), height: px(LAYOUT.title.h),
          width: px(LAYOUT.title.wWide),
          fontFamily: `"${t.headFont}", "Times New Roman", Cambria, "Liberation Serif", serif`, fontSize: pt(Math.max(20, Math.min(44, titlePt ?? LAYOUT.title.pt))), color: `#${t.ink}`,
        }}
      >
        <MixedMath value={title} />
      </div>
      <div
        className="sl-pageno"
        style={{
          left: px(LAYOUT.pageNo.x), top: px(LAYOUT.pageNo.y), width: px(LAYOUT.pageNo.w),
          fontSize: pt(LAYOUT.pageNo.pt), color: `#${t.muted}`, fontFamily: `"${t.bodyFont}", sans-serif`,
        }}
      >
        {String(number).padStart(2, "0")}
      </div>
      <div
        className="sl-divider"
        style={{ left: px(LAYOUT.divider.x), top: px(LAYOUT.divider.y), width: px(LAYOUT.divider.w), background: `#${t.line}` }}
      />
    </>
  );
}

function Footer({ t, lesson, sectionNo }: { t: Theme; lesson: Lesson; sectionNo?: number }) {
  return (
    <>
      <div
        className="sl-footer"
        style={{ left: px(0.62), top: px(LAYOUT.footer.y), fontSize: pt(LAYOUT.footer.pt), color: `#${t.muted}`, fontFamily: `"${t.bodyFont}", sans-serif` }}
      >
        {lesson.subject || "Toán"} · Lớp {lesson.grade || "THPT"}
        {lesson.book ? ` · ${lesson.book}` : ""}{sectionNo !== undefined ? ` · Mục ${String(sectionNo + 1).padStart(2, "0")}` : ""}
      </div>
      <div
        className="sl-footer sl-right"
        style={{ right: px(0.62), top: px(LAYOUT.footer.y), fontSize: pt(LAYOUT.footer.pt), color: `#${t.muted}`, fontFamily: `"${t.bodyFont}", sans-serif` }}
      >
        {/* Tên + số phiên bản lấy từ lib/version.ts. Trước V12.5 chỗ này ghi
            CỨNG "LessonStudio V11" nên màn trình chiếu và ảnh xem trước vẫn đề
            V11 sau khi đã nâng lên V12.x — thầy Dũng nhìn vào tưởng gói chưa
            lên. Đây là chỗ CUỐI CÙNG còn ghi cứng; tests.mjs nay quét cả mã
            nguồn để không tệp nào tái phạm. */}
        {APP_LABEL}
      </div>
    </>
  );
}

/**
 * Khối gạch đầu dòng. V11.6 KHÔNG tự tính cỡ chữ ở đây nữa: lib/slides.ts đã
 * chốt cỡ chữ và chia trang khi dựng danh sách slide, nên khung xem trước chỉ
 * việc vẽ lại đúng con số đó. Trước kia mỗi nơi tính một kiểu, dẫn tới xem
 * trước một đằng file xuất ra một nẻo.
 */
function Bullets({ t, items, box, size }: { t: Theme; items: string[]; box: Box; size: number }) {
  if (!items.length) return null;
  return (
    <div
      className="sl-bullets"
      style={{
        left: px(box.x), top: px(box.y), width: px(box.w), height: px(box.h),
        fontSize: pt(size), color: `#${t.ink}`, fontFamily: `"${t.bodyFont}", sans-serif`,
      }}
    >
      {items.length > 1 ? (
        <ul>{items.map((b, i) => <li key={i}><MixedMath value={b} /></li>)}</ul>
      ) : (
        <p><MixedMath value={items[0] || ""} /></p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Một slide                                                           */
/* ------------------------------------------------------------------ */

export function SlideBoard({
  spec, lesson, number, meta, theme,
}: { spec: SlideSpec; lesson: Lesson; number: number; meta?: DeckMeta; theme?: Theme }) {
  const t = theme ?? getTheme(lesson.theme);

  if (spec.kind === "cover") {
    return (
      <div className="sl-body" style={{ background: `#${t.coverBg}` }}>
        <div className="sl-accent" style={{ left: px(0.72), top: px(0.72), width: px(0.18), height: px(5.9), background: `#${t.accent}` }} />
        <div className="sl-abs" style={{ left: px(1.25), top: px(1.0), fontSize: pt(TYPO.coverKicker), letterSpacing: "0.18em", color: `#${t.accent}`, fontWeight: 700, fontFamily: `"${t.bodyFont}", sans-serif` }}>
          BÀI GIẢNG MÔN TOÁN · THPT
        </div>
        <div className="sl-abs sl-covertitle" style={{ left: px(1.25), top: px(1.55), width: px(10.8), height: px(1.9), fontSize: pt(lesson.autoFontSize?.coverTitle ?? TYPO.coverTitle), color: `#${t.coverInk}`, fontFamily: `"${t.headFont}", "Times New Roman", Cambria, "Liberation Serif", serif` }}>
          <MixedMath value={lesson.title} />
        </div>
        <div className="sl-abs" style={{ left: px(1.25), top: px(3.7), width: px(2.2), height: 4, background: `#${t.accent}` }} />
        <div className="sl-abs" style={{ left: px(1.25), top: px(4.05), fontSize: pt(TYPO.coverMeta), color: `#${t.coverInk}`, fontFamily: `"${t.bodyFont}", sans-serif` }}>
          {lesson.subject || "Toán"} &nbsp;|&nbsp; Lớp {lesson.grade || "THPT"}{lesson.book ? ` | ${lesson.book}` : ""}
        </div>
        {meta?.teacher && (
          <div className="sl-abs" style={{ left: px(1.25), top: px(4.7), fontSize: pt(TYPO.coverTeacher), color: `#${t.coverInk}`, fontFamily: `"${t.bodyFont}", sans-serif` }}>
            Giáo viên: {meta.teacher}
          </div>
        )}
        {meta?.school && (
          <div className="sl-abs" style={{ left: px(1.25), top: px(5.25), fontSize: pt(TYPO.coverSchool), color: `#${t.coverInk}`, opacity: 0.8, fontFamily: `"${t.bodyFont}", sans-serif` }}>
            {meta.school}
          </div>
        )}
      </div>
    );
  }

  if (spec.kind === "divider") {
    const m = PHASE_META[spec.phase];
    return (
      <div className="sl-body" style={{ background: `#${t.coverBg}` }}>
        <div className="sl-abs" style={{ left: 0, top: px(3.0), width: px(SLIDE_W_IN), height: px(0.1), background: `#${m?.color || t.accent}` }} />
        <div
          className="sl-abs sl-center"
          style={{ left: 0, top: px(3.25), width: px(SLIDE_W_IN), height: px(1.0), fontSize: pt(lesson.autoFontSize?.divider ?? TYPO.divider), color: `#${t.coverInk}`, letterSpacing: "0.14em", fontWeight: 700, fontFamily: `"${t.headFont}", "Times New Roman", Cambria, "Liberation Serif", serif` }}
        >
          {(m?.label || "Hoạt động").toUpperCase()}
        </div>
      </div>
    );
  }

  if (spec.kind === "end") {
    return (
      <div className="sl-body" style={{ background: `#${t.coverBg}` }}>
        <div className="sl-abs sl-center" style={{ left: px(0.8), top: px(2.9), width: px(11.7), height: px(1.4), fontSize: pt(lesson.autoFontSize?.endTitle ?? TYPO.endTitle), color: `#${t.coverInk}`, fontWeight: 700, fontFamily: `"${t.headFont}", "Times New Roman", Cambria, "Liberation Serif", serif` }}>
          CẢM ƠN CÁC EM ĐÃ THAM GIA TIẾT HỌC
        </div>
        {lesson.keywords?.length ? (
          <div className="sl-abs sl-center" style={{ left: px(0.8), top: px(4.45), width: px(11.7), fontSize: pt(lesson.autoFontSize?.endKeywords ?? TYPO.endKeywords), color: `#${t.accent}`, fontFamily: `"${t.bodyFont}", sans-serif` }}>
            Từ khoá: {lesson.keywords.join(" · ")}
          </div>
        ) : null}
      </div>
    );
  }

  if (spec.kind === "objectives") {
    return (
      <div className="sl-body" style={{ background: `#${t.bg}` }}>
        <Chrome t={t} title={`Yêu cầu cần đạt${spec.part ? " (tiếp)" : ""}`} number={number} titlePt={lesson.autoFontSize?.objectivesTitle} />
        <Footer t={t} lesson={lesson} />
        <Bullets t={t} items={spec.items} size={spec.bodyPt} box={objectivesBox()} />
      </div>
    );
  }

  /* ----- slide nội dung ----- */
  const { section, part, bullets, bodyPt, bandH, visual } = spec;
  const heading = section.heading + (part ? " (tiếp)" : "");
  const band = textBandBox(bandH);
  const vbox = visual ? visualBox(bandH) : null;
  const vimg = vbox ? visualImageBox(vbox) : null;

  return (
    <div className="sl-body" style={{ background: `#${t.bg}` }}>
      <Chrome t={t} title={heading} phase={section.phase} number={number} titlePt={section.fontSize?.title} />
      <Footer t={t} lesson={lesson} sectionNo={spec.sectionIndex} />

      {/* Khối chữ: trải hết bề ngang. Không có hình thì chiếm trọn vùng nội
          dung, có hình thì thành một dải ở trên, cao đúng bằng số dòng cần. */}
      {!visual && (
        <>
          <div
            className="sl-panel"
            style={{
              left: px(LAYOUT.textOnly.box.x), top: px(LAYOUT.textOnly.box.y),
              width: px(LAYOUT.textOnly.box.w), height: px(LAYOUT.textOnly.box.h),
              background: `#${t.surface}`, borderColor: `#${t.line}`,
            }}
          />
          <Bullets
            t={t}
            items={bullets}
            size={bodyPt}
            box={{ x: LAYOUT.textOnly.box.x + 0.33, y: LAYOUT.textOnly.bullets.y, w: LAYOUT.textOnly.box.w - 0.66, h: LAYOUT.textOnly.bullets.h }}
          />
        </>
      )}

      {visual && bandH > 0 && bullets.length > 0 && (
        <>
          <div
            className="sl-panel"
            style={{
              left: px(band.panel.x), top: px(band.panel.y),
              width: px(band.panel.w), height: px(band.panel.h),
              background: `#${t.surface}`, borderColor: `#${t.line}`,
            }}
          />
          <Bullets t={t} items={bullets} size={bodyPt} box={band.bullets} />
        </>
      )}

      {visual && vbox && vimg && (
        <>
          <div
            className="sl-kicker"
            style={{
              left: px(vbox.x + 0.15), top: px(vbox.y),
              fontSize: pt(TYPO.visualLabel), color: `#${t.primary}`, fontFamily: `"${t.bodyFont}", sans-serif`,
            }}
          >
            {VISUAL_LABEL[visual.visual.type] || "HÌNH MINH HOẠ"}
          </div>
          <div
            className="sl-visual"
            style={{ left: px(vimg.x), top: px(vimg.y), width: px(vimg.w), height: px(vimg.h) }}
          >
            <MathVisual visual={visual.visual} />
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Khung xem trước có thu phóng                                        */
/* ------------------------------------------------------------------ */

export function SlideFrame(props: { spec: SlideSpec; lesson: Lesson; number: number; meta?: DeckMeta; theme?: Theme; className?: string }) {
  const { hostRef, scale } = useFitScale();
  return (
    <div className={`sl-frame ${props.className ?? ""}`} ref={hostRef}>
      <div className="sl-stage" style={{ transform: `scale(${scale})`, width: px(SLIDE_W_IN), height: px(SLIDE_H_IN) }}>
        <SlideBoard {...props} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trình chiếu toàn màn hình                                           */
/* ------------------------------------------------------------------ */

export function Presenter({
  deck, lesson, meta, startAt = 0, onClose,
}: { deck: SlideSpec[]; lesson: Lesson; meta?: DeckMeta; startAt?: number; onClose: () => void }) {
  const [i, setI] = useState(startAt);
  const [showNotes, setShowNotes] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const t = getTheme(lesson.theme);

  const go = useCallback((d: number) => setI((k) => Math.max(0, Math.min(deck.length - 1, k + d))), [deck.length]);

  useEffect(() => {
    const el = rootRef.current;
    el?.requestFullscreen?.().catch(() => { /* trình duyệt từ chối thì vẫn chiếu trong cửa sổ */ });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(deck.length - 1);
      else if (e.key.toLowerCase() === "s") setShowNotes((x) => !x);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const onFsChange = () => { if (!document.fullscreenElement) onClose(); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [go, onClose, deck.length]);

  const spec = deck[i];
  const notes =
    spec?.kind === "content"
      ? [spec.section.notes, spec.section.questions?.length ? "Câu hỏi gợi mở: " + spec.section.questions.join(" · ") : ""]
          .filter(Boolean).join("\n")
      : "";

  return (
    <div className="presenter" ref={rootRef} style={{ background: "#0b1016" }}>
      <div className="presenter-stage">
        <SlideFrame spec={spec} lesson={lesson} number={i + 1} meta={meta} theme={t} className="sl-frame-full" />
      </div>

      {showNotes && notes && (
        <div className="presenter-notes"><b>Ghi chú giáo viên</b><p>{notes}</p></div>
      )}

      <div className="presenter-bar">
        <button onClick={() => go(-1)} aria-label="Slide trước">◀ Trước</button>
        <span className="presenter-count">{i + 1} / {deck.length}</span>
        <button onClick={() => go(1)} aria-label="Slide sau">Sau ▶</button>
        <button className="ghost" onClick={() => setShowNotes((x) => !x)}>{showNotes ? "Ẩn ghi chú (S)" : "Ghi chú (S)"}</button>
        <button className="ghost" onClick={onClose}>✕ Thoát (Esc)</button>
      </div>
    </div>
  );
}
