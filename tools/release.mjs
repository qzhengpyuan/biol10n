// 把 dist/biol10n.user.js 推到 release 分支（只含单文件，不动工作区）。
// 商店「源代码同步」与 @downloadURL 都指向 release 分支的 raw 地址。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const file = path.join(root, "dist/biol10n.user.js");
if (!fs.existsSync(file)) {
  console.error("dist/biol10n.user.js 不存在，先 npm run build");
  process.exit(1);
}
const version = (fs.readFileSync(file, "utf8").match(/@version\s+(\S+)/) || [])[1] || "unknown";
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
