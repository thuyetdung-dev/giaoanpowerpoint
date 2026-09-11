import { compileExpression, detectPoles, numericDerivative } from "./_build/lib/mathexpr.js";
import { latexToUnicode, mixedLatexToUnicode } from "./_build/lib/latex.js";
import { computeLevels } from "./_build/lib/bbt.js";
import * as Lib from "./_build/lib/library.js";

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


console.log(`\n${pass} kiểm thử đạt, ${fail} lỗi`);
process.exit(fail?1:0);
