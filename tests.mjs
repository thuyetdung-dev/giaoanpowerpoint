import { compileExpression, detectPoles, numericDerivative } from "./_build/lib/mathexpr.js";
import { latexToUnicode, mixedLatexToUnicode } from "./_build/lib/latex.js";
import { computeLevels } from "./_build/lib/bbt.js";

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

console.log(`\n${pass} kiểm thử đạt, ${fail} lỗi`);
process.exit(fail?1:0);
