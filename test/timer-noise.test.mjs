import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync('config/sites.json', 'utf8'));
const site = cfg.sites.find(s => s.id === 'timer2');

function compile() {
  const rules = [], subs = [];
  for (const n of site.missNoise || []) {
    const raw = String(n);
    if (raw.startsWith('rec:')) rules.push({ re: new RegExp(raw.slice(4)), cs: true });
    else if (raw.startsWith('re:')) rules.push({ re: new RegExp(raw.slice(3), 'i'), cs: false });
    else subs.push(raw.toLowerCase());
  }
  return { rules, subs };
}
const { rules, subs } = compile();
function isNoise(t) {
  const raw = String(t), low = raw.toLowerCase();
  for (const n of subs) if (n && low.includes(n)) return true;
  for (const r of rules) if (r.re.test(r.cs ? raw : low)) return true;
  return false;
}

test('timer2 名单：题录/期刊/卷期页码/作者/术语/工具名被滤掉', () => {
  const noise = [
    'Cui et al. TIMER3: an enhanced resource for tumor immune analysis.',
    'Nucleic Acids Research',
    'Cancer Research.',
    '2025;53(W1):W534-W541.',
    '2020;48(W1):W509-W514.',
    '2017;77(21):e108-e110.',
    'Hao Cui:',
    'GO:BP',
    'LGG_E_MTAB_6270',
    'immunedeconv',
    'MCP-counter,',
    'CIBERSORT',
    ', respectively.',
    // 版本号形态（克隆号模式 AC000003.1 的同族）也是数据，不译
    'TIMER2.0',
  ];
  for (const t of noise) assert.equal(isNoise(t), true, '应被滤掉: ' + t);
});

test('timer2 名单：界面词不被吃掉', () => {
  const ui = [
    'Search Results:',
    'Read more',
    'Download',
    'Gene',
    'Immune Infiltration',
    'Survival Analysis',
    'Search',
    'View',
  ];
  for (const t of ui) assert.equal(isNoise(t), false, '不该被滤掉: ' + t);
});

test('timer2 名单：record 正则与 re 正则并存且大小写语义正确', () => {
  assert.equal(rules.some(r => r.cs), true);
  // rec: 大小写敏感：小写 study 名不该被基因符号模式吃掉
  assert.equal(isNoise('search results:'), false);
});
