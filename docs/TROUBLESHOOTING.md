# Troubleshooting

## Env

## Claude agent not found — Env
- Symptom: `sonnet-worker` missing from the agent list; mode B/C has no worker.
- Root cause: file was in `~/.claude/agent/` (no "s"); Claude Code reads only `~/.claude/agents/`.
- Fix: put `sonnet-worker.md` in `C:\Users\Admin\.claude\agents\`, restart the session.
- Verify: agent list at session start shows `sonnet-worker`.
- Seen: 2026-11-22

## Blender

## Build / Deploy
