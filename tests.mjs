import { compileExpression, detectHorizontalAsymptote, detectPoles, numericDerivative } from "./_build/lib/mathexpr.js";
import { latexToUnicode, mixedLatexToUnicode, splitMathSegments } from "./_build/lib/latex.js";
import { computeLevels, tenDaoHam } from "./_build/lib/bbt.js";
import * as Lib from "./_build/lib/library.js";
import { laThuHepMien, solveVariationTable, vietSo } from "./_build/lib/bbtsolve.js";
import { auditLesson, repairLesson } from "./_build/lib/audit.js";
import { buildDeck, isMeaningfulVisual, outlineDeck } from "./_build/lib/slides.js";
import { VISUAL_GUIDE, readVisualJson, sampleFor } from "./_build/lib/visualguide.js";
import { VISUAL_LABEL } from "./_build/lib/themes.js";
import { gocChuan, gocRadian, soVN, ticksFit, ticksFitDoc } from "./_build/lib/plot.js";
import { daoHam } from "./_build/lib/deriv.js";
import { khaoSatHamSo } from "./_build/lib/khaosat.js";
import { APP_LABEL, APP_VERSION } from "./_build/lib/version.js";
import { promptChoAiNgoai, VISUAL_SPEC } from "./_build/lib/prompt.js";
import { docTuOCR, LoiCanOCR } from "./_build/lib/importer.js";
import { ghepTrang, coChuKhong, NGUON_MAC_DINH, TOI_DA_TRANG } from "./_build/lib/ocr.js";
import { createRequire } from "node:module";
const PKG = createRequire(import.meta.url)("./package.json");

let pass=0, fail=0;
const eq=(name,a,b,tol=1e-9)=>{const ok=(typeof a==="number"&&typeof b==="number")?Math.abs(a-b)<=tol:JSON.stringify(a)===JSON.stringify(b);ok?pass++:(fail++,console.log("FAIL",name,"got",JSON.stringify(a),"want",JSON.stringify(b)));};

/* Buộc khớp package.json thay vì ghi cứng số: bản trước ghi "12.2" nên mỗi lần
   lên phiên bản lại phải nhớ sửa tay ở đây. Nay quên là biết ngay. */
eq("nhãn phiên bản khớp package.json",
   [APP_VERSION, APP_LABEL],
   [PKG.version.replace(/\.0$/, ""), `LessonStudio V${PKG.version.replace(/\.0$/, "")}`]);

// --- Lỗi V10: -x^2 gây SyntaxError vì "-x**2" không hợp lệ trong JS
eq("-x^2 tại x=3", compileExpression("-x^2").eval(3), -9);
eq("2^3^2 kết hợp phải", compileExpression("2^3^2").eval(0), 512);
eq("nhân ngầm 2x", compileExpression("2x").eval(5), 10);
eq("nhân ngầm 3(x+1)", compileExpression("3(x+1)").eval(2), 9);
// --- Lỗi V10: chặn hoàn toàn sin/cos/ln/sqrt
eq("sin(pi/2)", compileExpression("sin(pi/2)").eval(0), 1, 1e-12);
eq("sin^2 x + cos^2 x", compileExpression("sin^2(x)+cos^2(x)").eval(1.234), 1, 1e-12);
eq("ln(e)", compileExpression("ln(e)").eval(0), 1, 1e-12);
eq("log 100 = 2 (cơ số 10 theo SGK VN)", compileExpression("log(100)").eval(0), 2, 1e-12);
eq("sqrt(x+1)", compileExpression("sqrt(x+1)").eval(8), 3);
eq("|x-3| tại x=1", compileExpression("|x-3|").eval(1), 2);
eq("căn bậc ba số âm", compileExpression("x^(1/3)").eval(-8), -2, 1e-9);
eq("LaTeX \\frac{1}{x}", compileExpression("\\frac{1}{x}").eval(4), 0.25);
eq("chia 0 -> NaN", Number.isNaN(compileExpression("1/x").eval(0)), true);
eq("chặn mã lạ", compileExpression("alert(1)").ok, false);
eq("chặn hằng toàn cục", compileExpression("globalThis").ok, false);
eq("đạo hàm số học x^3-3x tại 2", numericDerivative("x^3-3*x",2), 9, 1e-4);
eq("dò tiệm cận 1/(x-1)", detectPoles("1/(x-1)",-3,3).map(p=>Math.round(p*100)/100), [1]);

// --- LaTeX: V10 xoá âm thầm mọi lệnh lạ
eq("giữ căn thức", latexToUnicode("\\sqrt{x+1}").text, "√(x+1)");
eq("giữ tích phân", latexToUnicode("\\int_0^1 x dx").text.startsWith("∫₀¹"), true);
eq("phân số đẹp", latexToUnicode("\\frac{1}{2}").text, "½");
eq("mũ unicode", latexToUnicode("x^{2}+y^{3}").text, "x²+y³");
eq("báo lệnh lạ thay vì xoá", latexToUnicode("\\binom{n}{k}").unknownCommands, ["\\binom"]);
eq("LaTeX trần nguyên dòng được nhận là công thức",
   splitMathSegments("\\vec{u} \\cdot \\vec{v} = \\frac{1}{2}")[0].math, true);
eq("LaTeX trần xen câu không còn in mã lệnh",
   mixedLatexToUnicode("Cho \\vec{a} = (1; 2; 3)").text.includes("\\vec"), false);
eq("công thức chỉ có mũi tên là hình giữ chỗ",
   isMeaningfulVisual({ type: "formula", latex: "\\longrightarrow" }), false);
eq("công thức thật vẫn được giữ",
   isMeaningfulVisual({ type: "formula", latex: "x^2+1=0" }), true);
eq("văn bản trộn công thức", mixedLatexToUnicode("Xét $\\sqrt{x}\\geq 0$ với mọi x.").text, "Xét √x≥0 với mọi x.");
eq("không tách y= khỏi phân số", splitMathSegments("Hàm số $y =$ $\\frac{ax+b}{cx+d}$.") , [
  { math:false, value:"Hàm số " },
  { math:true, value:"y = \\frac{ax+b}{cx+d}" },
  { math:false, value:"." },
]);

// --- BBT: chiều mũi tên phải theo dấu y', không theo độ lớn giá trị
const bbt = { type:"variation_table", x:["-\\infty","-1","1","+\\infty"], derivative:["+","0","-","0","+"], values:["-\\infty","4","0","+\\infty"] };
const L = computeLevels(bbt);
eq("BBT tăng-giảm-tăng", [L.right[0]<L.left[1], L.right[1]>L.left[2], L.right[2]<L.left[3]], [true,true,true]);
// Trường hợp V10 vẽ SAI: giá trị cực đại nhỏ hơn giá trị cực tiểu về độ lớn số
const tricky = { type:"variation_table", x:["-\\infty","0","2","+\\infty"], derivative:["+","0","-","0","+"], values:["-\\infty","1","0.9","+\\infty"] };
const T = computeLevels(tricky);
eq("cực đại phải cao hơn cực tiểu dù 1 và 0,9 gần nhau", T.right[1] > T.left[2], true);
// Giá trị dạng chữ (tham số m) — V10 cho rank 0.5 => mũi tên nằm ngang
const symbolic = { type:"variation_table", x:["-\\infty","a","b","+\\infty"], derivative:["-","0","+","0","-"], values:["+\\infty","m","M","-\\infty"] };
const S = computeLevels(symbolic);
eq("giá trị chữ vẫn ra đúng chiều giảm-tăng-giảm", [S.right[0]>S.left[1], S.right[1]<S.left[2], S.right[2]>S.left[3]], [true,true,true]);

