import fs from "node:fs";import {JSDOM} from "jsdom";
const srcEngine=fs.readFileSync("X:/code/biol10n/src/engine.js","utf8");
const createEngine=new Function(srcEngine+"; return createEngine;")();
const data={exact:{"Found an exact match:":"找到精确匹配："},rules:[
{re:"^Found an exact gene match for (.+) in the following key species:$",to:"在以下关键物种中找到与 $1 精确匹配的基因："},
{re:"^Showing (\\d+) of ([\\d,]+) results$",to:"显示第 $1 条，共 $2 条结果"}],templates:[]};
const dom=new JSDOM("<div><p>Showing <b>1</b> of <b>20</b> results</p></div>",{url:"https://x/"});
const engine=createEngine({document:dom.window.document,window:dom.window,data,site:{id:"t",dicts:[]}});
engine.start();
const p=dom.window.document.querySelector("p");
console.log("TEXT:",JSON.stringify(p.textContent));
console.log("STATS:",JSON.stringify(engine.stats));
console.log("WHY:",JSON.stringify(engine.why&&engine.why(p.firstChild)));
