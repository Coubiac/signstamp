# CLAUDE.md

Project guidance for Claude Code is consolidated in [AGENTS.md](AGENTS.md) so all AI coding tools (Claude Code, OpenAI Codex, Cursor, …) read from the same source. Refer to that file for:

- What Cerfini is and its architecture
- Run / test / build commands
- Code conventions (state model, types, components, i18n, Tauri commands)
- Security posture (local-only, hardened pdf.js options)
- Commit / release flow (no co-author trailer, version-bump checklist, tag-triggered release)

Anything Claude-specific lives below. Everything project-level stays in AGENTS.md to avoid drift between the two files.

## Claude-specific notes

- The user prefers concise, terse responses — skip trailing summaries unless asked.
- Auto-memory persists across sessions under `/home/ben/.claude/projects/-mnt-d-DEV-signstamp/memory/`. Check `MEMORY.md` there for user preferences and recurring feedback before responding.
- This project has no `gh` CLI and no HTTPS credentials in the sandbox shell. When the user wants to push/tag, output the commands for them to run rather than attempting `git push` directly.
