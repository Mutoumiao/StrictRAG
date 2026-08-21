import { describe, expect, it } from 'vitest';

import {
  decodeUtf8Text,
  extractUtf8TextLayer,
  hasUtf8TextLayer,
} from './extract-text.js';

describe('hasUtf8TextLayer', () => {
  it('accepts txt/md by contentType', () => {
    expect(hasUtf8TextLayer('text/plain', 'x.bin')).toBe(true);
    expect(hasUtf8TextLayer('text/plain; charset=utf-8', null)).toBe(true);
    expect(hasUtf8TextLayer('text/markdown', 'a')).toBe(true);
    expect(hasUtf8TextLayer('text/x-markdown', 'kb/x/docs/y/uuid')).toBe(true);
  });

  it('accepts txt/md by extension when type missing', () => {
    expect(hasUtf8TextLayer(null, 'kb/d/note.md')).toBe(true);
    expect(hasUtf8TextLayer('', 'readme.TXT')).toBe(true);
    expect(hasUtf8TextLayer(null, 'guide.markdown')).toBe(true);
  });

  it('rejects pdf and unknown as no text layer', () => {
    expect(hasUtf8TextLayer('application/pdf', 'a.pdf')).toBe(false);
    expect(hasUtf8TextLayer('application/pdf', 'kb/x/docs/y/uuid')).toBe(false);
    expect(hasUtf8TextLayer('application/octet-stream', 'a.bin')).toBe(false);
    expect(hasUtf8TextLayer(null, 'scan.png')).toBe(false);
  });

  it('does not let .md/.txt extension override application/pdf', () => {
    expect(hasUtf8TextLayer('application/pdf', 'note.md')).toBe(false);
    expect(hasUtf8TextLayer('application/pdf; charset=binary', 'a.txt')).toBe(false);
  });
});

describe('decodeUtf8Text', () => {
  it('decodes utf8 buffer', () => {
    expect(decodeUtf8Text(Buffer.from('你好', 'utf8'))).toBe('你好');
  });
});

describe('extractUtf8TextLayer', () => {
  it('extracts utf8 for txt and md', () => {
    const body = Buffer.from('请假需提前一天书面申请。', 'utf8');
    expect(extractUtf8TextLayer('text/plain', 'kb/x/docs/y/uuid', body)).toEqual({
      ok: true,
      text: '请假需提前一天书面申请。',
    });
    expect(extractUtf8TextLayer('text/markdown', 'note.bin', body)).toEqual({
      ok: true,
      text: '请假需提前一天书面申请。',
    });
    expect(extractUtf8TextLayer(null, 'kb/d/note.md', body)).toEqual({
      ok: true,
      text: '请假需提前一天书面申请。',
    });
  });

  it('needs_ocr for pdf bytes and does not return utf8 garbage', () => {
    const pdfish = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xfe]);
    const r = extractUtf8TextLayer('application/pdf', 'kb/x/docs/y/uuid', pdfish);
    expect(r).toEqual({ ok: false, errorCode: 'NO_TEXT_LAYER' });
    expect(r).not.toEqual({ ok: true, text: decodeUtf8Text(pdfish) });
  });
});
