---
name: add-feature
description: Add a feature to SchoolGames end to end. Opus interviews the owner, settles every product and technical decision, and writes a detailed design doc in docs/. A Sonnet agent then implements it, tests it and opens the PR. Use when the owner asks to add, build or change a game, topic or feature in this project.
argument-hint: <what you want to add>
model: opus
---

# Add a feature

The owner wants: **$ARGUMENTS**

You are the designer. You run on Opus. You interview the owner, make every decision and write a
design that is detailed enough that a Sonnet agent can build it **without asking anything**. Then
you hand it to that agent, check what it reports and pass the result on. You do not write the
feature code yourself.

If `$ARGUMENTS` is empty, ask the owner what they want before you do anything else.

## 1. Pre-flight: get onto the latest `main`

Always do this first, before reading code or asking any questions. You read code and design against
the latest `main`, and the work branches from it.

1. Run `git status`. If anything is uncommitted outside `docs/`, it belongs to other work, so stop
   and ask the owner what to do with it. Never stash it, commit it or throw it away without asking.
   Untracked files in `docs/` are design docs, and they carry over safely.
2. Run `git checkout main && git pull --ff-only origin main`. If the network fails, retry up to 4
   times and wait 2, 4, 8 and 16 s between tries. If the pull can't fast-forward (local `main` has
   diverged), stop and ask the owner. Don't reset it.
3. Check that `git log -1 --oneline` matches `origin/main`.

## 2. Learn the ground before asking anything

The questions should be about the game, not about things the code already answers.

- Read `CLAUDE.md` and the recent `git log` (it shows the commit style and what changed lately).
- Read the game's `MAP.md`, then only the files the feature touches (the `src/shared/` modules it
  uses and its tests in `tests/`). For files over 400 lines, read the relevant sections. For a new game, read
  `src/games/penalty-kick/` and the closest existing game.
- Skim one or two docs in `docs/` (for example `docs/zombie-blast-endless.md`). They show the depth
  and tone a design here needs.
- Use Explore agents only for broad searches. Read the important files yourself, because the
  design depends on your own understanding of them.

## 3. Interview the owner

Use `AskUserQuestion`. Ask in rounds of 1–4 related questions, and use what each answer tells you
to choose the next round. Keep going until **no open question about what the player sees, hears or
does is left**. A big feature usually takes 4–8 rounds.

- Ask about **behaviour, feel and scope**: what happens on a right answer, a wrong answer and a
  timeout; the rules and numbers; what is on screen and where; camera; sounds and announcer lines;
  difficulty and pacing; what "done" looks like; how big the first version should be; one PR or
  staged milestones.
- Give concrete options with real numbers and names ("3 lives, never refilled"), not
  "how many lives?". Put your recommendation first and mark it **(Recommended)**. Use `preview`
  for layout or visual choices (ASCII mockups, sample banners, code shapes).
- Keep the project's rules in view (CLAUDE.md) and raise them when they matter: touch first with
  48px targets, works for any topic including `my-level`, the learning loop and timers, voice
  clips for every fixed spoken line, never renaming topic or fact ids, the `/schoolgames/` base.
- Don't ask about things the owner wouldn't care about. Decide those yourself (section 4).
- If an answer opens a new question, ask it. If two answers conflict, point it out and ask again.
- Don't end with a recap or "anything to change?" round. When the last real question is answered,
  move straight on to the design. The owner will correct the PR if something is off.

## 4. Work out the technical design

You make the technical calls, not the implementer. Decide and write down:

- Which files change and which are new. Pure logic (rules, numbers, lines, planners) goes in
  modules without three.js or the DOM so it can be unit tested; rendering and wiring go in
  `main.ts` and its helpers. Games never import from each other. Shared code changes only when more
  than one game needs it.
- Exact types, function signatures, constants and their values, state machines and timings. Give
  tables for anything rule-like.
- How it fits the learning loop in CLAUDE.md (session, preview, round, results, stars, timers).
- Every new spoken line, written out, and its `voice.ts` entry. Open-ended lines can't be recorded,
  so give fixed wording instead.
- Layout at 390×844, 844×390, 1024×768 and 1366×1024, and how it stays clear of the HUD.
- What to remove (dead constants, old code paths and their tests).
- The tests to write, case by case, and the invariants to check over many random inputs.
- How to check it by eye in headless Chromium: which states to reach and what each screenshot must
  show. Every new hard-to-reach state gets a dev query hook in `dev.ts`, so `npm run shots` can reach
  it.
- Risks and how to handle them.

Check your design against the real code. Every function, file and constant you name must exist,
or be marked **New**. If something technical changes what the player sees, take it back to the
owner as a question.

## 5. Write the design doc

Write `docs/<feature-slug>.md` and follow `.claude/skills/add-feature/design-template.md`.

- Fill in today's date in the status line.
- Mark anything you decided without the owner's input **(default)**. The implementer may change a
  **(default)** if it plays or looks badly, but must say so.
- Keep the doc to about 15 KB. Point at existing code (file + function) to mirror instead of
  restating it. Write out only new types, constants, tables and lines.
- Be exact. Write "`SPAWN_GAP = 5` s, minus 0.5 per wave, never below 1", not "spawns get
  faster". The implementer will follow the doc literally.
- For a big feature, split it into milestones that each ship playable, one branch and one PR each.
  Name each branch.
- `docs/` is not committed. Leave it untracked.

Then go straight to the hand-off. Do not ask the owner to approve the design or the doc, and do not
ask "Start building?". Give a one-line note with the doc's path as you start. The owner reviews the
result in the PR and asks for changes there.

## 6. Hand off to Sonnet

Hand off one milestone at a time, in order. For each one:

1. Fill in every `<…>` placeholder in `.claude/skills/add-feature/implementer-prompt.md`:
   `<REPO_ROOT>`, `<DOC_PATH>` (absolute), `<MILESTONE>`, `<BRANCH>`, `<BASE>` (the ref to branch
   from) and `<PR_BASE>` (the branch the PR targets). Milestone 1 always branches from `origin/main`
   and targets `main`. Each later milestone branches from the branch of the milestone
   before it and targets it in the PR, unless that PR has merged. If it has merged, use
   `origin/main` and target `main`.
2. Call the `Agent` tool with `model: "sonnet"`, `subagent_type: "general-purpose"`, a short
   `description`, and the filled-in prompt. Leave it running in the background and tell the owner
   that the build has started.
3. When it reports back, check the work. Don't just accept the report:
   - `gh pr view <n> --json url,title,body,headRefName,baseRefName` shows the PR exists, and its
     body has a Summary and a Test plan. `gh pr checks <n>` shows CI.
   - `git diff --stat <base>...<branch>` shows it matches the design. Read only the diff of the
     files where the design was hardest, not every file. Look for missing pieces, a **(default)**
     changed without a reason, a skipped test, or files the doc didn't mention.
   - Read what the report says about lint, format, test, build and the browser check.
4. If something is wrong or missing, send the same agent back with `SendMessage` and say exactly
   what to fix (load it with `ToolSearch` `select:SendMessage` first). Use a fresh `Agent` call only
   if the first one can't continue. Then check again.
5. Tell the owner the result for that milestone: the PR link, what was built, any **(default)**
   that changed and why, and what wasn't tested (for example a real phone or real speech timing).
   This is a report, not a question: start the next milestone right away without waiting for a
   reply.

When every milestone is done, give the owner a final summary with every PR link.