// --- Thư viện bài giảng (V11.5): trước đây chỉ giữ được MỘT bản nháp
function fakeStorage(limit=Infinity){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,
  setItem:(k,v)=>{let n=0;for(const[a,b]of m)if(a!==k)n+=a.length+b.length;
    if(n+k.length+String(v).length>limit){const e=new Error("quota");e.name="QuotaExceededError";throw e;}
    m.set(k,String(v));},removeItem:k=>m.delete(k)};}
const mkLesson=(title,n=3)=>({title,grade:"12",book:"Kết nối tri thức",
  sections:Array.from({length:n},(_,i)=>({heading:`H${i}`,content:"x",visuals:[{type:"graph"}]}))});

globalThis.window = { localStorage: fakeStorage() };
const id1 = Lib.newId(); Lib.saveEntry(id1, { teacher:"A" }, mkLesson("Bài 1"));
const id2 = Lib.newId(); Lib.saveEntry(id2, {}, mkLesson("Bài 2", 7));
eq("lưu được nhiều bài cùng lúc", Lib.listLibrary().length, 2);
eq("bài sửa gần nhất đứng đầu", Lib.listLibrary()[0].id, id2);
eq("mở lại đúng nội dung", Lib.readEntry(id2).lesson.sections.length, 7);
eq("sửa bài này không đụng bài kia", (Lib.saveEntry(id2,{},mkLesson("Bài 2 sửa",9)),Lib.readEntry(id1).lesson.title), "Bài 1");
const copy = Lib.duplicateEntry(id1);
eq("nhân bản ra mục riêng", [copy!==id1, Lib.readEntry(copy).lesson.title.endsWith("(bản sao)"), Lib.readEntry(id1).lesson.title], [true,true,"Bài 1"]);
Lib.removeEntry(copy);
eq("xoá đúng một bài", [Lib.listLibrary().length, Lib.readEntry(copy)], [2, null]);

// Bản nháp kiểu cũ phải được chuyển vào thư viện, không bỏ rơi
globalThis.window = { localStorage: fakeStorage() };
window.localStorage.setItem("lessonstudio.v11.draft", JSON.stringify({ form:{teacher:"C"}, lesson: mkLesson("Bài cũ",5) }));
const moved = Lib.migrateLegacyDraft();
eq("chuyển bản nháp V11.4 vào thư viện", [Lib.listLibrary()[0].title, Lib.readActiveId()===moved, window.localStorage.getItem("lessonstudio.v11.draft")], ["Bài cũ", true, null]);
eq("chạy lần hai không nhân đôi", Lib.migrateLegacyDraft(), null);

// Hết dung lượng: phải báo rõ và KHÔNG để lại mục ma trong danh sách
globalThis.window = { localStorage: fakeStorage(1200) };
const small = Lib.newId(); Lib.saveEntry(small, {}, mkLesson("Vừa", 1));
const huge = Lib.newId(); const res = Lib.saveEntry(huge, {}, mkLesson("Quá to", 400));
eq("báo lỗi khi hết dung lượng", [res.ok, /đã đầy/.test(res.error||"")], [false,true]);
eq("không sinh mục ma khi ghi hỏng", [Lib.listLibrary().some(m=>m.id===huge), Lib.readEntry(small).lesson.title], [false,"Vừa"]);

// Trình duyệt chặn lưu trữ (ẩn danh) — giao diện không được sập
globalThis.window = { localStorage: { getItem(){throw new Error("blocked");}, setItem(){const e=new Error("blocked");e.name="SecurityError";throw e;}, removeItem(){throw new Error("blocked");} } };
eq("bị chặn lưu trữ vẫn chạy", [Lib.listLibrary(), Lib.readEntry("x"), Lib.readActiveId(), Lib.saveEntry("x",{},mkLesson("A")).ok], [[],null,null,false]);

// Dữ liệu hỏng không làm sập danh sách
globalThis.window = { localStorage: fakeStorage() };
window.localStorage.setItem("lessonstudio.v11.lib.index", "{không phải JSON");
eq("chỉ mục hỏng -> danh sách rỗng", Lib.listLibrary(), []);
window.localStorage.setItem("lessonstudio.v11.lib.index", JSON.stringify([null,{id:"a",updatedAt:1},5]));
eq("bỏ qua mục rác trong chỉ mục", Lib.listLibrary().length, 1);



// --- V11.8: bảng biến thiên của hàm có tiệm cận đứng ---
// y = (x+1)/(x-1): nhánh trái đi từ 1 XUỐNG -∞, nhánh phải từ +∞ XUỐNG 1.
// Hai số 1 bằng nhau nhưng một cái là đỉnh nhánh trái, một cái là đáy nhánh phải.
const bbtPhanThuc = {
  type: "variation_table", label: "y", expression: "(x+1)/(x-1)",
  x: ["-\\infty", "1", "+\\infty"], derivative: ["-", "||", "-"], values: ["1", "", "1"],
  discontinuities: [{ index: 1, leftValue: "-\\infty", rightValue: "+\\infty" }],
};
const P = computeLevels(bbtPhanThuc);
eq("nhánh trái: 1 ở ĐỈNH", P.right[0], 1);
eq("nhánh trái: -∞ ở ĐÁY", P.left[1], 0);
eq("nhánh phải: +∞ ở ĐỈNH", P.right[1], 1);
eq("nhánh phải: 1 ở ĐÁY", P.left[2], 0);

// y = (x²-x+1)/(x+1): nhánh trái -∞ → cực đại → -∞, nhánh phải +∞ → cực tiểu → +∞
const bbtHaiNhanh = {
  type: "variation_table", label: "y", expression: "(x^2-x+1)/(x+1)",
  x: ["-\\infty", "-2.73", "-1", "0.73", "+\\infty"],
  derivative: ["+", "0", "-", "||", "-", "0", "+"],
  values: ["-\\infty", "-6.46", "", "0.46", "+\\infty"],
  discontinuities: [{ index: 2, leftValue: "-\\infty", rightValue: "+\\infty" }],
};
const Q = computeLevels(bbtHaiNhanh);
eq("nhánh trái: cực đại cao hơn hai đầu", Q.right[1] > Q.right[0] && Q.right[1] > Q.left[2], true);
eq("nhánh phải: cực tiểu thấp hơn hai đầu", Q.right[3] < Q.right[2] && Q.right[3] < Q.left[4], true);
eq("hai nhánh dùng thang riêng, không dính nhau", Q.right[0] === 0 && Q.right[2] === 1, true);


// --- V11.8: tự dựng bảng biến thiên từ biểu thức ---
// Chính hàm mà bộ sinh nội dung làm sai trong bài giảng Bài 4.
const T1 = solveVariationTable("(x^2-x+1)/(x+1)");
eq("giải được BBT hàm bậc hai/bậc nhất", T1.ok, true);
eq("mốc x đúng dạng căn", T1.x, ["-\\infty", "-1 - \\sqrt{3}", "-1", "-1 + \\sqrt{3}", "+\\infty"]);
eq("giá trị cực trị đúng", [T1.values[1], T1.values[3]], ["-3 - 2\\sqrt{3}", "-3 + 2\\sqrt{3}"]);
eq("nhận ra tiệm cận đứng x = -1", T1.discontinuities.map((d) => d.index), [2]);
eq("hai bên tiệm cận là -∞ và +∞", [T1.discontinuities[0].leftValue, T1.discontinuities[0].rightValue], ["-\\infty", "+\\infty"]);

