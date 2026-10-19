/**
 * `npm run shots -- <target>...`: headless Chromium screenshots, one tiled JPEG sheet per
 * target (all four sizes in a 2×2 grid). See `args.ts` for the options.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import {
  parseShotArgs,
  sheetLayout,
  cellRect,
  slug,
  targetPath,
  type ShotOptions,
  type Size,
} from './args';

const root = fileURLToPath(new URL('../..', import.meta.url));
const PHONE_MAX_WIDTH = 900;
const START_WAIT = 3000;
const START_BUTTON = '.sg-overlay .sg-btn-primary';

type ShotScript = (page: Page, size: Size) => Promise<void>;

interface Shot {
  size: Size;
  png: Buffer;
  errors: string[];
  threw: boolean;
}

/** A game page without `?topic=` goes back to the menu, so a game target gets `topic=my-level`. */
function withTopic(target: string): string {
  const path = targetPath(target);
  if (!path.startsWith('/src/games/') || /[?&]topic=/.test(path)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}topic=my-level`;
}

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function shoot(
  browser: Browser,
  origin: string,
  target: string,
  size: Size,
  options: ShotOptions,
  script: ShotScript | undefined,
): Promise<Shot> {
  const isMobile = Math.min(size.w, size.h) < 500;
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: isMobile && size.w < PHONE_MAX_WIDTH,
  });
  const errors: string[] = [];
  let threw = false;
  try {
    // Games send you to the player picker without a current player, so seed one.
    await context.addInitScript(() => {
      try {
        if (!localStorage.getItem('sg:current-player')) {
          const player = { id: 'shots', name: 'Shots', avatar: '🦊' };
          localStorage.setItem('sg:players', JSON.stringify([player]));
          localStorage.setItem('sg:current-player', player.id);
        }
      } catch {
        // No storage: the page shows the player picker.
      }
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => {
      threw = true;
      errors.push(
        String(e.stack ?? e.message)
          .split('\n')
          .slice(0, 2)
          .join(' '),
      );
    });
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(origin + withTopic(target), { waitUntil: 'load' });
    await pause(options.wait);
    if (options.start) {
      // Not every target has a preview (a lab or the menu skips it), so a missing button is fine.
      const tapped = await page.tap(START_BUTTON, { timeout: START_WAIT }).then(
        () => true,
        () => false,
      );
      if (tapped) await pause(options.wait);
    }
    for (const step of options.steps) {
      if (step.kind === 'tap') await page.tap(step.selector, { timeout: 10_000 });
      else if (step.kind === 'tapat') {
        await page.touchscreen.tap((step.x / 100) * size.w, (step.y / 100) * size.h);
      } else if (step.kind === 'wait') await pause(step.ms);
      else await page.keyboard.press(step.key);
    }
    if (script) await script(page, size);
    if (options.steps.length || script) await pause(options.wait);
    const png = await page.screenshot({ type: 'png' });
    return { size, png, errors, threw };
  } catch (e) {
    errors.push(`shot failed: ${e instanceof Error ? e.message : String(e)}`);
    return { size, png: Buffer.alloc(0), errors, threw: true };
  } finally {
    await context.close();
  }
}

/** Draw the screenshots on a canvas in a blank page and return it as a JPEG. */
async function composeSheet(browser: Browser, shots: Shot[]): Promise<Buffer> {
  const layout = sheetLayout(shots.length);
  const cells = shots.map((shot, i) => {
    const cell = layout.cells[i];
    return {
      rect: cellRect(shot.size, cell),
      label: `${shot.size.w}×${shot.size.h}`,
      cell,
      data: shot.png.length ? `data:image/png;base64,${shot.png.toString('base64')}` : '',
    };
  });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: layout.w, height: layout.h },
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await page.setContent(
      `<body style="margin:0;background:#1b1b1b"><canvas id="c" width="${layout.w}" height="${layout.h}"></canvas></body>`,
    );
    await page.evaluate(async (items) => {
      const canvas = document.getElementById('c') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const item of items) {
        if (item.data) {
          const img = new Image();
          img.src = item.data;
          await img.decode();
          ctx.drawImage(img, item.rect.x, item.rect.y, item.rect.w, item.rect.h);
        }
        ctx.font = '14px sans-serif';
        const width = ctx.measureText(item.label).width + 10;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(item.cell.x, item.cell.y, width, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(item.label, item.cell.x + 5, item.cell.y + 15);
      }
    }, cells);
    return await page.screenshot({ type: 'jpeg', quality: 80 });
  } finally {
    await context.close();
  }
}

async function main(): Promise<number> {
  const options = parseShotArgs(process.argv.slice(2));
  let script: ShotScript | undefined;
  if (options.script) {
    const mod = (await import(pathToFileURL(resolve(options.script)).href)) as {
      default: ShotScript;
    };
    script = mod.default;
  }

  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  let failed = false;
  try {
    let origin = options.url;
    if (!origin) {
      server = await createServer({ root, logLevel: 'silent', server: { port: 0 } });
      await server.listen();
      origin = `http://localhost:${(server.httpServer!.address() as AddressInfo).port}`;
    }
    browser = await chromium.launch({
      executablePath: process.env.SG_CHROME || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
    });
    const outDir = resolve(root, options.out);
    await mkdir(outDir, { recursive: true });
    for (const target of options.targets) {
      const shots = await Promise.all(
        options.sizes.map((size) => shoot(browser!, origin!, target, size, options, script)),
      );
      const file = resolve(outDir, `${options.name ?? slug(target)}.jpg`);
      await writeFile(file, await composeSheet(browser, shots));
      const errorCount = shots.reduce((n, s) => n + s.errors.length, 0);
      const shown = file.startsWith(root) ? file.slice(root.length) : file;
      console.log(`wrote ${shown} (${shots.length} sizes, ${errorCount} errors)`);
      for (const shot of shots) {
        if (!shot.errors.length) continue;
        console.log(`${shot.size.w}x${shot.size.h}: ${shot.errors.length} errors`);
        for (const line of shot.errors.slice(0, 5)) console.log(`  ${line.slice(0, 200)}`);
      }
      if (shots.some((s) => s.threw)) failed = true;
    }
  } finally {
    await browser?.close();
    await server?.close();
  }
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
