import { compileExpression, detectPoles, numericDerivative } from "./_build/lib/mathexpr.js";
import { latexToUnicode, mixedLatexToUnicode } from "./_build/lib/latex.js";
import { computeLevels } from "./_build/lib/bbt.js";
import * as Lib from "./_build/lib/library.js";
import { solveVariationTable, vietSo } from "./_build/lib/bbtsolve.js";
import { auditLesson, repairLesson } from "./_build/lib/audit.js";

let pass=0, fail=0;
const eq=(name,a,b,tol=1e-9)=>{const ok=(typeof a==="number"&&typeof b==="number")?Math.abs(a-b)<=tol:JSON.stringify(a)===JSON.stringify(b);ok?pass++:(fail++,console.log("FAIL",name,"got",JSON.stringify(a),"want",JSON.stringify(b)));};

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
eq("văn bản trộn công thức", mixedLatexToUnicode("Xét $\\sqrt{x}\\geq 0$ với mọi x.").text, "Xét √x≥0 với mọi x.");

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

console.log(`\n${pass} kiểm thử đạt, ${fail} lỗi`);
process.exit(fail?1:0);