const T2 = solveVariationTable("(x+1)/(x-1)");
eq("hàm nhất biến: không có cực trị", T2.derivative, ["-", "||", "-"]);
eq("hàm nhất biến: giới hạn hai đầu là 1", [T2.values[0], T2.values[2]], ["1", "1"]);

const T3 = solveVariationTable("x^3-3x+2");
eq("đa thức bậc ba: hai cực trị", T3.x, ["-\\infty", "-1", "1", "+\\infty"]);
eq("đa thức bậc ba: giá trị cực trị", [T3.values[1], T3.values[2]], ["4", "0"]);

eq("căn được rút gọn: √12 -> 2√3", vietSo(-3 - Math.sqrt(12)), "-3 - 2\\sqrt{3}");
eq("biểu thức hỏng thì KHÔNG đoán bừa", solveVariationTable("alert(1)").ok, false);

// V11.8: dò tiệm cận đứng không còn phụ thuộc may rủi của lưới quét
eq("dò tiệm cận trên khoảng rộng", detectPoles("1/(x-1)", -40, 40, 3000).map((p) => Math.round(p * 1000) / 1000), [1]);
eq("không nhầm nghiệm thành tiệm cận", detectPoles("x^3-3x", -40, 40, 3000), []);

// --- V11.8: bộ kiểm định phải bắt được BẢNG SAI MỐC, không chỉ sai dấu ---
// Đây chính là lỗ mà bản V11.7 để lọt: dấu y′ trên từng khoảng vẫn đúng nên
// không có cảnh báo nào, trong khi mốc cực trị hoàn toàn sai.
const codesOf = (visual) =>
  auditLesson({
    title: "Kiểm thử",
    sections: [{ heading: "Slide kiểm thử", content: "Một câu nội dung đủ dài để không bị coi là slide trống.", visuals: [visual] }],
  }).map((i) => i.code);

const bbtSaiMoc = {
  type: "variation_table", label: "y", expression: "(x^2-x+1)/(x+1)",
  x: ["-\\infty", "0", "-1", "1", "+\\infty"],
  derivative: ["+", "0", "-", "||", "-", "0", "+"],
  values: ["-\\infty", "1", "", "\\frac{1}{2}", "+\\infty"],
  discontinuities: [{ index: 2, leftValue: "-\\infty", rightValue: "+\\infty" }],
};
eq("bắt được mốc không phải nghiệm y′", codesOf(bbtSaiMoc).includes("BBT_NODE_NOT_ROOT"), true);

const bbtDungMoc = { type: "variation_table", label: "y", expression: "x^3-3x+2", ...(() => {
  const T = solveVariationTable("x^3-3x+2");
  return { x: T.x, derivative: T.derivative, values: T.values, discontinuities: T.discontinuities };
})() };
eq("bảng đúng thì không bị báo oan", codesOf(bbtDungMoc).some((c) => c.startsWith("BBT_")), false);

// Giá trị dạng căn phải được đối chiếu, không bị bỏ qua im lặng.
const bbtSaiGiaTri = (() => {
  const T = solveVariationTable("(x^2-x+1)/(x+1)");
  return { type: "variation_table", label: "y", expression: "(x^2-x+1)/(x+1)", x: T.x, derivative: T.derivative,
           values: [T.values[0], "-3 - 2\\sqrt{5}", T.values[2], T.values[3], T.values[4]],
           discontinuities: T.discontinuities };
})();
eq("đối chiếu được giá trị viết bằng căn", codesOf(bbtSaiGiaTri).includes("BBT_VALUE_MISMATCH"), true);

// Đồ thị: danh sách nhiều đường bỏ quên hàm chính.
eq(
  "nhắc khi danh sách đường thiếu hàm chính",
  codesOf({ type: "graph", expression: "x^2", expressions: [{ expression: "2x+1" }], xMin: -3, xMax: 3, yMin: -3, yMax: 9 })
    .includes("GRAPH_MAIN_CURVE"),
  true,
);
eq(
  "không nhắc khi hàm chính đã có trong danh sách",
  codesOf({ type: "graph", expression: "x^2", expressions: [{ expression: "x^2" }, { expression: "2x+1" }], xMin: -3, xMax: 3, yMin: -3, yMax: 9 })
    .includes("GRAPH_MAIN_CURVE"),
  false,
);

// --- V11.8: "Tự sửa" phải DỰNG LẠI bảng sai từ biểu thức, không hỏi lại ---
const baiSai = {
  title: "Khảo sát hàm số",
  sections: [{
    heading: "Ví dụ", content: "Khảo sát hàm số đã cho rồi lập bảng biến thiên.",
    visuals: [{
      type: "variation_table", label: "y", expression: "(x^2-x+1)/(x+1)",
      x: ["-\\infty", "0", "-1", "1", "+\\infty"],
      derivative: ["+", "0", "-", "||", "-", "0", "+"],
      values: ["-\\infty", "1", "", "\\frac{1}{2}", "+\\infty"],
      discontinuities: [{ index: 2, leftValue: "-\\infty", rightValue: "+\\infty" }],
    }],
  }],
};
const daSua = repairLesson(JSON.parse(JSON.stringify(baiSai)));
const bangMoi = daSua.lesson.sections[0].visuals[0];
eq("tự sửa dựng lại mốc x đúng", bangMoi.x, ["-\\infty", "-1 - \\sqrt{3}", "-1", "-1 + \\sqrt{3}", "+\\infty"]);
eq("tự sửa ghi rõ đã làm gì", daSua.changes.some((c) => c.includes("bảng biến thiên")), true);
eq("bảng đã đúng thì tự sửa không đụng vào", (() => {
  const T = solveVariationTable("x^3-3x+2");
  const bai = { title: "T", sections: [{ heading: "H", content: "Nội dung slide đủ dài cho bộ kiểm định.",
    visuals: [{ type: "variation_table", label: "y", expression: "x^3-3x+2", x: T.x, derivative: T.derivative, values: T.values, discontinuities: T.discontinuities }] }] };
  return repairLesson(bai).changes.some((c) => c.includes("bảng biến thiên"));
})(), false);

// --- V11.9: danh sách phải liệt kê ĐỦ mọi slide của bản xuất ---
// Bài 18 mục xuất ra 74 slide thì V11.8 chỉ hiện 18 dòng; 56 slide "(tiếp)"
// không có cách nào mở ra xem trước khi xuất cả tệp PowerPoint.
const baiDai = {
  title: "Kiểm thử danh sách",
  objectives: ["Mục tiêu một.", "Mục tiêu hai."],
  sections: [
    { heading: "Mở đầu", phase: "khoi_dong", content: "Một ý ngắn." },
    {
      heading: "Ví dụ dài",
      phase: "vi_du",
      // Đủ dài để phần mềm phải tách sang slide "(tiếp)".
      content: Array.from({ length: 14 }, (_, i) => `Ý thứ ${i + 1} của ví dụ này, viết dài cho kín dòng.`).join("\n"),
      visuals: [{ type: "graph", expression: "x^2", xMin: -3, xMax: 3, yMin: -1, yMax: 9 }],
    },
  ],
};
const deckDai = buildDeck(baiDai, {});
const dan = outlineDeck(deckDai);
eq("mỗi slide một dòng", dan.length, deckDai.length);
eq("có bìa và trang kết", [dan[0].label, dan[dan.length - 1].label], ["Trang bìa", "Trang kết"]);
eq("bìa / phân cách / kết được đánh dấu là tự dựng",
   dan.filter((o) => o.auto).every((o) => o.kind !== "content"), true);
