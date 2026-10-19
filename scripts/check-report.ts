/** Pure helpers for `npm run check` (see `check.ts`). */

// eslint-disable-next-line no-control-regex -- matching the escape character is the point
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

/** Remove terminal colour and cursor codes. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/** The last `n` lines of `text`. When lines are cut, a `… (N lines cut)` line goes on top. */
export function tail(text: string, n: number): string {
  const lines = text.replace(/\n+$/, '').split('\n');
  if (lines.length <= n) return lines.join('\n');
  return [`… (${lines.length - n} lines cut)`, ...lines.slice(-n)].join('\n');
}

/** The number of passed tests in Vitest's `Tests  1640 passed (1640)` line, or null. */
export function testCount(output: string): number | null {
  const match = /^\s*Tests\s+(?:\d+ failed \| )?(\d+) passed/m.exec(stripAnsi(output));
  return match ? Number(match[1]) : null;
}

/** One summary line: `lint    ok   2.1s`. `detail` is whatever follows the status. */
export function formatLine(name: string, ok: boolean, detail: string): string {
  return `${name.padEnd(7)} ${(ok ? 'ok' : 'FAIL').padEnd(4)} ${detail}`.trimEnd();
}
