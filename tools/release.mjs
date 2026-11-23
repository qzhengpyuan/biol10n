// 把 dist/biol10n.user.js 推到 release 分支（只含单文件，不动工作区）。
// 商店「源代码同步」与 @downloadURL 都指向 release 分支的 raw 地址。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// 先重建：r22 P0-1/P0-2 都是「盘上改了、dist/release 还是旧构建」，导致修了不生效。
// 发版脚本自己构建，从根上消掉两次构建之间被改词库的机会。
execFileSync(process.execPath, ["build.mjs"], { cwd: root, stdio: "inherit" });
const file = path.join(root, "dist/biol10n.user.js");
if (!fs.existsSync(file)) {
  console.error("dist/biol10n.user.js 不存在，先 npm run build");
  process.exit(1);
}
const version = (fs.readFileSync(file, "utf8").match(/@version\s+(\S+)/) || [])[1] || "unknown";
// r24 P1-3：构建之后又被改了词库时，dist 与 meta 的指纹对不上，这一版发出去就是
// 「报告说修了、真机看不到」。发版前把 dist-fresh 跑一遍，红就中止。
try {
  execFileSync(process.execPath, ["--test", "test/dist-fresh.test.mjs"], { cwd: root, stdio: "inherit" });
} catch (e) {
  console.error("dist 与磁盘词库/配置不一致，发版中止：先跑 npm run build 再看 test/dist-fresh");
  process.exit(1);
}
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const blob = git("hash-object", "-w", file);
let treeInput = "100644 blob " + blob + "\tbiol10n.user.js\n";
const readme = path.join(root, "README.md");
if (fs.existsSync(readme)) {
  const rb = git("hash-object", "-w", readme);
  treeInput += "100644 blob " + rb + "\tREADME.md\n";
}
const tree = execFileSync("git", ["mktree"], { cwd: root, input: treeInput, encoding: "utf8" }).trim();

let parent = null;
try { parent = git("rev-parse", "--verify", "refs/heads/release"); } catch (e) { parent = null; }

const args = ["commit-tree", tree, "-m", "release: v" + version];
if (parent) args.push("-p", parent);
const commit = execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
git("update-ref", "refs/heads/release", commit);
console.log("release 分支已更新:", commit.slice(0, 8), "v" + version, parent ? "(接在上一版之后)" : "(首个提交)");
console.log("推送: git push origin release");