eq("mục dài bị tách thành nhiều slide", dan.filter((o) => o.sectionIndex === 1).length > 1, true);
eq("slide tiếp ghi rõ trang mấy trên mấy",
   dan.filter((o) => o.sectionIndex === 1 && o.part > 0).every((o) => /\(tiếp \d+\/\d+\)$/.test(o.label)), true);
eq("slide đầu của mục KHÔNG ghi chữ tiếp",
   dan.find((o) => o.sectionIndex === 1 && o.part === 0).label, "Ví dụ dài");
eq("mọi dòng nội dung đều chỉ về đúng mục",
   dan.filter((o) => !o.auto).every((o) => baiDai.sections[o.sectionIndex] !== undefined), true);

// --- V11.9: ô dữ liệu hình phải báo lỗi bằng tiếng Việt, không phải tiếng Anh ---
eq("ô trống thì nhắc bấm Chèn mẫu", readVisualJson("  ").error.includes("Chèn mẫu"), true);
eq("dấu phẩy thừa được gọi đúng tên",
   readVisualJson('{\n "type": "graph",\n "expression": "x^2",\n}').error.includes("dấu phẩy"), true);
eq("báo đúng dòng bị sai",
   /dòng 4/.test(readVisualJson('{\n "type": "graph",\n "expression": "x^2",\n}').error), true);
eq("thiếu trường type thì nói rõ", readVisualJson('{"expression":"x^2"}').error.includes('"type"'), true);
eq("dữ liệu đúng thì đọc được", readVisualJson('{"type":"graph","expression":"x^2"}').ok, true);
// Nút "Chèn mẫu" dùng chính ví dụ trong hướng dẫn, nên mẫu nào cũng phải đọc được.
eq("mọi ví dụ mẫu đều là dữ liệu hợp lệ",
   Object.keys(VISUAL_GUIDE).filter((t) => !readVisualJson(sampleFor(t)).ok), []);
eq("mẫu nào cũng khai đúng type của nó",
   Object.keys(VISUAL_GUIDE).filter((t) => readVisualJson(sampleFor(t)).value.type !== t), []);
// 16 loại hình trong lib/types.ts thì phải có 16 mục hướng dẫn, nếu không giáo
// viên gặp lại đúng cái ô JSON trắng như trước.
eq("có hướng dẫn cho đủ 16 loại hình",
   Object.keys(VISUAL_LABEL).filter((t) => !VISUAL_GUIDE[t]), []);

// --- V12.0: bộ kiểm định phải bắt lỗi dữ liệu của CẢ 16 loại hình ---
// Tới V11.8 chỉ bảng biến thiên và đồ thị được kiểm bằng toán học; mười bốn
// loại còn lại muốn ghi gì cũng "Đạt". Mỗi phép kiểm dưới đây đi kèm một ca
// SAI (phải bắt được) và một ca ĐÚNG (không được báo oan).
const maLoi = (visual) => codesOf(visual);
const batDuoc = (ten, visual, ma) => eq(ten, maLoi(visual).includes(ma), true);
const khongBaoOan = (ten, visual, ma) => eq(ten, maLoi(visual).includes(ma), false);

// Hình chóp: tên đỉnh trùng, và đoạn nhấn mạnh trỏ vào đỉnh không có
batDuoc("chóp: tên đỉnh trùng nhau",
  { type: "solid_3d", shape: "pyramid", baseSides: 4, labels: ["S", "A", "B", "B", "D"] }, "SOLID_DUP");
batDuoc("chóp: nhấn mạnh đỉnh không tồn tại",
  { type: "solid_3d", shape: "pyramid", baseSides: 4, labels: ["S", "A", "B", "C", "D"],
    highlights: [{ from: "S", to: "M", label: "SM" }] }, "SOLID_EDGE");
khongBaoOan("chóp S.ABCD đúng thì không báo",
  { type: "solid_3d", shape: "pyramid", baseSides: 4, labels: ["S", "A", "B", "C", "D"],
    highlights: [{ from: "S", to: "A", label: "SA ⊥ (ABCD)" }] }, "SOLID_EDGE");

// Biểu đồ hộp: giá trị ngoại lệ lại nằm trong hai đầu râu
batDuoc("hộp: ngoại lệ nằm trong râu",
  { type: "box_plot", groups: [{ name: "12A", min: 3, q1: 5, median: 6, q3: 7, max: 9, outliers: [6] }] }, "BOX_OUTLIER");
khongBaoOan("hộp: ngoại lệ nằm ngoài râu là đúng",
  { type: "box_plot", groups: [{ name: "12A", min: 3, q1: 5, median: 6, q3: 7, max: 9, outliers: [1] }] }, "BOX_OUTLIER");

// Sơ đồ cây: xác suất đường đi phải bằng TÍCH hai xác suất
batDuoc("cây: kết quả không bằng tích",
  { type: "prob_tree", root: "Hộp",
    branches: [{ label: "Đỏ", p: "0,6", children: [{ label: "Đỏ", p: "0,5", result: "0,50" }, { label: "Xanh", p: "0,5", result: "0,30" }] },
               { label: "Xanh", p: "0,4", children: [{ label: "Đỏ", p: "0,5", result: "0,20" }, { label: "Xanh", p: "0,5", result: "0,20" }] }] },
  "TREE_PRODUCT");
batDuoc("cây: xác suất ngoài [0; 1]",
  { type: "prob_tree", branches: [{ label: "A", p: "1,4" }, { label: "B", p: "-0,4" }] }, "TREE_RANGE");
khongBaoOan("cây đúng thì không báo tích sai",
  { type: "prob_tree", root: "Hộp",
    branches: [{ label: "Đỏ", p: "0,6", children: [{ label: "Đỏ", p: "0,5", result: "0,30" }, { label: "Xanh", p: "0,5", result: "0,30" }] },
               { label: "Xanh", p: "0,4", children: [{ label: "Đỏ", p: "0,25", result: "0,10" }, { label: "Xanh", p: "0,75", result: "0,30" }] }] },
  "TREE_PRODUCT");

// Miền nghiệm: đỉnh bịa ra — nay là LỖI chặn xuất, không còn là cảnh báo
const mienSaiDinh = {
  type: "inequality_region",
  constraints: [{ a: 1, b: 1, c: 6, op: "<=", label: "x + y ≤ 6" }],
  xMin: -1, xMax: 9, yMin: -1, yMax: 9,
  vertices: [{ x: 8, y: 8, label: "M" }],
};
batDuoc("miền nghiệm: đỉnh không thoả ràng buộc", mienSaiDinh, "REGION_VERTEX");
eq("đỉnh bịa là LỖI chặn xuất, không phải cảnh báo",
   auditLesson({ title: "T", sections: [{ heading: "H", content: "Nội dung slide đủ dài cho bộ kiểm định.", visuals: [mienSaiDinh] }] })
     .find((i) => i.code === "REGION_VERTEX").level, "error");

// Trục số: khoảng ngược đầu, và mút nằm ngoài trục
batDuoc("trục số: khoảng ngược đầu",
  { type: "number_line", min: -5, max: 5, intervals: [{ from: 3, to: 1, label: "sai" }] }, "NL_INTERVAL");
