import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const buildDir = "_build";
rmSync(buildDir, { recursive: true, force: true });

const sources = readdirSync("lib")
  .filter((name) => name.endsWith(".ts"))
  .map((name) => `lib/${name}`);

const tscArgs = [
  "tsc",
  "--outDir", buildDir,
  "--rootDir", ".",
  "--module", "commonjs",
  "--moduleResolution", "node",
  "--target", "ES2020",
  "--lib", "ES2020,DOM,DOM.Iterable",
  "--skipLibCheck",
  "--esModuleInterop",
  "--noEmit", "false",
  ...sources,
];

const compile = spawnSync("npx", tscArgs, { stdio: "inherit", shell: process.platform === "win32" });
if (compile.status !== 0) process.exit(compile.status ?? 1);

writeFileSync(`${buildDir}/package.json`, '{"type":"commonjs"}\n');
const tests = spawnSync(process.execPath, ["tests.mjs"], { stdio: "inherit" });
process.exit(tests.status ?? 1);
