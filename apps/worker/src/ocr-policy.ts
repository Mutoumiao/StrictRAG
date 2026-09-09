/**
 * P5 OCR 开闸启动告警（Q9）。
 * 关闸或非 staging/prod → 无告警。开闸缺 ADR_REF 只告警，不拒启动（对照 Q10）。
 */
export function ocrStartupWarning(input: {
  APP_ENV: string;
  INGEST_OCR_ENABLED: boolean;
  INGEST_OCR_ADR_REF: string;
}): string | null {
  if (!input.INGEST_OCR_ENABLED) return null;
  if (input.APP_ENV !== 'staging' && input.APP_ENV !== 'production') return null;
  if (input.INGEST_OCR_ADR_REF.trim()) return null;
  return 'INGEST_OCR_ENABLED=true requires INGEST_OCR_ADR_REF in staging/production';
}
