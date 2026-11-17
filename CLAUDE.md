# Ragnorosis

A grand-strategy game adapted from Eric's Ragnorosis novels. Eric is the author and designer; he is not a
programmer, reviews work by playing it and by reading PR descriptions, and makes every design ruling.
Vite + React + TypeScript, Tailwind v4, Zustand, Immer, Vitest, oxlint, Prettier.

**Read `docs/architecture.md` before changing code.** It covers the layers, the tick order, the rules
the simulation follows, where things live, and how to add each kind of thing.

## Commands

```bash
npm run dev      # dev server on http://localhost:5173 (Eric usually has his own running — don't kill it)
npm run check    # type-check + lint + format check + tests. Run before every PR; CI runs the same.
npm test         # tests only (~1s)
npm run format   # Prettier, 120 columns
npm run balance  # regenerate src/sim/balance/balance-report.md (a few minutes); rerun after changing combat numbers
npm run balance:tournament  # regenerate tournament-report.md: ~100 Task Force designs, round robin (~10 min)
```

Node 24 via nvm. If `node` isn't on PATH in a tool shell: `export PATH="$HOME/.nvm/versions/node/<version>/bin:$PATH"`.

## Working agreement

- **Never push to `main`.** Branch, commit, open a PR; Eric approves and merges. Don't merge or approve
  PRs yourself.
- **One reviewable piece per commit**, with a message that explains the mechanic or the reason in plain
  language. Write PR descriptions for a reader who won't read the diff.
- **Don't decide design questions silently.** If the spec doesn't say, or two documents disagree, pick the
  most defensible reading, record it in the current `docs/epochN-decisions.md` with the date, and tell
  Eric. If it would be expensive to reverse, ask first.
- **Before "fixing" behaviour that looks wrong, search the decisions doc.** Several things that look like
  bugs are rulings (the slow redirect walk-back, slow consolidation after a capture, the 50% hit cap).
- **Worked examples in the spec become unit tests**, named with the section they come from.
- **The design documents in `docs/` are hand-authored.** Never reflow or reformat them; make surgical
  edits only, and only to the ones the architecture doc lists as implementer-edited unless Eric asks.
- **Verify UI changes in the running app**, not only with unit tests.
- Eric doesn't want to manage the implementation plan. Adjust slices as needed; raise blockers and design
  questions, not process.

## Non-negotiables in the code

- `src/sim/` imports nothing from React, the stores, or the components.
- Compute, don't store: if it can be derived from state, it's a function, not a field.
- All randomness through `nextRandom(state)`. The order of random draws is part of the rules — a combat
  refactor must leave seeded outcomes identical.
- Player actions return `{ ok, reason }`; they don't throw.
- Adding or changing a stored field means bumping `SAVE_VERSION`.

## Current state (update when it changes)

Epoch 1 (economy sandbox) and Epoch 2 (land Task Forces and combat) are built; Epoch 2 is in playtest.
Next per GDD §12: Epoch 3, Agents. Visual polish is being scoped in `docs/art-direction.md`.

## Sandbox gotchas (Claude Code on this machine)

- Inside the sandbox, the repo root shows placeholder dotfiles (`.mcp.json`, `.bashrc`, `.vscode`, …)
  that can't be read. `oxlint` and `prettier --check .` report EACCES on them; that is the sandbox, not
  the repo. Point the tools at `src` (and other real paths) to get a clean answer.
- `git stash -u` records the stash but fails to clean the working tree (it can't remove a sandbox
  directory under `.claude/`), so the following `git stash pop` conflicts with itself. To compare against
  an old version, extract it with `git archive <ref> <path> | tar -x -C "$TMPDIR/..."` instead.
- `git worktree add` doesn't work in the sandbox.
- `git push -u` prints "could not lock config file .git/config". The push itself succeeded; only the
  upstream-tracking setting couldn't be written. Confirm with `git ls-remote --heads origin <branch>`.
