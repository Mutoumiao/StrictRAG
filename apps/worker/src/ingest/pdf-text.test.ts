import { describe, expect, it } from 'vitest';

import { extractPdfTextLayer, isPdfObject } from './pdf-text.js';

function miniPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 10 100 Td (${text}) Tj ET`;
  const body = `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF
`;
  return Buffer.from(body, 'latin1');
}

describe('isPdfObject', () => {
  it('matches pdf mime', () => {
    expect(isPdfObject('application/pdf', 'x')).toBe(true);
    expect(isPdfObject('text/plain', 'a.txt')).toBe(false);
  });
});

describe('extractPdfTextLayer', () => {
  it('extracts uncompressed Tj text', () => {
    const t = extractPdfTextLayer(miniPdf('Hello PDF text layer content here'));
    expect(t).toContain('Hello PDF text layer');
  });

  it('empty scan-like pdf returns null', () => {
    expect(extractPdfTextLayer(Buffer.from('%PDF-1.1 no text operators', 'latin1'))).toBeNull();
  });
});
