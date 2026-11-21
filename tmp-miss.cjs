const fs=require("fs");
for(const f of ["miss-ucsc.json","miss-ensembl.json","miss-gepia2.json","miss-ualcan.json"]){
 const p="research/"+f; if(!fs.existsSync(p))continue;
 const j=JSON.parse(fs.readFileSync(p,"utf8"));
 const t=(j.texts||[]).filter(x=>/[A-Za-z]{3}/.test(x[0])&&/[a-z]/.test(x[0]));
 console.log("==",f,"miss",t.length, JSON.stringify(j.stats&&j.stats.tpl));
 console.log(t.slice(0,20).map(x=>x[1]+"x "+x[0]).join(" | "));
}