/**
 * HALF-ENV：解析可运行叠加样例（KEY=VALUE，忽略空行与 # 注释）。
 * 给单测 / 脚本读 `.env.operable.example`，不是运行时 env 加载器。
 */
export function parseEnvAssignments(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}
