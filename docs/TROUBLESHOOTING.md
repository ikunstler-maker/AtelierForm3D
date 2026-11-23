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

## Ruler reads girths far too small on an imported GLB — Blender
- Symptom: `verify_profiles.py` fails on chest, waist, hip (e.g. hip 46 instead of 102) while neck and height pass.
- Root cause: the glTF exporter splits vertices along UV seams, so a slice is several open pieces, not one loop.
- Fix: import with `bpy.ops.import_scene.gltf(filepath=..., merge_vertices=True)`.
- Verify: `scripts/verify_profiles.py` prints 5/5.
- Seen: 2026-11-23

## Ears or other parts stretch sideways with girth keys — Blender
- Symptom: ears pulled outward, or a ledge / crumpled skin at the shoulder after the fit.
- Root cause: points outside the torso boundary are treated as arm; the blend to rigid arm motion was too abrupt.
- Fix: in `girth_shift` limit the arm zone below the neck, move each arm as one piece with its shoulder joint, fade depth over `ARM_DEPTH_FADE_M`.
- Verify: render close-ups of the shoulders for base and extreme sizes.
- Seen: 2026-11-23

## PowerShell cannot touch .blend paths — Env
- Symptom: `resolve-path targeting '...blend' was blocked` in the Claude session.
- Root cause: `.claude/settings.json` denies reading `*.blend`; path cmdlets on such files are blocked too.
- Fix: pass the path as a plain string to Blender (`"$PWD\assets\..."`), do not use `Resolve-Path` / `Test-Path`.
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