batDuoc("trục số: mút ra ngoài trục",
  { type: "number_line", min: -5, max: 5, intervals: [{ from: -3, to: 9, label: "[-3; 9]" }] }, "NL_OUT");

// Bảng xét dấu: ghi số 0 ở mốc không phải nghiệm của dòng đó
batDuoc("xét dấu: số 0 ở mốc không phải nghiệm của dòng",
  { type: "sign_chart", x: ["-\\infty", "-2", "1", "+\\infty"],
    rows: [{ label: "x - 1", signs: ["-", "0", "-", "0", "+"] }] }, "SC_ZERO");
khongBaoOan("xét dấu dùng dấu | ở mốc lạ thì đúng",
  { type: "sign_chart", x: ["-\\infty", "-2", "1", "+\\infty"],
    rows: [{ label: "x - 1", signs: ["-", "|", "-", "0", "+"] }] }, "SC_ZERO");

// Trắc nghiệm: hai phương án trùng nhau
batDuoc("trắc nghiệm: hai phương án giống nhau",
  { type: "quiz", question: "Chọn đáp án", options: ["$y = 1$", "$y=1$", "$y = 2$", "$y = 3$"], answerIndex: 0 }, "QUIZ_DUP");

// Vectơ: quy tắc hình bình hành mà hai vectơ không chung gốc
batDuoc("vectơ: hình bình hành cần chung gốc",
  { type: "vector_2d", xMin: -3, xMax: 4, yMin: -3, yMax: 4, showParallelogram: true,
    vectors: [{ x1: 0, y1: 0, x2: 2, y2: 1 }, { x1: 1, y1: 1, x2: 3, y2: 2 }] }, "VEC_PARA");

// Ven: vùng tô nhắc tập không có
batDuoc("Ven: vùng tô nhắc tập không tồn tại",
  { type: "venn", sets: [{ name: "A" }, { name: "B" }], shade: ["AC"] }, "VENN_SHADE");

// Oxyz: mặt phẳng suy biến, mặt cầu bán kính không dương
batDuoc("Oxyz: mặt phẳng a = b = c = 0",
  { type: "oxyz", planes: [{ a: 0, b: 0, c: 0, d: 5, label: "P" }] }, "OXYZ_PLANE");
batDuoc("Oxyz: mặt cầu bán kính không dương",
  { type: "oxyz", sphere: { x: 0, y: 0, z: 0, r: 0 } }, "OXYZ_SPHERE");

// Tần số ghép nhóm: mốc lớp không tăng dần
batDuoc("histogram: mốc lớp không tăng dần",
  { type: "stat_chart", chart: "histogram", labels: ["a", "b"], bins: [150, 160, 155], series: [{ values: [3, 4] }] }, "HIST_ORDER");

// Hình quạt: số âm
batDuoc("hình quạt: số liệu âm",
  { type: "stat_chart", chart: "pie", labels: ["A", "B"], series: [{ values: [-2, 5] }] }, "PIE_NEG");

// Vạch chia phải vừa chỗ: miền [-3; 5] không được ra 17 nhãn chen nhau
eq("bước chia tự nới cho vừa chỗ", ticksFit(-3, 5, 300, 34).length <= 9, true);
eq("vạch chia vẫn là số đẹp", ticksFit(-3, 5, 300, 34).every((t) => Math.abs(t * 2 - Math.round(t * 2)) < 1e-9), true);
eq("trục đứng tính theo chiều cao dòng chữ", ticksFitDoc(-1, 8, 340, 34).length >= 4, true);
// Số viết theo cách Việt Nam
eq("số thập phân dùng dấu phẩy", [soVN(5.5), soVN(-0.25), soVN(7)], ["5,5", "-0,25", "7"]);

// --- V12.0: đạo hàm KÝ HIỆU phải ra đúng dạng SGK, không chỉ đúng về toán ---
// Đúng mà viết ((2x+2)(x-1) - (x²+2x-2))/(x-1)² thì giáo viên không dùng được.
const dh = (f) => daoHam(f).expr;
eq("đạo hàm đa thức", dh("x^3-3*x+2"), "3*x^2-3");
eq("đạo hàm khai triển gọn như SGK", dh("(x^2+2*x-2)/(x-1)"), "(x^2-2*x)/(x-1)^2");
eq("hàm nhất biến ra hằng trên bình phương", dh("(x+1)/(x-1)"), "(-2)/(x-1)^2");
eq("bậc hai trên bậc nhất", dh("(x^2-x+1)/(x+1)"), "(x^2+2*x-2)/(x+1)^2");
eq("ước lược hệ số ở căn", dh("sqrt(x^2+1)"), "x/sqrt(x^2+1)");
eq("rút gọn x·(1/x) thành 1", dh("x*ln(x)"), "ln(x)+1");
eq("gộp hệ số 2·(2x) thành 4x", dh("x^4-2*x^2"), "4*x^3-4*x");
eq("hàm hợp lượng giác", dh("sin(2*x)"), "2*cos(2*x)");
eq("hàm mũ cơ số a", dh("2^x"), "2^x*ln(2)");
eq("không đoán bừa khi không lấy được đạo hàm", daoHam("|x|").ok, false);
eq("số âm ở tử không bọc ngoặc vô ích", daoHam("(x+1)/(x-1)").latex.includes("\\left(-2\\right)"), false);
// Đối chiếu đạo hàm ký hiệu với đạo hàm SỐ HỌC: hai đường độc lập, khớp nhau
// thì gần như chắc chắn cả hai đúng.
["x^3-3*x+2", "(x^2+2*x-2)/(x-1)", "sqrt(x^2+1)", "sin(2*x)", "x*ln(x)"].forEach((f) => {
  const e = daoHam(f).expr;
  const lech = [0.37, 1.63, 2.9, 4.1].filter((x) => {
    const a = compileExpression(e).eval(x), b = numericDerivative(f, x);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 1e-4 * Math.max(1, Math.abs(b));
  });
  eq(`đạo hàm ký hiệu khớp đạo hàm số học: ${f}`, lech, []);
});

// --- V12.0: nút "Khảo sát hàm số" dựng đủ bộ slide, không gọi AI ---
const ks = khaoSatHamSo("(x^2+2*x-2)/(x-1)");
eq("khảo sát được hàm phân thức", ks.ok, true);
eq("dựng đủ ba slide", ks.sections.length, 3);
eq("slide 2 có bảng biến thiên", ks.sections[1].visuals[0].type, "variation_table");
eq("slide 3 có đồ thị", ks.sections[2].visuals[0].type, "graph");
eq("nêu đúng tập xác định", ks.sections[0].content.includes("\\setminus \\{1\\}"), true);
eq("viết đạo hàm thành công thức", ks.sections[0].content.includes("x^{2} - 2x"), true);
eq("tìm đúng cực đại và cực tiểu",
   [ks.sections[0].content.includes("y_{CĐ} = 2"), ks.sections[0].content.includes("y_{CT} = 6")], [true, true]);
eq("nhận ra tiệm cận đứng và tiệm cận xiên",
   [ks.sections[2].content.includes("x = 1"), ks.sections[2].content.includes("y = x + 3")], [true, true]);
