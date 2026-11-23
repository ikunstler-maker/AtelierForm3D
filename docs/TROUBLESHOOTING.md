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

## Whole body measures wrong only for smaller-than-base profiles — Blender
- Symptom: `verify_profiles.py` fails every measure of one body (height +4.9 cm, hip NOT MEASURED) when `M_height` < 0.
- Root cause: wide-set feet lay outside the torso boundary, counted as arms and sank below the floor; the ruler measures from the lowest vertex.
- Fix: arm zone ends above the lower legs (`limit` in `analyze()`).
- Verify: `male-s` passes on `body_male_realistic.glb`.
- Seen: 2026-11-23

## One measure drifts on extreme sizes — Blender
- Symptom: a single measure is 1.5–3 cm off only on the largest profiles (seen on bicep).
- Root cause: its section sat where another key bends the surface (upper arm at armpit level), so the response was not linear.
- Fix: move the section to a zone that key moves rigidly; debug with one key at a time (expected = base + matrix × weight).
- Verify: `female-plus` and `male-xl` pass.
- Seen: 2026-11-23

## Horizontal belts on extreme sizes — Blender
- Symptom: creases across the belly and thighs when measures differ a lot from the base.
- Root cause: separate Gaussian zones of neighbouring keys leave dips between landmarks.
- Fix: `torso_profile` (hip, waist, chest add up to 1 between hip and chest), `leg_profile` (thigh fades to the knee).
- Verify: render `female-plus` front view.
- Seen: 2026-11-23

## Realistic GLB is 14 MB — Blender
- Symptom: `body_*_realistic.glb` far above the 6 MB limit.
- Root cause: multires level 1 gives 43k vertices; every shape key stores positions and normals for all of them.
- Fix: `MULTIRES_LEVEL = 0` (11.7k vertices, 2.6 MB).
- Seen: 2026-11-23

## Breasts look like boxes, cones or pinched spikes — Blender
- Symptom: after the fit or with a large bust the breasts are box-like, pointed, or the surface folds.
- Root cause (three cases): (1) wrong landmarks: the underbust level sat far below the real fold, so the fit
  shrank the rib cage and inflated the breasts; (2) scaling the mound about one root point stretches the tip;
  (3) a smooth bump profile, zero slope at the edge, gives a cone on a coarse mesh.
- Fix: find the fold from the body (front-most point returns to the midline); grow a dome along one direction;
  profile `(1 - rho^2)^e`, e = 0.5 on the underside (ball), 1.0 on top; downward motion fades to 0 at the fold.
- Verify: render three-quarter and side close-ups for a small and a large cup before a full regeneration.
- Seen: 2026-11-23

## A measure fails only when two keys are large together — Blender
- Symptom: full bust passes alone but is 0.6–4 cm off with a big rib cage or with shape sliders.
- Root cause: tape girth (convex hull, fullest level) is not a straight-line function of the breast key, of the
  rib cage key, or of the shape sliders.
- Fix: store curves in the calibration (`curveKeys`): bust curve, the same on a big rib cage, rib cage curve,
  slider effects at three breast sizes in both directions; the solver halves the interval.
- Verify: `female-plus`, `female-cup-a`, `female-cup-f` pass on both styles.
- Seen: 2026-11-23

## Body missing right after page load — UI
- Symptom: empty canvas for a few seconds, then the body appears; no console errors.
- Root cause: 3–4 MB GLB with 15 shape keys takes 3–9 s to parse and upload.
- Fix: wait before taking a screenshot; a loading indicator is in the backlog.
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
