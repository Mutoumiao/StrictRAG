import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const out = execFileSync(process.execPath, ['scripts/module-status/check.mjs', '--json'], {
  encoding: 'utf8',
});
const findings = JSON.parse(out);
const byCheck = {};
for (const f of findings) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
const summary = {
  总数: findings.length,
  分类: byCheck,
  联动: findings.filter((f) => f.check === '6-联动'),
  db表claim: findings.filter((f) => f.check === '5-表' && f.doc === 'db.md').map((f) => f.claim),
};
fs.writeFileSync(
  `.scratch/migration-default-parity/check-summary${process.argv[2] ?? ''}.json`,
  JSON.stringify(summary, null, 2),
  'utf8',
);
console.log('total =', findings.length, 'checks =', Object.keys(byCheck).join(','));
