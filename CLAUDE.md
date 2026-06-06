@AGENTS.md

# Documentation — Always Keep Up To Date

After making ANY change to the codebase (new feature, new component, new API route, DB schema change, renamed file, updated constants, etc.), you MUST update `TECHNICAL.md` and/or `GUIDE.md` before considering the task done.

- **`TECHNICAL.md`** — update whenever: components change, API routes are added/removed, DB schema changes, types change, constants change (VAS, colors, etc.), new env vars are added, or key patterns change.
- **`GUIDE.md`** — update whenever: a user-facing feature is added or changed, tabs are added/removed, VA names change, or any workflow the user relies on changes.

This is non-negotiable. The docs must always reflect the actual current state of the app so that any new session can pick up exactly where the last one left off.
