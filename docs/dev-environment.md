# Dev environment (WSL2) and Claude Code sandbox

- Work in the WSL filesystem (`~/dev/Ragnorosis`), not `/mnt/c`. Node 24 via nvm; never `sudo npm`.
- Install `bubblewrap` and `socat` (`sudo apt-get install bubblewrap socat`).
- `.claude/settings.template.json` is the committed template. On a new machine run
  `cp .claude/settings.template.json .claude/settings.json`; the real file is gitignored so it can hold local tweaks.
- Restart Claude Code, then verify with a probe: reading outside the repo and writing to `~` must fail, while
  `npm test` and `git push` still work. Once it does, consider setting `sandbox.failIfUnavailable` to `true`.
- Workflow: Claude commits to a branch and opens a PR as the bot account; the owner reviews, approves, and merges.
  The `permissions.deny` rules block Claude from merging or reviewing PRs and from force-pushing.