const gKS = ks.sections[2].visuals[0];
eq("khung nhìn bám theo cực trị, không kéo tới vô cực", gKS.yMax <= 14 && gKS.yMin >= -8, true);
// V12.2: đồ thị KHÔNG còn chấm và nhãn điểm nào — thầy Dũng yêu cầu bỏ vì rối
// mắt. Toạ độ không mất đi: chúng chuyển sang phần chữ của chính slide này.
eq("đồ thị không đánh dấu điểm nào", (gKS.points ?? []).length, 0);
eq("bù lại, chữ slide đồ thị nêu đủ hai cực trị",
   [ks.sections[2].content.includes("điểm cực đại $(0; 2)$"),
    ks.sections[2].content.includes("điểm cực tiểu $(2; 6)$")], [true, true]);
// Bộ slide do khảo sát dựng ra phải TỰ NÓ vượt được bộ kiểm định.
eq("bộ slide khảo sát không có lỗi chặn xuất",
   auditLesson({ title: "Khảo sát", sections: ks.sections }).filter((i) => i.level === "error"), []);
eq("hàm nhất biến: nói rõ không có cực trị",
   khaoSatHamSo("(x+1)/(x-1)").sections[0].content.includes("không có cực trị"), true);
eq("hàm nhất biến: tiệm cận ngang y = 1",
   khaoSatHamSo("(x+1)/(x-1)").sections[2].content.includes("y = 1"), true);
eq("biểu thức hỏng thì báo lỗi, không dựng slide bừa", khaoSatHamSo("alert(1)").ok, false);
eq("ô trống thì nhắc nhập hàm số", khaoSatHamSo("  ").error.includes("Chưa nhập"), true);

// --- V12.1: tâm đối xứng, thứ SGK luôn đánh dấu mà V12.0 bỏ quên ---
// V12.2: tâm đối xứng nay nêu bằng CHỮ trên slide đồ thị, không chấm lên hình.
const tamCua = (f) => {
  const noiDung = khaoSatHamSo(f).sections?.[2]?.content ?? "";
  const m = /\$I\(([^)]*)\)\$/.exec(noiDung);
  return m ? `I(${m[1]})` : null;
};
eq("phân thức nhất biến: tâm là giao hai tiệm cận", tamCua("(x+1)/(x-1)"), "I(1; 1)");
eq("bậc hai trên bậc nhất: tâm trên tiệm cận xiên", tamCua("(x^2+2*x-2)/(x-1)"), "I(1; 4)");
eq("hàm trong ảnh thầy gửi", tamCua("(-x^2+x+1)/(x-2)"), "I(2; -3)");
// Đa thức bậc ba: tâm đối xứng chính là ĐIỂM UỐN (y″ = 0).
eq("bậc ba: điểm uốn là tâm đối xứng", tamCua("x^3-3*x+2"), "I(0; 2)");
eq("bậc ba hệ số âm", tamCua("-x^3+3*x^2-1"), "I(1; 1)");
// Không có thì KHÔNG bịa: parabol có trục đối xứng, không có tâm; bậc bốn cũng vậy.
eq("parabol không có tâm đối xứng", tamCua("x^2-4*x+3"), null);
eq("bậc bốn không có tâm đối xứng", tamCua("x^4-2*x^2"), null);
eq("nêu điểm uốn bằng lời đúng chỗ",
   khaoSatHamSo("x^3-3*x+2").sections[2].content.includes("Điểm uốn"), true);
eq("phân thức thì nói là giao hai tiệm cận",
   khaoSatHamSo("(x+1)/(x-1)").sections[2].content.includes("giao của hai đường tiệm cận"), true);
// Tâm đối xứng tuy không chấm lên hình nhưng vẫn phải NẰM TRONG khung nhìn:
// thầy đọc "tâm đối xứng I(1; 4)" rồi nhìn vào hình mà không thấy chỗ ấy đâu
// thì câu chữ và hình vẽ đá nhau.
[["(x+1)/(x-1)", 1, 1], ["(x^2+2*x-2)/(x-1)", 1, 4], ["x^3-3*x+2", 0, 2]].forEach(([f, cx, cy]) => {
  const g = khaoSatHamSo(f).sections[2].visuals[0];
  eq(`tâm đối xứng nằm trong khung nhìn: ${f}`,
     cx >= g.xMin && cx <= g.xMax && cy >= g.yMin && cy <= g.yMax, true);
});
// Và cả bộ slide vẫn không có chấm nào trên đồ thị.
["(x+1)/(x-1)", "(x^2+2*x-2)/(x-1)", "x^3-3*x+2", "x^2-4*x+3"].forEach((f) => {
  eq(`không đánh dấu điểm: ${f}`,
     (khaoSatHamSo(f).sections[2].visuals[0].points ?? []).length, 0);
});

// --- V12.1: ví dụ mẫu bảng xét dấu không được ghi 0 cho MỌI hàng tại một mốc ---
// Đây là lỗi lập bảng hay gặp nhất, mà chính ví dụ mẫu của V12.0 lại mắc.
const mauXetDau = VISUAL_GUIDE.sign_chart.sample;
const soMoc = mauXetDau.x.length;
for (let k = 1; k < soMoc - 1; k++) {
  const oTaiMoc = mauXetDau.rows.map((r) => r.signs[2 * k - 1]);
  eq(`mẫu xét dấu: tại mốc ${mauXetDau.x[k]} không phải hàng nào cũng bằng 0`,
     oTaiMoc.every((o) => o === "0"), false);
}
// Và mẫu đó phải tự vượt được bộ kiểm định của chính phần mềm.
eq("mẫu xét dấu không bị bộ kiểm định bắt lỗi",
   codesOf(mauXetDau).filter((c) => c.startsWith("SC_") || c.startsWith("SIGN_")), []);
eq("mẫu đồ thị có tâm đối xứng cũng hợp lệ",
   codesOf(VISUAL_GUIDE.graph.sample).filter((c) => c.startsWith("GRAPH_")), []);

// --- V12.1: tự dò tiệm cận NGANG, để đồ thị hàm nhất biến có đủ hai tiệm cận ---
const tcn = (f) => detectHorizontalAsymptote(f);
eq("nhất biến (x+1)/(x-1) có tiệm cận ngang y = 1", tcn("(x+1)/(x-1)"), 1);
eq("(2x+3)/(x-1) có tiệm cận ngang y = 2", tcn("(2*x+3)/(x-1)"), 2);
eq("(3-x)/(x+2) có tiệm cận ngang y = -1", tcn("(3-x)/(x+2)"), -1);
eq("bậc hai trên bậc hai vẫn ra y = 1", tcn("(x^2+1)/(x^2-1)"), 1);
// Thà không vẽ còn hơn vẽ sai: các ca sau KHÔNG được nhận là tiệm cận ngang.
eq("bậc hai trên bậc nhất: không có tiệm cận ngang (có tiệm cận xiên)", tcn("(x^2+2*x-2)/(x-1)"), null);
eq("đa thức thì không có", tcn("x^3-3*x+2"), null);
eq("arctan hai đầu khác nhau thì không kết luận", tcn("atan(x)"), null);
eq("y = 0 trùng trục Ox thì không kẻ thêm", tcn("1/x"), null);
eq("3/(x^2+1) cũng về 0 nên không kẻ thêm", tcn("3/(x^2+1)"), null);
eq("biểu thức sai thì trả null, không nổ", tcn("alert(1)"), null);

