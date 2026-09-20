import fs from 'node:fs';

const f = process.argv[2] ?? 'docs/testing/coverage/02-acl.md';
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const counts = new Map();
let rows = 0;
for (const line of lines) {
  if (!line.startsWith('| ')) continue;
  const cells = line.split('|').map((c) => c.trim());
  // cells[0] === '' ，cells[1] = ID
  const id = cells[1];
  if (!id || id === 'ID' || id === '覆盖' || id.startsWith('---')) continue;
  const cov = cells[5];
  if (!cov) continue;
  if (!/^(已测|部分测|缺测|缺实现|延后|UAT)$/.test(cov)) continue;
  rows += 1;
  counts.set(cov, (counts.get(cov) ?? 0) + 1);
}
const out = { rows, ...Object.fromEntries([...counts.entries()].sort()) };
fs.writeFileSync(
  `.scratch/kb-role-vs-code/counts${process.argv[3] ?? ''}.json`,
  JSON.stringify(out, null, 2),
  'utf8',
);
console.log(JSON.stringify(out));
