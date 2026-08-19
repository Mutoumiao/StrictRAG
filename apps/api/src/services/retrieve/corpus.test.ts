import { describe, expect, it } from 'vitest';

import {
  parseDeptInheritDownFromConfig,
  resolveDeptInheritDown,
} from '../kb-settings.js';
import { filterDocsForRetrieve } from './corpus.js';
import { filterDocsForDeptAcl } from './dept-acl.js';

describe('filterDocsForRetrieve（语料装载双闸门）', () => {
  const base = [
    { id: 'a', status: 'ready', lifecycle: 'active', docType: 'hr' },
    { id: 'b', status: 'ready', lifecycle: 'draft', docType: 'hr' },
    { id: 'c', status: 'embedding', lifecycle: 'active', docType: 'hr' },
    { id: 'd', status: 'ready', lifecycle: 'superseded', docType: 'tech' },
    { id: 'e', status: 'ready', lifecycle: 'active', docType: 'tech' },
    { id: 'f', status: 'failed', lifecycle: 'active', docType: 'hr' },
  ] as const;

  it('R7: excludes draft / superseded / non-ready（未双就绪∧active 被滤）', () => {
    const ids = filterDocsForRetrieve([...base]).map((d) => d.id);
    expect(ids).toEqual(['a', 'e']);
  });

  it('scope.docTypes filters after dual gate', () => {
    const ids = filterDocsForRetrieve([...base], { docTypes: ['hr'] }).map((d) => d.id);
    expect(ids).toEqual(['a']);
  });

  it('empty scope.docTypes does not filter types', () => {
    const ids = filterDocsForRetrieve([...base], { docTypes: [] }).map((d) => d.id);
    expect(ids).toEqual(['a', 'e']);
  });

  it('missing docType never matches non-empty scope', () => {
    const docs = [
      { id: 'x', status: 'ready', lifecycle: 'active', docType: null },
      { id: 'y', status: 'ready', lifecycle: 'active', docType: 'hr' },
    ];
    expect(filterDocsForRetrieve(docs, { docTypes: ['hr'] }).map((d) => d.id)).toEqual(['y']);
  });
});

describe('loadCorpus 同形：KB deptInheritDown 覆盖 env', () => {
  const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
  const DEPT_B = '01900000-0000-7000-8000-0000000000b1';
  const tree = [
    { id: DEPT_A, path: `/${DEPT_A}/` },
    { id: DEPT_B, path: `/${DEPT_A}/${DEPT_B}/` },
  ];
  const docs = [
    { id: 'a', status: 'ready', lifecycle: 'active', ownerDeptId: DEPT_A, visibilityLevel: 20 },
    { id: 'b', status: 'ready', lifecycle: 'active', ownerDeptId: DEPT_B, visibilityLevel: 20 },
  ];

  it('enforce + 祖先 + KB false → 子孙不可检索，精确仍可', () => {
    const prev = process.env.DEPT_INHERIT_DOWN;
    process.env.DEPT_INHERIT_DOWN = 'true';
    try {
      const inheritDown = resolveDeptInheritDown(
        parseDeptInheritDownFromConfig({ deptInheritDown: false }),
      );
      const dual = filterDocsForRetrieve(docs);
      const ancestorIds = filterDocsForDeptAcl(dual, {
        assignments: [{ deptId: DEPT_A, isLeader: false }],
        enforce: true,
        depts: tree,
        inheritDown,
      }).map((d) => d.id);
      expect(ancestorIds).toEqual(['a']);
      const exactIds = filterDocsForDeptAcl(dual, {
        assignments: [{ deptId: DEPT_B, isLeader: false }],
        enforce: true,
        depts: tree,
        inheritDown,
      }).map((d) => d.id);
      expect(exactIds).toEqual(['b']);
    } finally {
      if (prev === undefined) delete process.env.DEPT_INHERIT_DOWN;
      else process.env.DEPT_INHERIT_DOWN = prev;
    }
  });
});