// --- V12.1: góc lượng giác "2\\pi/3" bị đọc thành 23,14/3 ở V12.0 ---
const doGoc = (t) => Math.round((gocRadian(t) * 180) / Math.PI * 1e6) / 1e6;
eq("pi/3 = 60 độ", doGoc("\\pi/3"), 60);
eq("2pi/3 = 120 độ, KHÔNG phải 81,9 độ", doGoc("2\\pi/3"), 120);
eq("3pi/4 = 135 độ, KHÔNG phải 114,9 độ", doGoc("3\\pi/4"), 135);
eq("5pi/6 = 150 độ", doGoc("5\\pi/6"), 150);
eq("-pi/2 = -90 độ", doGoc("-\\pi/2"), -90);
eq("chữ π Unicode cũng đọc được", doGoc("2π/3"), 120);
eq("số radian thuần", doGoc("1.5707963267948966"), 90);
eq("pi trơn = 180 độ", doGoc("\\pi"), 180);
eq("biểu thức hỏng thì về 0, không NaN", gocRadian("alert(1)"), 0);
// Cung nghiệm từ pi/3 tới 2pi/3 rộng 60 độ, tức cung NHỎ.
eq("bề rộng cung nghiệm là 60 độ",
   Math.round((gocChuan(gocRadian("2\\pi/3") - gocRadian("\\pi/3")) * 180) / Math.PI), 60);
eq("hai cách viết cùng một tia cho cung rộng 0",
   Math.round((gocChuan(gocRadian("2\\pi/3") - gocRadian("-4\\pi/3")) * 180) / Math.PI), 0);

// --- V12.1: hai nhãn viết đè nhau trong hình Oxyz ---
const mangOxyz = (v) => auditLesson({ title: "t", sections: [{ heading: "h", content: "c", visuals: [v] }] }).map((i) => i.code);
eq("tâm mặt cầu và điểm cùng tên, cùng toạ độ -> cảnh báo",
   mangOxyz({ type: "oxyz", sphere: { x: 1, y: 1, z: 1, r: 2, label: "I" },
              points: [{ x: 1, y: 1, z: 1, label: "I" }], range: 4 }).includes("OXYZ_TRUNG_NHAN"), true);
eq("khai một chỗ thì không cảnh báo",
   mangOxyz({ type: "oxyz", sphere: { x: 1, y: 1, z: 1, r: 2, label: "I" }, range: 4 }).includes("OXYZ_TRUNG_NHAN"), false);
eq("cùng tên nhưng khác toạ độ thì không cảnh báo",
   mangOxyz({ type: "oxyz", sphere: { x: 1, y: 1, z: 1, r: 2, label: "I" },
              points: [{ x: 2, y: 1, z: 1, label: "I" }], range: 4 }).includes("OXYZ_TRUNG_NHAN"), false);

// --- V12.1: bảng tự tính lại thì KHÔNG chặn xuất, nhưng vẫn chỉ rõ chỗ sai ---
const bangSaiCoBieuThuc = {
  type: "variation_table", label: "y", expression: "x^3-3x+2",
  x: ["-\\infty", "-1", "1", "+\\infty"],
  derivative: ["+", "-", "+"],
  values: ["-\\infty", "4", "0", "+\\infty"],
};
const mucCua = (visual) =>
  auditLesson({ title: "t", sections: [{ heading: "h", content: "Một câu nội dung đủ dài để không bị coi là trống.", visuals: [visual] }] })
    .filter((i) => i.code.startsWith("BBT_"));
eq("bảng sai mà có biểu thức: không còn lỗi chặn xuất",
   mucCua(bangSaiCoBieuThuc).some((i) => i.level === "error"), false);
eq("và có nói rõ là đã tự tính lại",
   mucCua(bangSaiCoBieuThuc).some((i) => i.code === "BBT_DA_TU_TINH_LAI"), true);
eq("vẫn giữ lời chẩn đoán chi tiết, không chỉ nói chung chung",
   mucCua(bangSaiCoBieuThuc).length > 1, true);
// Không có biểu thức thì phần mềm không sửa được -> vẫn phải là lỗi.
eq("thiếu hẳn hàng y′ mà không có biểu thức: vẫn chặn xuất",
   mucCua({ type: "variation_table", label: "y", x: ["-\\infty", "m", "+\\infty"],
            derivative: ["-"], values: ["+\\infty", "2m", "+\\infty"] }).some((i) => i.level === "error"), true);
eq("chỉ thiếu ô tại mốc mà không có biểu thức: cảnh báo, không chặn",
   mucCua({ type: "variation_table", label: "y", x: ["-\\infty", "m", "n", "+\\infty"],
            derivative: ["-", "+", "-"], values: ["+\\infty", "a", "b", "-\\infty"] }).some((i) => i.level === "error"), false);
// Sơ đồ cây ghi dấu phẩy Việt Nam là ĐÚNG, không được báo oan.
const cayVN = {
  type: "prob_tree", root: "Hộp bi",
  branches: [
    { label: "Bi đỏ", p: "0,6", children: [{ label: "Đỏ", p: "0,5", result: "0,30" }, { label: "Xanh", p: "0,5", result: "0,30" }] },
    { label: "Bi xanh", p: "0,4", children: [{ label: "Đỏ", p: "0,25", result: "0,10" }, { label: "Xanh", p: "0,75", result: "0,30" }] },
  ],
};
eq("xác suất viết dấu phẩy không bị báo sai tổng",
   auditLesson({ title: "t", sections: [{ heading: "h", content: "Một câu nội dung đủ dài để không bị coi là trống.", visuals: [cayVN] }] })
     .filter((i) => i.code.startsWith("TREE_")), []);
eq("tổng sai thật thì vẫn báo",
   auditLesson({ title: "t", sections: [{ heading: "h", content: "Một câu nội dung đủ dài để không bị coi là trống.",
     visuals: [{ ...cayVN, branches: [{ ...cayVN.branches[0], p: "0,7" }, cayVN.branches[1]] }] }] })
     .some((i) => i.code === "TREE_SUM"), true);
// Hình nón chỉ có một đỉnh — đừng đòi n+1 tên.
eq("hình nón đỉnh S không bị đòi thêm tên",
   auditLesson({ title: "t", sections: [{ heading: "h", content: "Một câu nội dung đủ dài để không bị coi là trống.",
     visuals: [{ type: "solid_3d", shape: "cone", labels: ["S"], caption: "Hình nón đỉnh S" }] }] })
     .some((i) => i.code === "SOLID_LABELS"), false);
eq("hình chóp thiếu tên thì vẫn nhắc",
   auditLesson({ title: "t", sections: [{ heading: "h", content: "Một câu nội dung đủ dài để không bị coi là trống.",
     visuals: [{ type: "solid_3d", shape: "pyramid", baseSides: 4, labels: ["S", "A"] }] }] })
     .some((i) => i.code === "SOLID_LABELS"), true);

// V12.2: nối danh sách kiểu tiếng Việt — "A, B và C", không phải "A và B và C".
eq("ba cực trị nối bằng dấu phẩy rồi mới \"và\"",
   khaoSatHamSo("x^4-2*x^2").sections[2].content.split("\n")[0],
   "Đồ thị đi qua điểm cực tiểu $(-1; -1)$, điểm cực đại $(0; 0)$ và điểm cực tiểu $(1; -1)$.");
eq("hai cực trị chỉ dùng \"và\"",
   khaoSatHamSo("x^3-3*x+2").sections[2].content.split("\n")[0],
   "Đồ thị đi qua điểm cực đại $(-1; 4)$ và điểm cực tiểu $(1; 0)$.");
