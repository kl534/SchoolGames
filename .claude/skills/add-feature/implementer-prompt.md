You are implementing an agreed design in the SchoolGames repo at <REPO_ROOT>. The owner and the
designer have already settled every decision. Your job is to build it exactly, test it properly
and open a pull request. You can't ask the owner anything. If the doc leaves something open, make
the simplest choice that fits it and list it in your report.

- Design doc: <DOC_PATH> (absolute path; it is untracked, so don't commit it)
- Build: <MILESTONE> (for example "M2 only", or "the whole doc")
- Branch: `<BRANCH>`, created from `<BASE>`

## Steps

1. Read `CLAUDE.md` and the design doc. Then read only the files and sections the doc names: use
   `grep -n` and `Read` with `offset`/`limit` for any file over 400 lines. Never `cat` a whole test
   file. Run `git log -15` to see the commit style.
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
4. Checks. While building, run only the related tests (`npx vitest run tests/<file>.test.ts` or
   `npx vitest related --run <changed files>`). Run `npm run check` once at the end and again after
   a fix. It formats (commit any changes it makes), lints, type-checks, runs the full tests and
   builds, and prints only failures. Any Node >= 22 is fine, because CI checks Node 22.
5. Check it in a real browser with `npm run shots`:
   - Use it for every state in the doc's definition of done. Put several targets in one call, such as
     `npm run shots -- 'game?dev=hook' game2 --start`. It writes one tiled sheet per target (all four
     sizes) to `.shots/`. Read each sheet once, and look at it yourself.
   - After a fix, re-shoot only the affected target and only at the sizes that were wrong
     (`--sizes 844x390`). Write a custom `--script` only for a state that no dev hook reaches, and
     keep it in the scratchpad. Aim for 10 sheet reads or fewer.
   - If a state needs frozen time, the doc must provide an `at=`-style dev hook. Don't commit
     test-only hooks unless the doc asks for them.
6. Push and open the PR:
   - `git push -u origin <BRANCH>`. If the push fails because of the network, retry up to 4 times
     and wait 2, 4, 8 and 16 s between tries.
   - `gh pr create --base <PR_BASE> --head <BRANCH>`. The title is in the commit style. The body
     follows the repo's earlier PRs (see `gh pr view 22`):
     - `## Summary`: what the player now sees and does, as bold-lead bullets, then a short "Code:"
       paragraph.
     - `## Test plan`: `- [x]` for each check you ran (`npm run check` with the test count, the
       `shots` targets you looked at). `- [ ]` for each thing you couldn't check (a real
       phone, real speech timing, sound levels).
     - If the PR stacks on an unmerged branch, say so at the top.
     - End with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
   - Only open the PR once every check in step 4 passes and the browser check is done. If
     something can't be made to pass, don't open it, and report why.

## Report back

Keep it short, 25 lines at most:

- The PR URL and branch.
- What you built, in a few bullets.
- The result of `npm run check` (and the test count).
- Which `shots` sheets you checked.
- Every **(default)** you changed and why, and every gap in the doc you had to fill.
- Anything left undone or not checked.
