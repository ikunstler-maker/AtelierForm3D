# Troubleshooting

## Env

## Claude agent not found — Env
- Symptom: `sonnet-worker` missing from the agent list; mode B/C has no worker.
- Root cause: file was in `~/.claude/agent/` (no "s"); Claude Code reads only `~/.claude/agents/`.
- Fix: put `sonnet-worker.md` in `C:\Users\Admin\.claude\agents\`, restart the session.
- Verify: agent list at session start shows `sonnet-worker`.
- Seen: 2026-11-22

## Blender

## Blender MCP request timed out — Blender
- Symptom: `mcp__Blender__*` returns `Error: Request timed out`; Blender process is running and responding.
- Root cause: not found yet (seen with the owner's unsaved scene open, Blender 5.3).
- Fix: run the work in headless Blender instead: `blender -b --factory-startup -P <script> -- <args>`.
- Verify: script prints its report; exit code 0/1.
- Seen: 2026-11-23

## Build / Deploy