eq("không có cực trị thì không có dòng đó",
   khaoSatHamSo("(x+1)/(x-1)").sections[2].content.includes("Đồ thị đi qua"), false);

// --- V12.3: PDF ảnh quét là một tình huống CÓ LỐI ĐI, không phải lỗi cụt ---
eq("LoiCanOCR mang theo tệp và số trang để giao diện mời đọc OCR",
   (() => { const f = { name: "a.pdf" }; const e = new LoiCanOCR(f, 250);
            return [e.name, e.file === f, e.soTrang, e instanceof Error]; })(),
   ["LoiCanOCR", true, 250, true]);
eq("ghép trang có đánh số trang, bỏ trang trắng",
   ghepTrang([{ trang: 3, text: "Bài 1" }, { trang: 4, text: "   " }, { trang: 5, text: "Bài 2" }]),
   "--- Trang 3 ---\nBài 1\n\n--- Trang 5 ---\nBài 2");
eq("trang trắng thì coi như không đọc được chữ nào",
   coChuKhong([{ trang: 1, text: "  " }, { trang: 2, text: "." }]), false);
eq("đọc được một câu thì tính là có chữ",
   coChuKhong([{ trang: 1, text: "Cho hàm số y = f(x) xác định trên khoảng K." }]), true);
eq("tài liệu từ OCR ghi rõ là bản OCR và khoảng trang",
   docTuOCR({ name: "sgk.pdf", size: 100 }, "abc", 1, 20).name, "sgk.pdf (OCR trang 1–20)");
eq("mỗi lần OCR chặn ở 60 trang", TOI_DA_TRANG, 60);
// Địa chỉ CDN phải ghim số phiên bản: thả lỏng thì một hôm CDN đổi bản mới là hỏng.
eq("mọi địa chỉ tải bộ nhận dạng đều ghim phiên bản",
   NGUON_MAC_DINH.every((n) => [n.thuVien, n.worker, n.loi, n.ngonNgu].every((u) => /@\d+\.\d+\.\d+/.test(u))), true);
eq("có hai nguồn dự phòng, không đặt hết vào một CDN",
   new Set(NGUON_MAC_DINH.map((n) => new URL(n.thuVien).host)).size, 2);

// --- V12.4: phân số có NGOẶC LỒNG. Trước đây in ra slide thành "frac36x²" ---
eq("phân số có mũ ở mẫu", latexToUnicode("\\frac{36}{x^{2}}").text, "36/(x²)");
eq("phân số SGK hàm nhất biến",
   latexToUnicode("\\frac{ad - bc}{(cx + d)^{2}}").text, "(ad - bc)/((cx + d)²)");
eq("phân số lồng phân số", latexToUnicode("\\frac{\\frac{1}{2}}{x}").text, "(½)/x");
eq("không còn báo \\frac là lệnh lạ",
   mixedLatexToUnicode("chi phí $x + \\frac{36}{x^{2}}$ triệu").unknownCommands, []);

// --- V12.4: bảng thu hẹp trên miền con thì GIỮ NGUYÊN, không thay bằng bảng cả ℝ ---
const bangMienCon = { type: "variation_table", label: "f(x)", expression: "x+36/x",
  x: ["0", "6", "+\\infty"], derivative: ["-", "0", "+"], values: ["+\\infty", "12", "+\\infty"] };
const giaiCaR = solveVariationTable("x+36/x");
eq("bảng tự tính trên cả ℝ có thêm nhánh x < 0", giaiCaR.x.length, 5);
eq("nhận ra bảng chỉ xét trên miền con", laThuHepMien(bangMienCon, giaiCaR), true);
eq("bảng đủ miền thì KHÔNG bị coi là thu hẹp",
   laThuHepMien({ x: giaiCaR.x }, giaiCaR), false);
eq("mốc lạ không có trong bảng tự tính thì không phải thu hẹp",
   laThuHepMien({ x: ["0", "5", "+\\infty"] }, giaiCaR), false);
eq("bảng miền con không bị chặn xuất, chỉ được nhắc",
   mucCua(bangMienCon).filter((i) => i.level === "error"), []);
eq("và có nói rõ là chưa tự kiểm chứng được",
   mucCua(bangMienCon).some((i) => i.code === "BBT_MIEN_CON"), true);

// --- V12.4: ký hiệu đạo hàm phải là f′(x), không phải f(x)′ ---
eq("đạo hàm của f(x)", tenDaoHam("f(x)"), "f′(x)");
eq("đạo hàm của y", tenDaoHam("y"), "y′");
eq("đạo hàm của g(t)", tenDaoHam("g(t)"), "g′(t)");

// --- V12.4: prompt cho AI ngoài phải mô tả ĐỦ lược đồ phần mềm hiểu ---
const pr = promptChoAiNgoai();
eq("prompt nêu đủ 16 loại hình",
   ["formula","variation_table","sign_chart","graph","stat_chart","box_plot","prob_tree",
    "unit_circle","number_line","inequality_region","solid_3d","oxyz","vector_2d","venn",
    "data_table","quiz"].filter((t) => !pr.includes(`"${t}"`)), []);
eq("prompt bắt AI chỉ in JSON, không dùng markdown fence", pr.includes("KHÔNG dùng dấu"), true);
eq("prompt chỉ đúng chỗ nạp tệp trong phần mềm", pr.includes("Mở tệp JSON"), true);
eq("prompt mang đúng số phiên bản đang chạy", pr.includes(APP_LABEL), true);
eq("prompt dùng lại nguyên bộ quy tắc hình của phần mềm", pr.includes(VISUAL_SPEC), true);

// --- V12.5: KHÔNG tệp nào được ghi cứng số phiên bản ---
/* Vì sao có phép kiểm quét mã nguồn này: bản V12.2 đã đưa số phiên bản về một
   chỗ và nối vào bốn nơi, nhưng components/SlideView.tsx vẫn ghi cứng
   "LessonStudio V11". Chân MÀN TRÌNH CHIẾU lấy chữ từ đó, nên thầy Dũng nâng
   lên V12.x rồi mở trình chiếu vẫn thấy V11 và tưởng gói chưa lên. Một chỗ sót
   thì mắt người không soi ra được; để máy quét. */
{
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const quet = (thuMuc) => readdirSync(thuMuc).flatMap((ten) => {
    const d = join(thuMuc, ten);
    if (statSync(d).isDirectory()) return quet(d);
    return /\.(ts|tsx)$/.test(ten) ? [d] : [];
  });
  const phamLoi = [];
  for (const tep of [...quet("app"), ...quet("components"), ...quet("lib")]) {
    if (tep.endsWith("lib/version.ts")) continue;   // chỗ được phép ghi số
    /* BỎ CHÚ THÍCH trước khi quét: lời giải thích được phép nhắc lại chuỗi
       cũ để kể vì sao từng sai. Chỉ MÃ CHẠY THẬT mới bị cấm ghi cứng. */
    const noiDung = readFileSync(tep, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    /* "LessonStudio V11", "Phiên bản 11", "V12.2"… — mọi cách ghi cứng. */
    const m = noiDung.match(/LessonStudio\s+V\d|Phiên bản\s+\d+/g);
    if (m) phamLoi.push(`${tep}: ${[...new Set(m)].join(", ")}`);
  }
  eq("không tệp mã nguồn nào ghi cứng số phiên bản", phamLoi, []);
}

console.log(`\n${pass} kiểm thử đạt, ${fail} lỗi`);
process.exit(fail?1:0);
