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

## Pointed breasts, dents on small cups — Blender
- Symptom: large bust looks like a cone; a bust below the base size leaves dents and wrinkles.
- Root cause: a bump added along one direction keeps its peak; running the same key backwards digs into
  the chest where the base breast has little relief.
- Fix: `breast_fields()`: relax the surface inside the breast region to get the chest wall; grow towards a
  target shape (shelf on the fold, round lower pole, upper slope), blended into the base near the rim and
  smoothed; negative bust weights use `M_chestFlat` (back to the wall). Solver: `negKey` / `negScale`.
- Verify: `contact_sheet.py --sheet torso`; tune first in a lab that applies the formula to a finished GLB.
- Seen: 2026-11-23

## Bust reads 114 cm on a 90 cm body — Blender
- Symptom: base chest far too big after a generator change; fit does not reach the target.
- Root cause: the "fullest level" search range for the bust tape reached the armpit and caught the arms.
- Fix: cap the range at `armpit_z - 0.008`.
- Seen: 2026-11-23

## A measure fails only when two keys are large together — Blender
- Symptom: full bust passes alone but is 0.6–4 cm off with a big rib cage or with shape sliders.
- Root cause: tape girth (convex hull, fullest level) is not a straight-line function of the breast key, of the
  rib cage key, or of the shape sliders.
- Fix: store curves in the calibration (`curveKeys`): bust curve, the same on a big rib cage, rib cage curve,
  slider effects at three breast sizes in both directions; the solver halves the interval.
- Verify: `female-plus`, `female-cup-a`, `female-cup-f` pass on both styles.
- Seen: 2026-11-23

## Horizontal line across the back on large sizes — Blender
- Symptom: shelf / line on the back at underbust level (`female-plus`, back view).
- Root cause: on the female body the bust key skips the back and the rib cage key is the top torso frame,
  so back growth (about 5 cm on `female-plus`) fades out in a short Gaussian right above the underbust
  level; the waist to underbust handover is only 5 % of height (8 cm). Found with a per-key displacement
  profile along the back strip.
- Fix: the top torso frame fades out up to the shoulder line (`torso_profile`, `smoother01`).
- Seen: 2026-11-23

## DTIC PDF links return 403 — Env
- Symptom: `apps.dtic.mil/sti/pdfs/...` cannot be fetched.
- Fix: ANSUR II documents are also at `tools.openlab.psu.edu/publicData/` (links in `docs/LANDMARKS.md`);
  extract text with `pdftotext -layout`.
- Seen: 2026-11-23

## Compression check reports errors of 1.5 m — Build
- Symptom: `compress_models.mjs` prints `max error 1593 mm ... TOO LARGE` right after writing the files.
- Root cause: meshopt reorders vertices, so comparing source and result by vertex index is meaningless.
- Fix: match vertices by base position first (`matchVertices`), then compare every shape key.
- Verify: errors around 0.02 mm.
- Seen: 2026-11-23

## Slider looks dead on the Blender bodies — UI
- Symptom: moving a measurement slider changes nothing on the realistic or anime mannequin.
- Root cause: the body drives 10 of 50 measures; the other 40 have no shape key yet (not a bug in the chain).
- Fix: rows are tagged "ще не діє"; to connect a measure add a key in the generator, then add it to
  `BLENDER_BODY_MEASURES`. Check with `scripts/audit_sliders.py` and the browser sweep in `slider_audit.md`.
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
