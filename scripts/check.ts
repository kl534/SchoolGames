/**
 * `npm run check`: format (fixes, never fails), then lint, types, full tests and build in
 * parallel. Prints one line per step and the output of failing steps only.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatLine, stripAnsi, tail, testCount } from './check-report';

const root = fileURLToPath(new URL('..', import.meta.url));
const KEEP_LINES = 150;

interface Result {
  code: number;
  output: string;
  seconds: number;
}

function run(bin: string, args: string[], env: Record<string, string> = {}): Promise<Result> {
  return new Promise((resolve) => {
    const started = Date.now();
    let output = '';
    const child = spawn(`${root}node_modules/.bin/${bin}`, args, {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: '0', ...env },
    });
    child.stdout.on('data', (d: Buffer) => (output += d));
    child.stderr.on('data', (d: Buffer) => (output += d));
    child.on('error', (e) => {
      output += String(e);
      resolve({ code: 1, output, seconds: (Date.now() - started) / 1000 });
    });
    child.on('close', (code) =>
      resolve({
        code: code ?? 1,
        output: stripAnsi(output),
        seconds: (Date.now() - started) / 1000,
      }),
    );
  });
}

const secs = (r: Result) => `${r.seconds.toFixed(1)}s`;

async function main(): Promise<void> {
  const format = await run('prettier', ['--write', '--list-different', '.']);
  // Prettier lists rewritten files, one path per line. Anything else is an error message.
  const changed = format.output.split('\n').filter((l) => l.trim() && !/^\[|error/i.test(l));
  const formatBroke = format.code !== 0 && changed.length === 0;
  console.log(
    formatBroke
      ? formatLine('format', false, secs(format))
      : formatLine(
          'format',
          true,
          changed.length
            ? `${changed.length} file${changed.length === 1 ? '' : 's'} rewritten: ${changed.join(', ')}`
            : 'no changes',
        ),
  );

  const steps = [
    { name: 'lint', job: run('eslint', ['.']) },
    { name: 'types', job: run('tsc', ['--noEmit']) },
    { name: 'test', job: run('vitest', ['run'], { FULL_TESTS: '1' }) },
    { name: 'build', job: run('vite', ['build']) },
  ];
  const results = await Promise.all(steps.map((s) => s.job));
  const failed: string[] = formatBroke ? ['format'] : [];
  if (formatBroke) console.log(tail(format.output, KEEP_LINES));
  steps.forEach((step, i) => {
    const r = results[i];
    const ok = r.code === 0;
    const count = step.name === 'test' ? testCount(r.output) : null;
    const detail = count === null ? secs(r) : `${count} tests  ${secs(r)}`;
    console.log(formatLine(step.name, ok, ok ? detail : secs(r)));
    if (!ok) {
      failed.push(step.name);
      console.log(tail(r.output, KEEP_LINES));
    }
  });

  if (failed.length) {
    console.log(`check failed: ${failed.join(', ')}`);
    process.exit(1);
  }
  console.log('check ok');
}

void main();
