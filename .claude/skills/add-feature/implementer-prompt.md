You are implementing an agreed design in the SchoolGames repo at <REPO_ROOT>. The owner and the
designer have already settled every decision. Your job is to build it exactly, test it properly
and open a pull request. You can't ask the owner anything. If the doc leaves something open, make
the simplest choice that fits it and list it in your report.

- Design doc: <DOC_PATH> (absolute path; it is untracked, so don't commit it)
- Build: <MILESTONE> (for example "M2 only", or "the whole doc")
- Branch: `<BRANCH>`, created from `<BASE>`

## Steps

1. Read `CLAUDE.md`, then the whole design doc, then every file the doc names. Run `git log -15`
   to see the commit style.
2. `git fetch origin`, then `git checkout -b <BRANCH> <BASE>`. If the working tree has changes
   outside `docs/`, stop and report it. Don't stash or discard anyone's work.
3. Build it in small steps, one commit per coherent step, with messages in the repo's style
   (`<Game>: <what changed, in plain words>`). End each commit message with the Co-Authored-By
   trailer from your instructions. Don't commit the design doc or anything else in `docs/`.
   - Follow the doc's types, names, constants and file layout exactly. A **(default)** may change
     only if it clearly plays or looks badly, and you must give the reason in your report.
   - Write the tests the doc lists, and remove the ones it marks obsolete.
   - New spoken lines go in the game's `voice.ts`. Then run `npm run voice` (it needs `uv`) and
     commit the new clips in `public/voice/` and `src/shared/voice-lines.json`. If `uv` is missing,
     say so in your report and don't fake the clips.
4. Checks. All four must pass:
   - Tests need Node 22 (`.nvmrc`). If `node -v` isn't 22, run
     `npm i --prefix /tmp/node22 node@22` (unless it's already there) and put
     `/tmp/node22/node_modules/.bin` first on `PATH` for these commands.
   - `npm run lint`, `npm run format` (commit any changes it makes), `npm test`, `npm run build`.
5. Check it in a real browser:
   - Start `npm run dev` in the background. On `/mnt/f`, use `CHOKIDAR_USEPOLLING=1` or restart it
     after edits, because file watching doesn't work there.
   - Drive it with Playwright Chromium. Use `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` if it
     exists. Otherwise use the cached `~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome` as
     `executablePath`. Don't run `playwright install`. On WSL, `unset WAYLAND_DISPLAY DISPLAY` and
     pass `--enable-unsafe-swiftshader` for WebGL. If system libraries are missing, extract them
     with `apt-get download` + `dpkg -x` and set `LD_LIBRARY_PATH`.
   - Check every state the doc's definition of done lists, at 390×844, 844×390, 1024×768 and
     1366×1024. Drive answers by reading the question and tapping the right button. Look at the
     screenshots yourself. Fix what's wrong and check again.
   - Software rendering is slow. If timing gets in the way, step `requestAnimationFrame` and
     `performance.now` by hand with `addInitScript`. Don't commit test-only hooks unless the doc
     asks for them.
   - Stop the dev server when you're done.
6. Push and open the PR:
   - `git push -u origin <BRANCH>`. If the push fails because of the network, retry up to 4 times
     and wait 2, 4, 8 and 16 s between tries.
   - `gh pr create --base <PR_BASE> --head <BRANCH>`. The title is in the commit style. The body
     follows the repo's earlier PRs (see `gh pr view 22`):
     - `## Summary`: what the player now sees and does, as bold-lead bullets, then a short "Code:"
       paragraph.
     - `## Test plan`: `- [x]` for each check you ran (lint, format, test with the test count,
       build, the browser sizes and states). `- [ ]` for each thing you couldn't check (a real
       phone, real speech timing, sound levels).
     - If the PR stacks on an unmerged branch, say so at the top.
     - End with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
   - Only open the PR once every check in step 4 passes and the browser check is done. If
     something can't be made to pass, don't open it, and report why.

## Report back

Keep it short:

- The PR URL and branch.
- What you built, in a few bullets.
- The results of lint, format, test (with the count) and build.
- What you checked in the browser, at which sizes.
- Every **(default)** you changed and why, and every gap in the doc you had to fill.
- Anything left undone or not checked.
