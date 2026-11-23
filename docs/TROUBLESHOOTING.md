# Troubleshooting

## Env

## Claude agent not found — Env
- Symptom: `sonnet-worker` missing from the agent list; mode B/C has no worker.
- Root cause: file was in `~/.claude/agent/` (no "s"); Claude Code reads only `~/.claude/agents/`.
- Fix: put `sonnet-worker.md` in `C:\Users\Admin\.claude\agents\`, restart the session.
- Verify: agent list at session start shows `sonnet-worker`.
- Seen: 2026-11-22

## Blender

## GLB torso looks inside-out on the site — Blender
- Symptom: body from the generator renders with wrong shading; torso looks hollow or boxy, limbs look fine.
- Root cause: the Y-up to Z-up axis swap in `to_blender_coords` mirrors face winding, so normals point inward.
- Fix: `normals_make_consistent(inside=False)` after joining parts (already in the generator).
- Verify: open the site with "Blender Model (beta)" on; chest and waist are shaded as convex forms.
- Seen: 2026-11-23

## Shape key value ignored above 1 or below 0 — Blender
- Symptom: measured girth stops changing for large or negative weights.
- Root cause: `kb.value` is clamped to `slider_min..slider_max` (default 0..1).
- Fix: widen `kb.slider_min` / `kb.slider_max` before setting `kb.value`.
- Verify: `scripts/verify_profiles.py` passes the `female-plus` and `female-xs` profiles.
- Seen: 2026-11-23

## Blender MCP request timed out — Blender
- Symptom: `mcp__Blender__*` returns `Error: Request timed out`; Blender process is running and responding.
- Root cause: not found yet (seen with the owner's unsaved scene open, Blender 5.3).
- Fix: run the work in headless Blender instead: `blender -b --factory-startup -P <script> -- <args>`.
- Verify: script prints its report; exit code 0/1.
- Seen: 2026-11-23

## Build / Deploy
